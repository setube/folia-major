// src/components/player-controls/controlSurface.ts
// 浮动播放控制栏的表面配色，全部从当前 dual theme 派生，不写死明暗两套 hex/rgba。
import type { Theme } from '../../types';
import { colorWithAlpha, mixColors } from '../visualizer/colorMix';

// 仅在 theme 缺失时兜底，正常渲染路径不会走到这里。
const FALLBACK_LIGHT = '#ffffff';
const FALLBACK_DARK = '#000000';

// 明暗两套只在"叠加强度"上有差异，底色与前景色始终来自 theme。
const SURFACE_ALPHA = {
    daylight: { expanded: 0.6, collapsed: 0.4, collapsedHover: 0.5, border: 0.35 },
    night: { expanded: 0.4, collapsed: 0.2, collapsedHover: 0.3, border: 0.18 },
} as const;

const INK_ALPHA = {
    daylight: { track: 0.08, hover: 0.06 },
    night: { track: 0.12, hover: 0.1 },
} as const;

// 边框朝前景色偏移的比例：足够勾出玻璃边缘，又不至于变成实线描边。
const BORDER_MIX_RATIO = 0.12;

export interface ControlSurfaceTokens {
    /** 展开态玻璃底色 */
    expandedBackground: string;
    /** 折叠态玻璃底色 */
    collapsedBackground: string;
    /** 折叠态悬停底色 */
    collapsedHoverBackground: string;
    /** 玻璃边缘描边 */
    borderColor: string;
    /** 进度条底轨 */
    trackColor: string;
    /** 图标按钮悬停底色 */
    hoverBackground: string;
}

/**
 * 依据当前主题派生控制栏配色。
 * `isDaylight` 只决定叠加强度，颜色本身一律取自 `theme`，因此换任意主题都能保持对比度。
 */
export const buildControlSurface = (theme: Theme | undefined, isDaylight: boolean): ControlSurfaceTokens => {
    const base = theme?.backgroundColor || (isDaylight ? FALLBACK_LIGHT : FALLBACK_DARK);
    const ink = theme?.primaryColor || (isDaylight ? FALLBACK_DARK : FALLBACK_LIGHT);
    const surface = isDaylight ? SURFACE_ALPHA.daylight : SURFACE_ALPHA.night;
    const inkAlpha = isDaylight ? INK_ALPHA.daylight : INK_ALPHA.night;

    return {
        expandedBackground: colorWithAlpha(base, surface.expanded),
        collapsedBackground: colorWithAlpha(base, surface.collapsed),
        collapsedHoverBackground: colorWithAlpha(base, surface.collapsedHover),
        borderColor: mixColors(base, ink, BORDER_MIX_RATIO, surface.border),
        trackColor: colorWithAlpha(ink, inkAlpha.track),
        hoverBackground: colorWithAlpha(ink, inkAlpha.hover),
    };
};
