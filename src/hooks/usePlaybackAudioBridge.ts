import { useCallback, useEffect, useRef } from 'react';
import type { MutableRefObject, RefObject } from 'react';
import { PlayerState } from '../types';
import type { ReplayGainInfo, ReplayGainMode, SongResult, StatusMessage } from '../types';
import type { LocalSong } from '../types';
import { saveAudioBlob } from '../services/audioCache';
import { hasCachedSongAudio } from '../services/onlineMusic/resourceCache';
import { getSongResourceCacheKey } from '../services/onlineMusic/resourceKeys';
import { resolveNavidromePlaybackCarrier } from '../utils/appPlaybackGuards';
import { calculateReplayGain } from '../utils/replayGain';
import { getCachedLoudnessGain } from '../services/loudnessCache';
import { getPlaybackSongKey } from '../utils/appPlaybackGuards';
import { saveToCache } from '../services/db';
import { applyAudioEqualizerSettings, connectAudioEqualizerGraph } from '../services/audioEqualizerGraph';
import { useSettingsUiStore } from '../stores/useSettingsUiStore';

// src/hooks/usePlaybackAudioBridge.ts

type UsePlaybackAudioBridgeParams = {
    audioRef: RefObject<HTMLAudioElement | null>;
    audioSrc: string | null;
    currentSong: SongResult | null;
    localSongs: LocalSong[];
    isLyricsLoading: boolean;
    enableMediaCache: boolean;
    isPanelOpen: boolean;
    panelTab: string;
    replayGainMode: ReplayGainMode;
    shouldAutoPlayRef: MutableRefObject<boolean>;
    audioContextRef: MutableRefObject<AudioContext | null>;
    analyserRef: MutableRefObject<AnalyserNode | null>;
    gainNodeRef: MutableRefObject<GainNode | null>;
    replayGainLinearRef: MutableRefObject<number>;
    needsLoudnessMeasurementRef: MutableRefObject<boolean>;
    measuredGainLinearRef: MutableRefObject<number>;
    sourceRef: MutableRefObject<MediaElementAudioSourceNode | null>;
    setPlayerState: React.Dispatch<React.SetStateAction<PlayerState>>;
    setStatusMsg: React.Dispatch<React.SetStateAction<StatusMessage | null>>;
    syncOutputGain: (targetVolume: number, smoothing?: number) => void;
    getTargetPlaybackVolume: () => number;
    /** 起播前把增益压到 0；返回 false 表示未启用淡变。 */
    primeTrackFadeIn: () => boolean;
    runTrackFadeIn: () => void;
    getCoverUrl: () => string | null;
    updateCacheSize: () => void;
    t: (key: string) => string;
};

// Bridges audio element setup, autoplay, replay gain, and media caching.
export function usePlaybackAudioBridge({
    audioRef,
    audioSrc,
    currentSong,
    localSongs,
    isLyricsLoading,
    enableMediaCache,
    isPanelOpen,
    panelTab,
    replayGainMode,
    shouldAutoPlayRef,
    audioContextRef,
    analyserRef,
    gainNodeRef,
    replayGainLinearRef,
    needsLoudnessMeasurementRef,
    measuredGainLinearRef,
    sourceRef,
    setPlayerState,
    setStatusMsg,
    syncOutputGain,
    getTargetPlaybackVolume,
    primeTrackFadeIn,
    runTrackFadeIn,
    getCoverUrl,
    updateCacheSize,
    t,
}: UsePlaybackAudioBridgeParams) {
    const previousAudioSrcRef = useRef<string | null>(null);
    const replayGainLogSignatureRef = useRef<string | null>(null);
    const equalizerNodesRef = useRef<BiquadFilterNode[]>([]);
    const audioEqualizerSettings = useSettingsUiStore(state => state.audioEqualizerSettings);

    // Recalculates source-specific gain after the audio graph or playback settings become ready.
    const applyReplayGain = useCallback(() => {
        if (!currentSong || !gainNodeRef.current || !audioContextRef.current) return;

        let replayGainInfo: ReplayGainInfo | undefined;
        const localSongId = (currentSong as SongResult & { localRef?: { songId: string } }).localRef?.songId;
        const localData = localSongId ? localSongs.find(song => song.id === localSongId) : undefined;
        if ((currentSong as SongResult & { isLocal?: boolean }).isLocal && localData) {
            replayGainInfo = {
                trackGain: typeof localData.replayGainTrackGain === 'number'
                    ? localData.replayGainTrackGain
                    : localData.replayGain,
                trackPeak: localData.replayGainTrackPeak,
                albumGain: localData.replayGainAlbumGain,
                albumPeak: localData.replayGainAlbumPeak,
            };
        }

        const navidromeSong = resolveNavidromePlaybackCarrier(currentSong);
        const navidromeReplayGain = navidromeSong?.navidromeData.replayGain;
        if (navidromeReplayGain) {
            replayGainInfo = navidromeReplayGain;
        }

        if (currentSong.sourceRef?.kind === 'online') {
            replayGainInfo = currentSong.replayGain;
        }

        const calculation = calculateReplayGain(replayGainInfo, replayGainMode);
        replayGainLinearRef.current = calculation.linearGain;
        // auto 模式且这首歌没带 ReplayGain 标签时，才启动实时响度测量兜底。
        const needsMeasurement = replayGainMode === 'auto' && !calculation.hasTagGain;
        needsLoudnessMeasurementRef.current = needsMeasurement;
        // 只用之前学到的结果，且在起播前就定下来，全程不再变动 ——
        // 播到一半改增益正是"一首接一首忽大忽小"的来源。
        measuredGainLinearRef.current = needsMeasurement
            ? (getCachedLoudnessGain(getPlaybackSongKey(currentSong)) ?? 1)
            : 1;

        try {
            syncOutputGain(getTargetPlaybackVolume(), 0.1);
            const replayGainLogSignature = JSON.stringify({
                songId: currentSong.id,
                mode: replayGainMode,
                raw: calculation.gainDb,
                effective: calculation.effectiveGainDb,
                peak: calculation.peak ?? null,
            });

            if (replayGainLogSignatureRef.current !== replayGainLogSignature) {
                replayGainLogSignatureRef.current = replayGainLogSignature;
                console.log(`[AudioContext] ReplayGain mode=${replayGainMode} gain=${calculation.effectiveGainDb}dB (raw=${calculation.gainDb}dB, peak=${calculation.peak ?? 'n/a'}, linear=${calculation.linearGain.toFixed(2)})`);
            }
        } catch (error) {
            console.warn('[AudioContext] Failed to apply ReplayGain', error);
        }
    }, [audioContextRef, currentSong, gainNodeRef, getTargetPlaybackVolume, localSongs, measuredGainLinearRef, needsLoudnessMeasurementRef, replayGainLinearRef, replayGainMode, syncOutputGain]);

    const setupAudioAnalyzer = useCallback(() => {
        if (!audioRef.current || sourceRef.current) return;
        try {
            const AudioContextClass = window.AudioContext || (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            const ctx = new AudioContextClass();
            audioContextRef.current = ctx;

            const analyser = ctx.createAnalyser();
            analyser.fftSize = 2048;
            analyser.smoothingTimeConstant = 0.6;
            analyserRef.current = analyser;

            const gainNode = ctx.createGain();
            gainNodeRef.current = gainNode;

            const source = ctx.createMediaElementSource(audioRef.current);
            source.connect(gainNode);
            connectAudioEqualizerGraph({
                context: ctx,
                input: gainNode,
                output: analyser,
                nodesRef: equalizerNodesRef,
                settings: audioEqualizerSettings,
            });
            analyser.connect(ctx.destination);
            sourceRef.current = source;
            applyReplayGain();
            syncOutputGain(getTargetPlaybackVolume(), 0);
        } catch (error) {
            console.error('Audio Context Setup Failed:', error);
        }
    }, [analyserRef, applyReplayGain, audioContextRef, audioEqualizerSettings, audioRef, gainNodeRef, getTargetPlaybackVolume, sourceRef, syncOutputGain]);

    const cacheSongAssets = useCallback(async () => {
        if (!currentSong || !audioSrc || audioSrc.startsWith('blob:')) return;

        const existing = await hasCachedSongAudio(currentSong);
        if (existing || !enableMediaCache) return;

        console.log('[Cache] Caching fully played song:', currentSong.name);

        try {
            const response = await fetch(audioSrc);
            const blob = await response.blob();
            await saveAudioBlob(getSongResourceCacheKey('audio', currentSong), blob);
            console.log('[Cache] Audio saved');
        } catch (error) {
            console.error('[Cache] Failed to download audio for cache', error);
        }

        const coverUrl = getCoverUrl();
        if (coverUrl) {
            try {
                const response = await fetch(coverUrl, { mode: 'cors' });
                const blob = await response.blob();
                await saveToCache(getSongResourceCacheKey('cover', currentSong), blob);
                console.log('[Cache] Cover saved');
            } catch (error) {
                console.error('[Cache] Failed to download cover for cache', error);
            }
        }

        if (isPanelOpen && panelTab === 'account') {
            updateCacheSize();
        }
    }, [audioSrc, currentSong, enableMediaCache, getCoverUrl, isPanelOpen, panelTab, updateCacheSize]);

    useEffect(() => {
        if (audioRef.current) {
            syncOutputGain(getTargetPlaybackVolume(), 0.015);
        }
    }, [audioRef, getTargetPlaybackVolume, syncOutputGain]);

    useEffect(() => {
        localStorage.setItem('local_replaygain_mode', replayGainMode);
    }, [replayGainMode]);

    useEffect(() => {
        applyReplayGain();
    }, [applyReplayGain]);

    useEffect(() => {
        const context = audioContextRef.current;
        if (!context || equalizerNodesRef.current.length === 0) {
            return;
        }
        applyAudioEqualizerSettings(context, equalizerNodesRef.current, audioEqualizerSettings);
    }, [audioContextRef, audioEqualizerSettings]);

    useEffect(() => {
        const audioElement = audioRef.current;
        if (!audioElement) {
            previousAudioSrcRef.current = audioSrc;
            return;
        }

        if (audioSrc && previousAudioSrcRef.current && previousAudioSrcRef.current !== audioSrc) {
            audioElement.pause();
            audioElement.load();
        }

        previousAudioSrcRef.current = audioSrc;
    }, [audioRef, audioSrc]);

    useEffect(() => {
        if (audioSrc && audioRef.current) {
            if (shouldAutoPlayRef.current && !isLyricsLoading) {
                shouldAutoPlayRef.current = false;
                // 音频图要等第一次 play() 之后才建好，首曲没有 gainNode 可压，
                // 淡入从第二首起才真正生效 —— 这符合预期：首曲本来就没有"上一首"要淡出。
                const shouldFadeIn = primeTrackFadeIn();
                if (!shouldFadeIn) {
                    syncOutputGain(getTargetPlaybackVolume(), 0);
                }
                const playPromise = audioRef.current.play();
                if (playPromise !== undefined) {
                    playPromise
                        .then(() => {
                            setPlayerState(PlayerState.PLAYING);
                            setupAudioAnalyzer();
                            if (shouldFadeIn) {
                                runTrackFadeIn();
                            }
                        })
                        .catch(error => {
                            if (audioRef.current && !audioRef.current.paused && !audioRef.current.ended) {
                                if (shouldFadeIn) {
                                    runTrackFadeIn();
                                }
                                setPlayerState(PlayerState.PLAYING);
                                return;
                            }

                            // 起播失败要还原增益，否则窗口会停在静音状态。
                            if (shouldFadeIn) {
                                syncOutputGain(getTargetPlaybackVolume(), 0);
                            }

                            if (error.name === 'NotAllowedError') {
                                setStatusMsg({ type: 'info', text: t('status.clickToPlay') });
                                setPlayerState(PlayerState.PAUSED);
                            }
                        });
                }
            }
        }
    }, [audioRef, audioSrc, getTargetPlaybackVolume, isLyricsLoading, primeTrackFadeIn, runTrackFadeIn, setPlayerState, setStatusMsg, setupAudioAnalyzer, shouldAutoPlayRef, syncOutputGain, t]);

    return {
        setupAudioAnalyzer,
        cacheSongAssets,
    };
}
