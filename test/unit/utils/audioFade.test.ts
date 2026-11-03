import { describe, expect, it } from 'vitest';
import { AUDIO_FADE_DURATION_MS, AUDIO_FADE_DURATIONS, isAudioFadeDuration } from '@/utils/audioFade';

// test/unit/utils/audioFade.test.ts
// 淡入淡出的三档时长：fast 与淡变原先的固定时长（200ms）一致，三档严格递增。

describe('AUDIO_FADE_DURATION_MS', () => {
    it('fast 档等于原先的固定时长', () => {
        expect(AUDIO_FADE_DURATION_MS.fast).toBe(200);
    });

    it('三档时长严格递增', () => {
        expect(AUDIO_FADE_DURATION_MS.fast).toBeLessThan(AUDIO_FADE_DURATION_MS.standard);
        expect(AUDIO_FADE_DURATION_MS.standard).toBeLessThan(AUDIO_FADE_DURATION_MS.smooth);
    });

    it('每个档位都有时长', () => {
        for (const duration of AUDIO_FADE_DURATIONS) {
            expect(AUDIO_FADE_DURATION_MS[duration]).toBeGreaterThan(0);
        }
    });
});

describe('isAudioFadeDuration', () => {
    it('只接受三个已知档位', () => {
        expect(isAudioFadeDuration('standard')).toBe(true);
        expect(isAudioFadeDuration('instant')).toBe(false);
        expect(isAudioFadeDuration(null)).toBe(false);
    });
});
