// src/components/player-controls/CollapsedView.tsx
// 折叠态：只保留可拖拽的进度条，命中区铺满整条胶囊。
import React from 'react';
import { MotionValue } from 'framer-motion';
import ProgressBar from '../ProgressBar';
import type { ControlSurfaceTokens } from './controlSurface';

export interface CollapsedViewProps {
    currentTime: MotionValue<number>;
    duration: number;
    onSeek: (time: number) => void;
    primaryColor: string;
    secondaryColor: string;
    tokens: ControlSurfaceTokens;
    controlsDisabled?: boolean;
}

const CollapsedView: React.FC<CollapsedViewProps> = ({
    currentTime,
    duration,
    onSeek,
    primaryColor,
    secondaryColor,
    tokens,
    controlsDisabled = false,
}) => {
    return (
        <div className="flex h-8 w-full items-center justify-center px-4">
            <ProgressBar
                currentTime={currentTime}
                duration={duration}
                onSeek={onSeek}
                primaryColor={primaryColor}
                secondaryColor={secondaryColor}
                trackColor={tokens.trackColor}
                disabled={controlsDisabled}
                collapsed
            />
        </div>
    );
};

export default CollapsedView;
