import type { ReplayGainInfo, ReplayGainMode } from '../types';

// src/utils/replayGain.ts

export interface ReplayGainCalculation {
    gainDb: number;
    effectiveGainDb: number;
    peak?: number;
    linearGain: number;
    /** 这首歌是否带 ReplayGain 标签。auto 模式据此决定要不要退回实时测量。 */
    hasTagGain: boolean;
}

export const toFiniteNumber = (value: unknown): number | undefined => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
    if (typeof value !== 'string' || value.trim() === '') return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
};

export const decibelsToLinearPeak = (decibels: unknown): number | undefined => {
    const value = toFiniteNumber(decibels);
    return value === undefined ? undefined : Math.pow(10, value / 20);
};

// Selects the requested mode, applies album-to-track fallback, and prevents positive gain from clipping.
export const calculateReplayGain = (
    replayGain: ReplayGainInfo | null | undefined,
    mode: ReplayGainMode,
): ReplayGainCalculation => {
    if (!replayGain || mode === 'off') {
        return { gainDb: 0, effectiveGainDb: 0, linearGain: 1, hasTagGain: false };
    }

    // auto 与 track 都以单曲增益为准，只在缺失时借专辑值顶上——
    // 有值总比退回实时测量准确，测量拿不到整首歌的全貌。
    const taggedGainDb = mode === 'album'
        ? toFiniteNumber(replayGain.albumGain) ?? toFiniteNumber(replayGain.trackGain)
        : toFiniteNumber(replayGain.trackGain) ?? (mode === 'auto' ? toFiniteNumber(replayGain.albumGain) : undefined);
    const gainDb = taggedGainDb ?? 0;
    const peak = mode === 'album'
        ? toFiniteNumber(replayGain.albumPeak) ?? toFiniteNumber(replayGain.trackPeak)
        : toFiniteNumber(replayGain.trackPeak) ?? (mode === 'auto' ? toFiniteNumber(replayGain.albumPeak) : undefined);

    let effectiveGainDb = gainDb;
    if (gainDb > 0 && peak !== undefined && peak > 0) {
        const clipSafeGainDb = -20 * Math.log10(peak);
        effectiveGainDb = Math.min(gainDb, clipSafeGainDb);
    }

    return {
        gainDb,
        effectiveGainDb,
        peak,
        linearGain: Math.pow(10, effectiveGainDb / 20),
        hasTagGain: taggedGainDb !== undefined,
    };
};
