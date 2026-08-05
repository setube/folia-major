// src/components/player-controls/useHoverExpansion.ts
// 控制栏的悬停展开/折叠计时：进入要快（避免手感迟钝），离开要缓（避免指针掠过就抖动）。
import { useEffect, useRef, useState } from 'react';

const HOVER_EXPAND_DELAY_MS = 20;
const HOVER_COLLAPSE_DELAY_MS = 100;

export interface HoverExpansion {
    isHovered: boolean;
    handleMouseEnter: () => void;
    handleMouseLeave: () => void;
}

export const useHoverExpansion = (): HoverExpansion => {
    const [isHovered, setIsHovered] = useState(false);
    const expandTimeoutRef = useRef<number | null>(null);
    const collapseTimeoutRef = useRef<number | null>(null);

    useEffect(() => {
        return () => {
            if (expandTimeoutRef.current !== null) {
                window.clearTimeout(expandTimeoutRef.current);
            }
            if (collapseTimeoutRef.current !== null) {
                window.clearTimeout(collapseTimeoutRef.current);
            }
        };
    }, []);

    const handleMouseEnter = () => {
        if (collapseTimeoutRef.current !== null) {
            window.clearTimeout(collapseTimeoutRef.current);
            collapseTimeoutRef.current = null;
        }

        if (expandTimeoutRef.current !== null) {
            return;
        }

        expandTimeoutRef.current = window.setTimeout(() => {
            setIsHovered(true);
            expandTimeoutRef.current = null;
        }, HOVER_EXPAND_DELAY_MS);
    };

    const handleMouseLeave = () => {
        if (expandTimeoutRef.current !== null) {
            window.clearTimeout(expandTimeoutRef.current);
            expandTimeoutRef.current = null;
        }

        if (!isHovered || collapseTimeoutRef.current !== null) {
            return;
        }

        collapseTimeoutRef.current = window.setTimeout(() => {
            setIsHovered(false);
            collapseTimeoutRef.current = null;
        }, HOVER_COLLAPSE_DELAY_MS);
    };

    return { isHovered, handleMouseEnter, handleMouseLeave };
};
