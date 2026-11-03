import { describe, expect, it } from 'vitest';
import { getSeamBoundaryX, isSeamBoundaryX } from '@/components/wall/seamPlan';
import { getViewLineX } from '@/components/wall/wallView';
import {
    BRAVAIS_METRICS,
    BRAVAIS_SEAM_FULL_WIDTH,
    BRAVAIS_SEAM_POSTER_MAX_WIDTH,
    BRAVAIS_SEAM_POSTER_MIN_WIDTH,
} from '@/library/suites/bravais/bravaisConstants';
import { computeBravaisFrame, getTiltReach, planPosterOpening, posterSafeArea, withTilt } from '@/library/suites/bravais/bravaisFrame';
import {
    resolvePosterWidth,
    resolveSeamTarget,
    resolveVariantWidth,
    type BravaisSeamTargetInput,
} from '@/library/suites/bravais/bravaisSeamTarget';
import { scrapWords, splitHeroWord } from '@/library/suites/bravais/BravaisSeamPoster';
import type { BravaisItem } from '@/library/suites/bravais/bravaisLayer';

// test/unit/library/bravais/bravaisPoster.test.ts
// 歌手页海报：什么时候缝画成海报（只在歌手页、无限拼贴、用户选的完整等级上；过滤框、面板、表单、书脊、折叠都回到原来那套），
// 海报的宽度，每帧的几何（仍是墙上裂开的一列：两半墙各让半个开口，贴着视口边也不收窄，倾斜绕海报右缘），相机把裂开的
// 块边界带到最左边，倾斜时海报内容缩进的安全区，以及热门歌名里放大的那个词。

const artistInput = (patch: Partial<BravaisSeamTargetInput> = {}): BravaisSeamTargetInput => ({
    surface: 'artist',
    level: 'full',
    viewportWidth: 1440,
    poster: true,
    ...patch,
});

describe('poster seam target', () => {
    it('draws the artist page at the full level as the poster', () => {
        expect(resolveSeamTarget(artistInput())).toEqual({ width: resolvePosterWidth(1440), variant: 'poster' });
    });

    it('falls back to the plain seam for the filter, the panel, the form and the other levels', () => {
        expect(resolveSeamTarget(artistInput({ filterOpen: true }))).toEqual({ width: BRAVAIS_SEAM_FULL_WIDTH, variant: 'full' });
        expect(resolveSeamTarget(artistInput({ formOpen: true })).variant).toBe('form');
        expect(resolveSeamTarget(artistInput({ panelOpen: true })).variant).toBe('panel');
        expect(resolveSeamTarget(artistInput({ level: 'spine' })).variant).toBe('spine');
        expect(resolveSeamTarget(artistInput({ level: 'hidden' })).variant).toBe('none');
    });

    it('only applies to layers the stage allows (artist and album pages, not the finite wall)', () => {
        expect(resolveSeamTarget(artistInput({ poster: false })).variant).toBe('full');
        expect(resolveSeamTarget(artistInput({ surface: 'collection', poster: false })).variant).toBe('full');
        expect(resolveSeamTarget(artistInput({ surface: 'collection' })).variant).toBe('poster');
    });

    it('takes 46% of the viewport, clamped', () => {
        expect(resolvePosterWidth(1000)).toBe(BRAVAIS_SEAM_POSTER_MIN_WIDTH);
        expect(resolvePosterWidth(1300)).toBe(598);
        expect(resolvePosterWidth(2560)).toBe(BRAVAIS_SEAM_POSTER_MAX_WIDTH);
        expect(resolveVariantWidth('poster', 1300)).toBe(598);
    });
});

describe('poster frame', () => {
    const view = { width: 1200, height: 800, scale: 0.5 };

    it('is still a split in the wall, flush with the left edge', () => {
        const plan = planPosterOpening({ center: { x: 0, y: 0 }, view, width: 560 });
        const frame = computeBravaisFrame({
            center: plan.center, view, anchorX: plan.anchorX, openWidth: 560, contentWidth: 560, hidden: false, poster: true,
        });
        expect(frame.seam.x).toBeCloseTo(280);
        expect(frame.seam.width).toBeCloseTo(560);
        expect(frame.left.x).toBeLessThan(frame.right.x - 560);
        expect(frame.contentOpacity).toBe(1);
        expect(frame.tab.visible).toBe(false);
    });

    it('narrows at the edge like any seam without the poster flag', () => {
        const plan = planPosterOpening({ center: { x: 0, y: 0 }, view, width: 560 });
        const frame = computeBravaisFrame({
            center: plan.center, view, anchorX: plan.anchorX, openWidth: 560, contentWidth: 560, hidden: false,
        });
        expect(frame.seam.width).toBeLessThan(560);
    });

    it('tilts the halves and the seam around the poster edge at half height', () => {
        const plan = planPosterOpening({ center: { x: 0, y: 0 }, view, width: 560 });
        const frame = computeBravaisFrame({
            center: plan.center, view, anchorX: plan.anchorX, openWidth: 560, contentWidth: 560, hidden: false, poster: true, tiltDeg: -10,
        });
        expect(frame.tilt.deg).toBe(-10);
        expect(frame.tilt.pivotX).toBeCloseTo(560);
        expect(frame.tilt.pivotY).toBe(400);
        expect(withTilt('scale(1)', { deg: -10, pivotX: 560, pivotY: 400 })).toBe('translate(560px, 400px) rotate(-10deg) translate(-560px, -400px) scale(1)');
        expect(withTilt('scale(1)', { deg: 0, pivotX: 560, pivotY: 400 })).toBe('scale(1)');
    });

    it('opens on a block boundary and keeps the preferred one (the crack next to the clicked tile)', () => {
        const plan = planPosterOpening({ center: { x: 333, y: 12 }, view, width: 560 });
        expect(isSeamBoundaryX(plan.anchorX, BRAVAIS_METRICS)).toBe(true);
        expect(plan.center.y).toBe(12);
        expect(getViewLineX(view) + (plan.anchorX - plan.center.x) * view.scale).toBeCloseTo(280);
        const preferX = getSeamBoundaryX(3, BRAVAIS_METRICS);
        expect(planPosterOpening({ center: { x: 0, y: 0 }, view, width: 560, preferX }).anchorX).toBe(preferX);
    });
});

describe('posterSafeArea', () => {
    const corners = (width: number, height: number, deg: number) => {
        const { scale, offsetY } = posterSafeArea({ width, height, deg });
        const radians = deg * Math.PI / 180;
        return [[width - scale * width, offsetY], [width, offsetY], [width - scale * width, offsetY + scale * height], [width, offsetY + scale * height]]
            .map(([x, y]) => {
                const rx = x - width;
                const ry = y - height / 2;
                return [width + rx * Math.cos(radians) - ry * Math.sin(radians), height / 2 + rx * Math.sin(radians) + ry * Math.cos(radians)];
            });
    };

    it('does nothing without a tilt', () => {
        expect(posterSafeArea({ width: 640, height: 860, deg: 0 })).toEqual({ scale: 1, offsetY: 0 });
    });

    it('shrinks the poster so all four corners stay on screen when tilted', () => {
        for (const [width, height] of [[640, 860], [520, 700], [680, 1300]]) {
            const { scale } = posterSafeArea({ width, height, deg: -10 });
            expect(scale).toBeLessThan(1);
            expect(scale).toBeGreaterThan(0.75);
            for (const [x, y] of corners(width, height, -10)) {
                expect(x).toBeGreaterThanOrEqual(13.9);
                expect(y).toBeGreaterThanOrEqual(13.9);
                expect(y).toBeLessThanOrEqual(height - 13.9);
            }
        }
    });
});

describe('splitHeroWord', () => {
    const hero = (title: string) => splitHeroWord(title).filter(part => part.hero).map(part => part.text);

    it('enlarges the longest word', () => {
        expect(splitHeroWord('Track 20 Amber').map(part => part.text).join('')).toBe('Track 20 Amber');
        expect(hero('Love in the afternoon')).toEqual(['afternoon']);
    });

    it('enlarges nothing when the title is a single word', () => {
        expect(hero('Yesterday')).toEqual([]);
    });
});

describe('scrapWords', () => {
    const items = (...titles: string[]) => titles.map(title => ({ title }) as BravaisItem);

    it('takes the enlarged word of the first two top songs', () => {
        expect(scrapWords(items('Love in the afternoon', 'Blue Monday', 'Yesterday'))).toEqual(['afternoon', 'Monday']);
    });

    it('never repeats a word: a clash falls back to the next longest word of that title', () => {
        expect(scrapWords(items('Track 20 Amber', 'Track 21 Birch', 'Track 22 Cedar'))).toEqual(['Track', 'Birch']);
        expect(scrapWords(items('Rain', 'rain', 'RAIN'))).toEqual(['Ra']);
    });
});

describe('getTiltReach', () => {
    const view = { width: 1440, height: 900 };

    it('does not move the bounds without a tilt', () => {
        expect(getTiltReach(view, { deg: 0, pivotX: 400, pivotY: 450 })).toEqual({ left: 0, right: 0, top: 0, bottom: 0 });
    });

    it('widens a little around a pivot on screen', () => {
        const reach = getTiltReach(view, { deg: -10, pivotX: 600, pivotY: 450 });
        for (const side of [reach.left, reach.right, reach.top, reach.bottom]) {
            expect(side).toBeGreaterThan(0);
            expect(side).toBeLessThan(300);
        }
    });

    it('shifts the whole box when the pivot is dragged far off screen, instead of only growing', () => {
        // 支点在视口左边 4000px：反转回去的视口整块往下挪约 4000 × sin10° ≈ 700px（下边往外、上边往里）。
        const reach = getTiltReach(view, { deg: -10, pivotX: -4000, pivotY: 450 });
        expect(reach.bottom).toBeGreaterThan(600);
        expect(reach.top).toBeLessThan(-400);
        // 高度只多了转出来的那点，没有随距离变大。
        expect(view.height + reach.top + reach.bottom).toBeLessThan(view.height + 300);
    });
});
