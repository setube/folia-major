import { useCallback, useEffect, useRef } from 'react';
import type { MutableRefObject, RefObject } from 'react';
import { PlayerState } from '../types';
import type { AudioFadeDuration, AudioFadeScene } from '../utils/audioFade';
import { rampGainTo, resolveFadeMs } from '../utils/audioFade';
import {
    createLoudnessAccumulator,
    pushLoudnessBlock,
    resolveLoudnessNormalization,
} from '../utils/loudnessNormalization';
import type { LoudnessAccumulator } from '../utils/loudnessNormalization';

// src/hooks/usePlaybackLoudnessController.ts
// 淡入淡出与实时音量均衡的运行时：两者都只写 AudioParam 与 ref，
// 不往 React state 里塞连续量（见 CLAUDE.md 的高频路径约束）。

/** 采样间隔。均衡的时间常数以秒计，100ms 已远快于需要，没必要上 RAF。 */
const LOUDNESS_SAMPLE_INTERVAL_MS = 100;

type UsePlaybackLoudnessControllerParams = {
    audioRef: RefObject<HTMLAudioElement | null>;
    audioContextRef: MutableRefObject<AudioContext | null>;
    gainNodeRef: MutableRefObject<GainNode | null>;
    analyserRef: MutableRefObject<AnalyserNode | null>;
    /** 标签路径算出的线性增益，实时测量结果要乘在它之上。 */
    replayGainLinearRef: MutableRefObject<number>;
    /** 实时测量的线性增益，由本 hook 写入，syncOutputGain 读取。 */
    measuredGainLinearRef: MutableRefObject<number>;
    /** 当前曲目是否需要实时测量：auto 模式且没有 ReplayGain 标签时为 true。 */
    needsLoudnessMeasurementRef: MutableRefObject<boolean>;
    /** 曲目标识，变化即重置测量窗口。 */
    currentSongKey: string | null;
    playerState: PlayerState;
    audioFadeEnabled: boolean;
    audioFadeDuration: AudioFadeDuration;
    syncOutputGain: (targetVolume: number, smoothing?: number) => void;
    getTargetPlaybackVolume: () => number;
};

export function usePlaybackLoudnessController({
    audioRef,
    audioContextRef,
    gainNodeRef,
    analyserRef,
    replayGainLinearRef,
    measuredGainLinearRef,
    needsLoudnessMeasurementRef,
    currentSongKey,
    playerState,
    audioFadeEnabled,
    audioFadeDuration,
    syncOutputGain,
    getTargetPlaybackVolume,
}: UsePlaybackLoudnessControllerParams) {
    const fadeEnabledRef = useRef(audioFadeEnabled);
    const fadeDurationRef = useRef(audioFadeDuration);
    const pendingPauseTimerRef = useRef<number | null>(null);
    const accumulatorRef = useRef<LoudnessAccumulator>(createLoudnessAccumulator());
    const measurementSampleBufferRef = useRef<Float32Array<ArrayBuffer> | null>(null);
    const measuredSongKeyRef = useRef<string | null>(null);

    useEffect(() => {
        fadeEnabledRef.current = audioFadeEnabled;
    }, [audioFadeEnabled]);

    useEffect(() => {
        fadeDurationRef.current = audioFadeDuration;
    }, [audioFadeDuration]);

    const clearPendingPause = useCallback(() => {
        if (pendingPauseTimerRef.current !== null) {
            window.clearTimeout(pendingPauseTimerRef.current);
            pendingPauseTimerRef.current = null;
        }
    }, []);

    const resolveSceneMs = useCallback(
        (scene: AudioFadeScene) => resolveFadeMs(fadeEnabledRef.current, fadeDurationRef.current, scene),
        [],
    );

    /** 把增益斜坡到"当前音量 × 全部均衡增益"，供淡入使用。 */
    const rampToTargetVolume = useCallback((scene: AudioFadeScene) => {
        const context = audioContextRef.current;
        const gainNode = gainNodeRef.current;
        if (!context || !gainNode) {
            syncOutputGain(getTargetPlaybackVolume(), 0);
            return;
        }

        const target = replayGainLinearRef.current * measuredGainLinearRef.current * getTargetPlaybackVolume();
        rampGainTo(gainNode.gain, context.currentTime, target, resolveSceneMs(scene));
    }, [audioContextRef, gainNodeRef, getTargetPlaybackVolume, measuredGainLinearRef, replayGainLinearRef, resolveSceneMs, syncOutputGain]);

    /**
     * 淡出后再真正 pause。必须等斜坡跑完，否则 pause 会立刻切断输出，淡出等于没做。
     * 返回是否已接管暂停；false 表示调用方按原路径直接 pause。
     */
    const fadeOutAndPause = useCallback((): boolean => {
        const context = audioContextRef.current;
        const gainNode = gainNodeRef.current;
        const fadeMs = resolveSceneMs('pause');

        if (!context || !gainNode || fadeMs <= 0 || !audioRef.current) {
            return false;
        }

        clearPendingPause();
        rampGainTo(gainNode.gain, context.currentTime, 0, fadeMs);
        pendingPauseTimerRef.current = window.setTimeout(() => {
            pendingPauseTimerRef.current = null;
            audioRef.current?.pause();
        }, fadeMs);
        return true;
    }, [audioContextRef, audioRef, clearPendingPause, gainNodeRef, resolveSceneMs]);

    /** 起播前把增益压到 0，让随后的 play() 从静音开始淡入。 */
    const primeFadeIn = useCallback((scene: AudioFadeScene): boolean => {
        const context = audioContextRef.current;
        const gainNode = gainNodeRef.current;
        if (!context || !gainNode || resolveSceneMs(scene) <= 0) {
            return false;
        }

        clearPendingPause();
        rampGainTo(gainNode.gain, context.currentTime, 0, 0);
        return true;
    }, [audioContextRef, clearPendingPause, gainNodeRef, resolveSceneMs]);

    const fadeIn = useCallback((scene: AudioFadeScene) => {
        rampToTargetVolume(scene);
    }, [rampToTargetVolume]);

    // 换曲重置测量窗口：上一首的统计对这一首没有意义。
    useEffect(() => {
        accumulatorRef.current = createLoudnessAccumulator();
        measuredSongKeyRef.current = null;
        measuredGainLinearRef.current = 1;
    }, [currentSongKey, measuredGainLinearRef]);

    // 实时响度测量：只在 auto 模式、当前曲目无标签、且确实在播放时跑。
    useEffect(() => {
        if (playerState !== PlayerState.PLAYING || !needsLoudnessMeasurementRef.current) {
            return;
        }

        if (measuredSongKeyRef.current === currentSongKey) {
            return;
        }

        const timer = window.setInterval(() => {
            const analyser = analyserRef.current;
            if (!analyser) {
                return;
            }

            const size = analyser.fftSize;
            if (!measurementSampleBufferRef.current || measurementSampleBufferRef.current.length !== size) {
                measurementSampleBufferRef.current = new Float32Array(size);
            }

            const buffer = measurementSampleBufferRef.current;
            analyser.getFloatTimeDomainData(buffer);
            accumulatorRef.current = pushLoudnessBlock(accumulatorRef.current, buffer);

            const normalization = resolveLoudnessNormalization(accumulatorRef.current);
            if (!normalization) {
                return;
            }

            measuredSongKeyRef.current = currentSongKey;
            measuredGainLinearRef.current = normalization.linearGain;
            console.log(
                `[AudioContext] Loudness measured=${normalization.measuredDbfs.toFixed(1)}dBFS `
                + `gain=${normalization.effectiveGainDb.toFixed(2)}dB (raw=${normalization.gainDb.toFixed(2)}dB, `
                + `peak=${normalization.peak.toFixed(3)})`,
            );
            // 一次性平滑接上，别让电平突然跳一档。
            syncOutputGain(getTargetPlaybackVolume(), 0.35);
            window.clearInterval(timer);
        }, LOUDNESS_SAMPLE_INTERVAL_MS);

        return () => window.clearInterval(timer);
    }, [analyserRef, currentSongKey, getTargetPlaybackVolume, measuredGainLinearRef, needsLoudnessMeasurementRef, playerState, syncOutputGain]);

    useEffect(() => clearPendingPause, [clearPendingPause]);

    return {
        fadeOutAndPause,
        primeFadeIn,
        fadeIn,
        cancelPendingPause: clearPendingPause,
    };
}
