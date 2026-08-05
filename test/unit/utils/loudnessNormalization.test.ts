import { describe, expect, it } from 'vitest';
import {
    LOUDNESS_REFERENCE_DBFS,
    MAX_NORMALIZATION_DB,
    MIN_LOUDNESS_SAMPLE_COUNT,
    createLoudnessAccumulator,
    dbfsFromRms,
    pushLoudnessBlock,
    resolveLoudnessNormalization,
} from '@/utils/loudnessNormalization';
import type { LoudnessAccumulator } from '@/utils/loudnessNormalization';

// test/unit/utils/loudnessNormalization.test.ts
// 锁定无 ReplayGain 标签时的实时测量兜底：静音块不计入、样本不足不下结论、
// 正增益受峰值约束、修正量有上限。

/** 生成一块恒定幅度的方波样本，RMS 恰好等于 amplitude，便于反推 dBFS。 */
const constantBlock = (amplitude: number, length = 2048): Float32Array => {
    const block = new Float32Array(length);
    for (let index = 0; index < length; index += 1) {
        block[index] = index % 2 === 0 ? amplitude : -amplitude;
    }
    return block;
};

const fill = (amplitude: number, sampleCount: number): LoudnessAccumulator => {
    let accumulator = createLoudnessAccumulator();
    const block = constantBlock(amplitude);
    while (accumulator.sampleCount < sampleCount) {
        accumulator = pushLoudnessBlock(accumulator, block);
    }
    return accumulator;
};

describe('dbfsFromRms', () => {
    it('满幅为 0 dBFS，零输入为负无穷', () => {
        expect(dbfsFromRms(1)).toBeCloseTo(0, 8);
        expect(dbfsFromRms(0.5)).toBeCloseTo(-6.0206, 3);
        expect(dbfsFromRms(0)).toBe(Number.NEGATIVE_INFINITY);
    });
});

describe('pushLoudnessBlock', () => {
    it('静音块整块丢弃，长前奏不会把均值压垮', () => {
        const accumulator = pushLoudnessBlock(createLoudnessAccumulator(), constantBlock(1e-6));

        expect(accumulator.sampleCount).toBe(0);
    });

    it('空块不改变累加器', () => {
        const accumulator = pushLoudnessBlock(createLoudnessAccumulator(), new Float32Array(0));

        expect(accumulator.sampleCount).toBe(0);
    });

    it('累计样本数与峰值，且不就地修改入参', () => {
        const initial = createLoudnessAccumulator();
        const first = pushLoudnessBlock(initial, constantBlock(0.2));
        const second = pushLoudnessBlock(first, constantBlock(0.6));

        expect(initial.sampleCount).toBe(0);
        expect(first.peak).toBeCloseTo(0.2, 6);
        expect(second.peak).toBeCloseTo(0.6, 6);
        expect(second.sampleCount).toBe(first.sampleCount * 2);
    });
});

describe('resolveLoudnessNormalization', () => {
    it('样本不足时返回 null，让调用方继续测', () => {
        expect(resolveLoudnessNormalization(fill(0.1, 1024))).toBeNull();
    });

    it('把偏轻的内容拉到参考电平', () => {
        // RMS = 0.05 → 约 -26 dBFS，距 -18 dBFS 还差约 8 dB。
        const normalization = resolveLoudnessNormalization(fill(0.05, MIN_LOUDNESS_SAMPLE_COUNT));

        expect(normalization).not.toBeNull();
        expect(normalization!.measuredDbfs).toBeCloseTo(-26.02, 1);
        expect(normalization!.gainDb).toBeCloseTo(LOUDNESS_REFERENCE_DBFS + 26.02, 1);
    });

    it('正增益不得把峰值推过 0 dBFS，并额外留 1 dB 余量', () => {
        const normalization = resolveLoudnessNormalization(fill(0.05, MIN_LOUDNESS_SAMPLE_COUNT))!;
        // 方波的峰值等于 RMS，削波上限即 -20log10(0.05) - 1 ≈ 25.02 dB，
        // 大于 8 dB 的需求，因此这里不该被削。
        expect(normalization.effectiveGainDb).toBeCloseTo(normalization.gainDb, 6);

        // 峰值接近满幅时，正增益必须被压到接近 0。
        let loudPeak = fill(0.05, MIN_LOUDNESS_SAMPLE_COUNT);
        loudPeak = { ...loudPeak, peak: 0.99 };
        const clipped = resolveLoudnessNormalization(loudPeak)!;
        expect(clipped.effectiveGainDb).toBeLessThan(clipped.gainDb);
        expect(clipped.effectiveGainDb).toBeLessThan(0);
    });

    it('修正量上限为 ±12 dB，极端素材不会被硬压', () => {
        const veryQuiet = resolveLoudnessNormalization(fill(0.001, MIN_LOUDNESS_SAMPLE_COUNT))!;
        const veryLoud = resolveLoudnessNormalization(fill(0.9, MIN_LOUDNESS_SAMPLE_COUNT))!;

        expect(veryQuiet.gainDb).toBe(MAX_NORMALIZATION_DB);
        expect(veryLoud.gainDb).toBe(-MAX_NORMALIZATION_DB);
        expect(veryLoud.linearGain).toBeCloseTo(Math.pow(10, -MAX_NORMALIZATION_DB / 20), 8);
    });

    it('linearGain 与 effectiveGainDb 始终一致', () => {
        const normalization = resolveLoudnessNormalization(fill(0.08, MIN_LOUDNESS_SAMPLE_COUNT))!;

        expect(normalization.linearGain).toBeCloseTo(Math.pow(10, normalization.effectiveGainDb / 20), 8);
    });
});
