import { describe, expect, it } from 'vitest';
import { AUDIO_FADE_DURATION_MS, isAudioFadeDuration, rampGainTo, resolveFadeMs } from '@/utils/audioFade';
import type { FadeRampParam } from '@/utils/audioFade';

// test/unit/utils/audioFade.test.ts
// 锁定淡变时长的场景缩放，以及斜坡调度必须从"当前真实增益"起步——
// 打断进行中的淡变时若从上一次的目标值起算，听感上就是一次跳变。

const createParamSpy = (initialValue: number) => {
    const calls: Array<[string, number, number]> = [];
    const param: FadeRampParam = {
        value: initialValue,
        cancelScheduledValues(startTime) {
            calls.push(['cancel', 0, startTime]);
        },
        setValueAtTime(value, startTime) {
            calls.push(['set', value, startTime]);
        },
        linearRampToValueAtTime(value, endTime) {
            calls.push(['ramp', value, endTime]);
        },
    };

    return { param, calls };
};

describe('resolveFadeMs', () => {
    it('关闭开关时任何场景都返回 0，调用方走直接赋值的旧路径', () => {
        expect(resolveFadeMs(false, 'smooth', 'pause')).toBe(0);
        expect(resolveFadeMs(false, 'smooth', 'trackStart')).toBe(0);
    });

    it('暂停与恢复使用档位原始时长', () => {
        expect(resolveFadeMs(true, 'standard', 'pause')).toBe(AUDIO_FADE_DURATION_MS.standard);
        expect(resolveFadeMs(true, 'fast', 'resume')).toBe(AUDIO_FADE_DURATION_MS.fast);
    });

    it('拖动进度只用一小段遮蔽，切歌起播比暂停恢复更从容', () => {
        expect(resolveFadeMs(true, 'standard', 'seek')).toBeLessThan(resolveFadeMs(true, 'standard', 'pause'));
        expect(resolveFadeMs(true, 'standard', 'trackStart')).toBeGreaterThan(resolveFadeMs(true, 'standard', 'pause'));
    });

    it('三档时长严格递增', () => {
        expect(AUDIO_FADE_DURATION_MS.fast).toBeLessThan(AUDIO_FADE_DURATION_MS.standard);
        expect(AUDIO_FADE_DURATION_MS.standard).toBeLessThan(AUDIO_FADE_DURATION_MS.smooth);
    });
});

describe('isAudioFadeDuration', () => {
    it('只接受三个已知档位', () => {
        expect(isAudioFadeDuration('standard')).toBe(true);
        expect(isAudioFadeDuration('instant')).toBe(false);
        expect(isAudioFadeDuration(null)).toBe(false);
    });
});

describe('rampGainTo', () => {
    it('时长为 0 时直接赋值，不排斜坡', () => {
        const { param, calls } = createParamSpy(0.4);

        rampGainTo(param, 10, 0.8, 0);

        expect(calls).toEqual([['cancel', 0, 10], ['set', 0.8, 10]]);
    });

    it('先锚定当前真实增益再斜坡，避免打断上一段淡变时跳变', () => {
        const { param, calls } = createParamSpy(0.25);

        rampGainTo(param, 2, 1, 400);

        expect(calls[0]).toEqual(['cancel', 0, 2]);
        expect(calls[1]).toEqual(['set', 0.25, 2]);
        expect(calls[2][0]).toBe('ramp');
        expect(calls[2][1]).toBe(1);
        expect(calls[2][2]).toBeCloseTo(2.4, 8);
    });
});
