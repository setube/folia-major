// src/utils/loudnessNormalization.ts
// 音量均衡在"没有 ReplayGain 标签"时的兜底：边播边测一段响度，算出把这首歌拉到
// 统一参考电平所需的增益。
//
// 网易云的做法是双路的：在线歌用服务端下发的 gain / peak（/song/url 返回字段），
// 本地文件则由 neaudioeffects.dll 的 ReplayGainProcessor 边播边 PushSamples 实时测量，
// 最终都汇成一句 `Loudness: on %s, playbackRef %f, gain %f, peak %f`
// —— 目标参考响度 + 每首歌增益 + 峰值削波保护。这里实现的是其中"实时测量"那一路。
//
// 注意这是 RMS 近似而非 ITU-R BS.1770 的 K 加权 LUFS：没有预加重与门限，
// 对比同类型内容足够用，跨类型（人声播客 vs 电子乐）会有一两 dB 的偏差。

/** ReplayGain 规范的参考电平约合 -18 dBFS，与标签路径共用同一基准，两条路才可比。 */
export const LOUDNESS_REFERENCE_DBFS = -18;

/** 单首最多修正 ±12 dB。超出这个范围多半是测量样本不可信，硬修会毁掉动态。 */
export const MAX_NORMALIZATION_DB = 12;

/** 少于 3 秒有效样本不下结论：前奏往往比全曲安静得多。 */
export const MIN_LOUDNESS_SAMPLE_COUNT = 48_000 * 3;

/** 低于这个电平的块视为静音，不计入统计，否则长前奏会把均值压垮。 */
const SILENCE_FLOOR_RMS = 1e-4;

export interface LoudnessAccumulator {
    sumSquares: number;
    sampleCount: number;
    peak: number;
}

export interface LoudnessNormalization {
    measuredDbfs: number;
    /** 未做削波保护的原始修正量，仅用于日志与排查。 */
    gainDb: number;
    effectiveGainDb: number;
    linearGain: number;
    peak: number;
}

export const createLoudnessAccumulator = (): LoudnessAccumulator => ({
    sumSquares: 0,
    sampleCount: 0,
    peak: 0,
});

export const dbfsFromRms = (rms: number): number => (rms > 0 ? 20 * Math.log10(rms) : Number.NEGATIVE_INFINITY);

/**
 * 累计一块时域样本。静音块整块丢弃而不是计零，避免前奏/间奏拉低均值。
 * 返回新对象，累加器本身不被就地修改。
 */
export const pushLoudnessBlock = (
    accumulator: LoudnessAccumulator,
    block: ArrayLike<number>,
): LoudnessAccumulator => {
    let sumSquares = 0;
    let peak = 0;

    for (let index = 0; index < block.length; index += 1) {
        const sample = block[index];
        sumSquares += sample * sample;
        const magnitude = Math.abs(sample);
        if (magnitude > peak) {
            peak = magnitude;
        }
    }

    if (block.length === 0 || Math.sqrt(sumSquares / block.length) < SILENCE_FLOOR_RMS) {
        return accumulator;
    }

    return {
        sumSquares: accumulator.sumSquares + sumSquares,
        sampleCount: accumulator.sampleCount + block.length,
        peak: Math.max(accumulator.peak, peak),
    };
};

/**
 * 样本够了就给出这首歌的均衡增益，否则返回 null 让调用方继续测。
 * 正增益同样受峰值约束，规则与标签路径的 calculateReplayGain 保持一致。
 */
export const resolveLoudnessNormalization = (
    accumulator: LoudnessAccumulator,
    referenceDbfs: number = LOUDNESS_REFERENCE_DBFS,
): LoudnessNormalization | null => {
    if (accumulator.sampleCount < MIN_LOUDNESS_SAMPLE_COUNT) {
        return null;
    }

    const measuredDbfs = dbfsFromRms(Math.sqrt(accumulator.sumSquares / accumulator.sampleCount));
    if (!Number.isFinite(measuredDbfs)) {
        return null;
    }

    const gainDb = Math.max(
        -MAX_NORMALIZATION_DB,
        Math.min(MAX_NORMALIZATION_DB, referenceDbfs - measuredDbfs),
    );

    // 峰值是本次测量窗口内的观测值，后半首可能更响，因此额外留 1 dB 余量。
    const clipSafeGainDb = accumulator.peak > 0 ? -20 * Math.log10(accumulator.peak) - 1 : Number.POSITIVE_INFINITY;
    const effectiveGainDb = gainDb > 0 ? Math.min(gainDb, clipSafeGainDb) : gainDb;

    return {
        measuredDbfs,
        gainDb,
        effectiveGainDb,
        linearGain: Math.pow(10, effectiveGainDb / 20),
        peak: accumulator.peak,
    };
};
