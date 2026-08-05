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
import { setCachedLoudnessGain } from '../services/loudnessCache';

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

    // 把上一首累计到的样本结算进缓存。测量结果**不**作用于本次播放 ——
    // 播到一半改增益正是"忽大忽小"的来源，同一首歌下次播放才从第 0 秒带上它。
    const flushMeasurement = useCallback((songKey: string | null) => {
        if (!songKey || accumulatorRef.current.sampleCount === 0) {
            return;
        }

        const normalization = resolveLoudnessNormalization(accumulatorRef.current);
        accumulatorRef.current = createLoudnessAccumulator();
        if (!normalization) {
            return;
        }

        setCachedLoudnessGain(songKey, normalization);
        console.log(
            `[AudioContext] Loudness learned ${songKey}: measured=${normalization.measuredDbfs.toFixed(1)}dBFS `
            + `gain=${normalization.effectiveGainDb.toFixed(2)}dB (peak=${normalization.peak.toFixed(3)}), `
            + '将在下次播放该曲时生效',
        );
    }, []);

    // 换曲时先结算上一首，再清空窗口。measuredGainLinearRef 由音频桥在换曲时
    // 从缓存里取，这里不要动它，否则会把刚读出来的增益覆盖成 1。
    useEffect(() => {
        const previousKey = measuredSongKeyRef.current;
        measuredSongKeyRef.current = currentSongKey;
        if (previousKey && previousKey !== currentSongKey) {
            flushMeasurement(previousKey);
        } else {
            accumulatorRef.current = createLoudnessAccumulator();
        }
    }, [currentSongKey, flushMeasurement]);

    // 实时响度测量：只在 auto 模式、当前曲目无标签、且确实在播放时跑。
    // 采样贯穿整首歌而不是只取开头几秒 —— 前奏往往远比副歌安静，只测开头会系统性偏高。
    useEffect(() => {
        if (playerState !== PlayerState.PLAYING || !needsLoudnessMeasurementRef.current) {
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
        }, LOUDNESS_SAMPLE_INTERVAL_MS);

        return () => window.clearInterval(timer);
    }, [analyserRef, needsLoudnessMeasurementRef, playerState]);

    // 卸载前把手上这首也结算掉，不然关窗前听的那首白测了。
    useEffect(() => () => flushMeasurement(measuredSongKeyRef.current), [flushMeasurement]);

    useEffect(() => clearPendingPause, [clearPendingPause]);

    return {
        fadeOutAndPause,
        primeFadeIn,
        fadeIn,
        cancelPendingPause: clearPendingPause,
    };
}
