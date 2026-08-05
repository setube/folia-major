import { useCallback } from 'react';
import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react';
import { PlayerState } from '../types';

// src/hooks/usePlaybackTransportController.ts

type UsePlaybackTransportControllerParams = {
    activePlaybackContext: 'main' | 'stage';
    stageActiveEntryKind: string | null;
    isNowPlayingStageActive: boolean;
    audioSrc: string | null;
    duration: number;
    audioRef: RefObject<HTMLAudioElement | null>;
    audioContextRef: MutableRefObject<AudioContext | null>;
    currentTime: { set: (value: number) => void };
    stageLyricsClockRef: MutableRefObject<{
        startTimeSec: number;
        endTimeSec: number;
        baseTimeSec: number;
        startedAtMs: number | null;
    }>;
    setPlayerState: Dispatch<SetStateAction<PlayerState>>;
    setStatusMsg: Dispatch<SetStateAction<any>>;
    setupAudioAnalyzer: () => void;
    syncOutputGain: (targetVolume: number, smoothing?: number) => void;
    getTargetPlaybackVolume: () => number;
    /** 淡出后再 pause；返回 false 表示未启用淡变，按原路径立即暂停。 */
    fadeOutAndPause: () => boolean;
    /** 起播前把增益压到 0；返回 false 表示未启用淡变。 */
    primeFadeIn: (scene: 'resume' | 'trackStart' | 'seek') => boolean;
    fadeIn: (scene: 'resume' | 'trackStart' | 'seek') => void;
    cancelPendingPause: () => void;
    shouldRefreshCurrentOnlineAudioSource: () => boolean;
    recoverOnlinePlaybackSource: (options: {
        failedSrc?: string | null;
        resumeAt?: number;
        autoplay: boolean;
    }) => Promise<boolean>;
    getSyntheticStageLyricsTime: () => number;
    syncStageLyricsClock: (timeSec: number, endTimeSec: number, nextPlayerState: PlayerState, startTimeSec?: number) => void;
    t: (key: string) => string;
};

// Owns play and pause transport behavior across main playback and Stage lyric-only playback.
export function usePlaybackTransportController({
    activePlaybackContext,
    stageActiveEntryKind,
    isNowPlayingStageActive,
    audioSrc,
    duration,
    audioRef,
    audioContextRef,
    currentTime,
    stageLyricsClockRef,
    setPlayerState,
    setStatusMsg,
    setupAudioAnalyzer,
    syncOutputGain,
    getTargetPlaybackVolume,
    fadeOutAndPause,
    primeFadeIn,
    fadeIn,
    cancelPendingPause,
    shouldRefreshCurrentOnlineAudioSource,
    recoverOnlinePlaybackSource,
    getSyntheticStageLyricsTime,
    syncStageLyricsClock,
    t,
}: UsePlaybackTransportControllerParams) {
    const resumePlayback = useCallback(async () => {
        if (isNowPlayingStageActive) {
            return;
        }

        if (activePlaybackContext === 'stage' && stageActiveEntryKind === 'lyrics' && !audioSrc) {
            const currentSyntheticTime = getSyntheticStageLyricsTime();
            syncStageLyricsClock(currentSyntheticTime, duration, PlayerState.PLAYING, stageLyricsClockRef.current.startTimeSec);
            currentTime.set(currentSyntheticTime);
            setPlayerState(PlayerState.PLAYING);
            return;
        }

        if (!audioRef.current) {
            return;
        }

        setupAudioAnalyzer();
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
        }

        // 上一次淡出可能还挂着 pause 定时器，先撤掉，否则刚起播就会被它按停。
        cancelPendingPause();
        const shouldFadeIn = primeFadeIn('resume');
        if (!shouldFadeIn) {
            syncOutputGain(getTargetPlaybackVolume(), 0);
        }
        if (shouldRefreshCurrentOnlineAudioSource()) {
            const refreshed = await recoverOnlinePlaybackSource({
                failedSrc: audioRef.current.currentSrc || audioSrc,
                resumeAt: audioRef.current.currentTime,
                autoplay: true,
            });

            if (refreshed) {
                return;
            }
        }

        try {
            await audioRef.current.play();
            if (shouldFadeIn) {
                fadeIn('resume');
            }
            setPlayerState(PlayerState.PLAYING);
        } catch (error) {
            const recovered = await recoverOnlinePlaybackSource({
                failedSrc: audioRef.current.currentSrc || audioSrc,
                resumeAt: audioRef.current.currentTime,
                autoplay: true,
            });

            if (recovered) {
                return;
            }

            if (!audioRef.current.paused && !audioRef.current.ended) {
                if (shouldFadeIn) {
                    fadeIn('resume');
                }
                setPlayerState(PlayerState.PLAYING);
                return;
            }

            // 播放没起来就把压到 0 的增益还原，否则下次成功起播前会一直是静音。
            if (shouldFadeIn) {
                syncOutputGain(getTargetPlaybackVolume(), 0);
            }

            if (error instanceof DOMException && error.name === 'NotAllowedError') {
                setStatusMsg({ type: 'info', text: t('status.clickToPlay') });
                setPlayerState(PlayerState.PAUSED);
                return;
            }

            setStatusMsg({ type: 'error', text: t('status.playbackError') });
            setPlayerState(PlayerState.PAUSED);
            throw error;
        }
    }, [activePlaybackContext, audioContextRef, audioRef, audioSrc, cancelPendingPause, currentTime, duration, fadeIn, getSyntheticStageLyricsTime, getTargetPlaybackVolume, isNowPlayingStageActive, primeFadeIn, recoverOnlinePlaybackSource, setPlayerState, setStatusMsg, setupAudioAnalyzer, shouldRefreshCurrentOnlineAudioSource, stageActiveEntryKind, stageLyricsClockRef, syncOutputGain, syncStageLyricsClock, t]);

    const pausePlayback = useCallback(() => {
        if (isNowPlayingStageActive) {
            return;
        }

        if (activePlaybackContext === 'stage' && stageActiveEntryKind === 'lyrics' && !audioSrc) {
            const currentSyntheticTime = getSyntheticStageLyricsTime();
            syncStageLyricsClock(currentSyntheticTime, duration, PlayerState.PAUSED, stageLyricsClockRef.current.startTimeSec);
            currentTime.set(currentSyntheticTime);
            setPlayerState(PlayerState.PAUSED);
            return;
        }

        if (!audioRef.current) {
            return;
        }

        if (!fadeOutAndPause()) {
            audioRef.current.pause();
            syncOutputGain(getTargetPlaybackVolume(), 0);
        }
        setPlayerState(PlayerState.PAUSED);
    }, [activePlaybackContext, audioRef, audioSrc, currentTime, duration, fadeOutAndPause, getSyntheticStageLyricsTime, getTargetPlaybackVolume, isNowPlayingStageActive, setPlayerState, stageActiveEntryKind, stageLyricsClockRef, syncOutputGain, syncStageLyricsClock]);

    return {
        resumePlayback,
        pausePlayback,
    };
}
