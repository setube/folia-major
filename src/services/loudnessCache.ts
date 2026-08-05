import type { LoudnessNormalization } from '../utils/loudnessNormalization';

// src/services/loudnessCache.ts
// 实时响度测量结果的按曲缓存。
//
// 存在的理由是"什么时候施加增益"：测量要听过一段音频才有结论，如果测完就地生效，
// 用户会在歌曲播到一半时听见音量跳一档 —— 这恰恰是音量均衡想消除的现象。
// 所以本次播放只测不改，结果落盘；同一首歌下次播放时从第 0 秒就带上正确增益。
//
// 落 localStorage 而不是内存：重启后不必重新学一遍，曲库跑一轮就基本收敛了。

const STORAGE_KEY = 'loudness_measurement_cache';
/** 上限内按最近写入淘汰。每条约 60 字节，600 条不到 40KB。 */
const MAX_ENTRIES = 600;

export interface LoudnessCacheEntry {
    /** 线性增益，直接乘进输出增益。 */
    gain: number;
    /** 最近写入时间戳，仅用于淘汰。 */
    at: number;
}

type LoudnessCacheMap = Record<string, LoudnessCacheEntry>;

let cache: LoudnessCacheMap | null = null;

const readCache = (): LoudnessCacheMap => {
    if (cache) {
        return cache;
    }

    if (typeof window === 'undefined') {
        cache = {};
        return cache;
    }

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        cache = parsed && typeof parsed === 'object' ? parsed as LoudnessCacheMap : {};
    } catch {
        // 缓存坏了不该拖垮播放，丢掉重来即可。
        cache = {};
    }

    return cache;
};

const persist = (next: LoudnessCacheMap) => {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
        // 配额满了就放弃持久化，内存里的结果本次会话仍然有效。
    }
};

const evictOldest = (map: LoudnessCacheMap): LoudnessCacheMap => {
    const keys = Object.keys(map);
    if (keys.length <= MAX_ENTRIES) {
        return map;
    }

    const survivors = keys
        .sort((a, b) => (map[b]?.at ?? 0) - (map[a]?.at ?? 0))
        .slice(0, MAX_ENTRIES);
    const next: LoudnessCacheMap = {};
    for (const key of survivors) {
        next[key] = map[key];
    }
    return next;
};

/** 取这首歌已学到的线性增益；没有就返回 null，本次播放不做修正。 */
export const getCachedLoudnessGain = (songKey: string | null): number | null => {
    if (!songKey) {
        return null;
    }

    const entry = readCache()[songKey];
    return entry && Number.isFinite(entry.gain) && entry.gain > 0 ? entry.gain : null;
};

export const setCachedLoudnessGain = (songKey: string | null, normalization: LoudnessNormalization): void => {
    if (!songKey) {
        return;
    }

    const next = evictOldest({
        ...readCache(),
        [songKey]: { gain: normalization.linearGain, at: Date.now() },
    });
    cache = next;
    persist(next);
};

export const clearLoudnessCache = (): void => {
    cache = {};
    persist({});
};
