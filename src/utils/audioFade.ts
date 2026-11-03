// src/utils/audioFade.ts
// 淡入淡出的时长档位。淡变本身由 services/playbackFade 在专用增益节点上执行，这里只给档位和毫秒数。

export type AudioFadeDuration = 'fast' | 'standard' | 'smooth';

export const AUDIO_FADE_DURATIONS: readonly AudioFadeDuration[] = ['fast', 'standard', 'smooth'];

export const AUDIO_FADE_DURATION_MS: Record<AudioFadeDuration, number> = {
    fast: 200,
    standard: 400,
    smooth: 800,
};

export const isAudioFadeDuration = (value: unknown): value is AudioFadeDuration =>
    typeof value === 'string' && (AUDIO_FADE_DURATIONS as readonly string[]).includes(value);
