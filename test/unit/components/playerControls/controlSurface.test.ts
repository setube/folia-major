import { describe, expect, it } from 'vitest';
import { buildControlSurface } from '../../../../src/components/player-controls/controlSurface';
import type { Theme } from '../../../../src/types';

const makeTheme = (overrides: Partial<Theme> = {}): Theme => ({
    name: 'Test',
    backgroundColor: '#101014',
    primaryColor: '#f5f5f7',
    accentColor: '#7aa2f7',
    secondaryColor: '#9aa0aa',
    fontStyle: 'sans',
    ...overrides,
} as Theme);

const RGBA = /^rgba\(\d+, \d+, \d+, [\d.]+\)$/;

describe('buildControlSurface', () => {
    it('派生出的每个色值都是合法 rgba', () => {
        const tokens = buildControlSurface(makeTheme(), false);

        Object.values(tokens).forEach(value => {
            expect(value).toMatch(RGBA);
        });
    });

    it('底色跟随主题 backgroundColor 变化，而不是写死明暗两套', () => {
        const dark = buildControlSurface(makeTheme({ backgroundColor: '#101014' }), false);
        const teal = buildControlSurface(makeTheme({ backgroundColor: '#0b3d3b' }), false);

        expect(dark.expandedBackground).not.toBe(teal.expandedBackground);
        expect(teal.expandedBackground).toContain('11, 61, 59');
    });

    it('轨道与激活态底色跟随主题 primaryColor 变化', () => {
        const light = buildControlSurface(makeTheme({ primaryColor: '#ffffff' }), false);
        const inked = buildControlSurface(makeTheme({ primaryColor: '#1a1a1a' }), false);

        expect(light.trackColor).not.toBe(inked.trackColor);
        expect(inked.activeToggleBackground).toContain('26, 26, 26');
    });

    it('明亮模式下叠加更实，暗色模式下叠加更透', () => {
        const theme = makeTheme();
        const daylight = buildControlSurface(theme, true);
        const night = buildControlSurface(theme, false);

        const alphaOf = (rgba: string) => Number(rgba.slice(rgba.lastIndexOf(',') + 1, -1));

        expect(alphaOf(daylight.expandedBackground)).toBeGreaterThan(alphaOf(night.expandedBackground));
        expect(alphaOf(daylight.collapsedBackground)).toBeGreaterThan(alphaOf(night.collapsedBackground));
    });

    it('折叠态悬停底色比静息态更实，保证悬停有反馈', () => {
        const tokens = buildControlSurface(makeTheme(), false);
        const alphaOf = (rgba: string) => Number(rgba.slice(rgba.lastIndexOf(',') + 1, -1));

        expect(alphaOf(tokens.collapsedHoverBackground)).toBeGreaterThan(alphaOf(tokens.collapsedBackground));
    });

    it('主题缺失时回落到中性底色而不是崩溃', () => {
        const daylight = buildControlSurface(undefined, true);
        const night = buildControlSurface(undefined, false);

        expect(daylight.expandedBackground).toContain('255, 255, 255');
        expect(night.expandedBackground).toContain('0, 0, 0');
    });
});
