import { describe, expect, it } from 'vitest';
import { planPosterOpening, type BravaisFrameInput } from '@/library/suites/bravais/bravaisFrame';
import { posterScreenBox, resolvePosterRevealCenter } from '@/library/suites/bravais/bravaisPosterReveal';

// test/unit/library/bravais/bravaisPosterReveal.test.ts
// 海报在场时的键盘让位：按倾斜后画出来的样子让磁贴完整可见（左右也挪，不再只上下）；能让海报整张张开时优先，往回走时
// 海报重新张开。

const view = { width: 1600, height: 900, scale: 0.76 };
const POSTER = 680;
const PAD = 24;
const INSET = 96;
const plan = planPosterOpening({ center: { x: 0, y: 0 }, view, width: POSTER });

const frameAt = (center = plan.center, tiltDeg = -10): BravaisFrameInput => ({
    center,
    view,
    anchorX: plan.anchorX,
    openWidth: POSTER,
    contentWidth: POSTER,
    hidden: false,
    poster: true,
    tiltDeg,
});

const tile = (dx: number, dy: number) => ({ x: plan.anchorX + dx, y: plan.center.y + dy, width: 200, height: 200 });

const reveal = (rect: ReturnType<typeof tile>, frame = frameAt()) => resolvePosterRevealCenter({
    rect,
    frame,
    posterWidth: POSTER,
    pad: PAD,
    bottomInset: INSET,
});

const expectOnScreen = (rect: ReturnType<typeof tile>, frame: BravaisFrameInput) => {
    const box = posterScreenBox(rect, frame);
    expect(box.left).toBeGreaterThanOrEqual(PAD - 1);
    expect(box.right).toBeLessThanOrEqual(view.width - PAD + 1);
    expect(box.top).toBeGreaterThanOrEqual(PAD - 1);
    expect(box.bottom).toBeLessThanOrEqual(view.height - INSET + 1);
};

describe('poster reveal', () => {
    it('stays put when the tile already shows beside the open poster', () => {
        const rect = tile(150, -100);
        expectOnScreen(rect, frameAt());
        expect(reveal(rect)).toEqual(plan.center);
    });

    it('pans right to a tile past the right edge, measured on the tilted wall', () => {
        const rect = tile(3000, -100);
        expect(posterScreenBox(rect, frameAt()).right).toBeGreaterThan(view.width);
        const next = reveal(rect);
        expect(next.x).toBeGreaterThan(plan.center.x);
        expectOnScreen(rect, frameAt(next));
    });

    it('follows a tile that the tilt lifts above the top edge', () => {
        // 倾斜 −10° 时右边的磁贴被抬高：没倾斜时看得见的，倾斜后可能出了上缘。
        const rect = tile(1100, -480);
        expect(posterScreenBox(rect, frameAt(plan.center, 0)).top).toBeGreaterThan(-1);
        expect(posterScreenBox(rect, frameAt()).top).toBeLessThan(PAD);
        const next = reveal(rect);
        expectOnScreen(rect, frameAt(next));
    });

    it('reopens the poster when coming back to a tile that fits beside it', () => {
        const far = reveal(tile(3000, -100));
        const rect = tile(150, -100);
        const back = reveal(rect, frameAt(far));
        expect(back.x).toBeCloseTo(plan.center.x, 3);
        expectOnScreen(rect, frameAt(back));
    });

    it('works without the tilt (reduced motion)', () => {
        const rect = tile(3000, 600);
        const next = reveal(rect, frameAt(plan.center, 0));
        expectOnScreen(rect, frameAt(next, 0));
    });
});
