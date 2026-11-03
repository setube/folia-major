import { describe, expect, it } from 'vitest';
import { resolveSeamTabsFit } from '@/library/suites/bravais/useBravaisSeamTabsFit';

// test/unit/library/bravais/bravaisSeamTabsFit.test.ts
// 首页窄缝的退让顺序：带标题 + 入口 → 不带标题 + 入口 → 不带标题、入口挪进菜单 → 缩成一个字（入口仍在菜单里）。
// 级别只看副本的高，与此刻是哪一级无关。

const sizes = { pad: 18, titledHead: 400, bareHead: 370, withShortcuts: 300, withoutShortcuts: 220 };

describe('resolveSeamTabsFit', () => {
    it('gives way in order: the title, then the jump-ins, then the full tab names', () => {
        expect(resolveSeamTabsFit({ ...sizes, available: 718 })).toEqual({ level: 'titled', shortcuts: true });
        expect(resolveSeamTabsFit({ ...sizes, available: 717 })).toEqual({ level: 'untitled', shortcuts: true });
        expect(resolveSeamTabsFit({ ...sizes, available: 688 })).toEqual({ level: 'untitled', shortcuts: true });
        expect(resolveSeamTabsFit({ ...sizes, available: 687 })).toEqual({ level: 'untitled', shortcuts: false });
        expect(resolveSeamTabsFit({ ...sizes, available: 608 })).toEqual({ level: 'untitled', shortcuts: false });
        expect(resolveSeamTabsFit({ ...sizes, available: 607 })).toEqual({ level: 'short', shortcuts: false });
    });

    it('without jump-ins the two copies are the same and the old order holds', () => {
        const bare = { ...sizes, withShortcuts: 220 };
        expect(resolveSeamTabsFit({ ...bare, available: 638 })).toEqual({ level: 'titled', shortcuts: true });
        expect(resolveSeamTabsFit({ ...bare, available: 608 })).toEqual({ level: 'untitled', shortcuts: true });
        expect(resolveSeamTabsFit({ ...bare, available: 607 })).toEqual({ level: 'short', shortcuts: false });
    });
});
