import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MotionValue } from 'framer-motion';
import { PlayerState, LyricData, Theme, type PlayerLoopMode } from '../types';
import LyricsTimelineModal from './modal/LyricsTimelineModal';
import ExpandedView from './player-controls/ExpandedView';
import CollapsedView from './player-controls/CollapsedView';
import { buildControlSurface } from './player-controls/controlSurface';
import { useHoverExpansion } from './player-controls/useHoverExpansion';

const CONTROL_LAYOUT_SPRING = {
    type: 'spring' as const,
    stiffness: 280,
    damping: 24,
};

// 胶囊下方的透明缓冲区，让指针从底部靠近时不会先掉出命中区导致抖动。
const HOVER_HITBOX_BOTTOM_BUFFER_PX = 32;

interface FloatingPlayerControlsProps {
    currentSong: { name: string; artists?: { name: string }[] } | null;
    playerState: PlayerState;
    currentTime: MotionValue<number>;
    lyricCurrentTime?: MotionValue<number>;
    duration: number;
    loopMode: PlayerLoopMode;
    currentView: 'home' | 'player';
    audioSrc: string | null;
    canTogglePlay?: boolean;
    lyrics: LyricData | null;
    onSeek: (time: number) => void;
    onTogglePlay: () => void;
    onToggleLoop: () => void;
    onNextTrack?: () => void;
    onPrevTrack?: () => void;
    onToggleQueue?: () => void;
    onNavigateToPlayer: () => void;
    noTrackText?: string;
    primaryColor?: string;
    secondaryColor?: string;
    theme?: Theme;
    isDaylight: boolean;
    isHidden?: boolean;
    hideControlBar?: boolean;
    controlsDisabled?: boolean;
}

const FloatingPlayerControls: React.FC<FloatingPlayerControlsProps> = ({
    currentSong,
    playerState,
    currentTime,
    lyricCurrentTime,
    duration,
    loopMode,
    currentView,
    canTogglePlay = false,
    lyrics,
    onSeek,
    onTogglePlay,
    onToggleLoop,
    onNextTrack,
    onPrevTrack,
    onToggleQueue,
    onNavigateToPlayer,
    noTrackText = 'No Track',
    primaryColor = 'var(--text-primary)',
    secondaryColor = 'var(--text-secondary)',
    theme,
    isDaylight,
    isHidden = false,
    hideControlBar = false,
    controlsDisabled = false,
}) => {
    const tokens = buildControlSurface(theme, isDaylight);
    const { isHovered, handleMouseEnter, handleMouseLeave } = useHoverExpansion();
    const [isTimelineOpen, setIsTimelineOpen] = useState(false);

    // 暂停时自动展开，让用户不必先悬停就能看到控件；首页保持折叠，避免遮挡内容。
    const canAutoExpand = canTogglePlay && duration > 0;
    const showExpanded = isHovered || (canAutoExpand && playerState !== PlayerState.PLAYING && currentView !== 'home');

    const handleClick = () => {
        if (currentView === 'home') {
            onNavigateToPlayer();
        }
    };

    if (hideControlBar) {
        return null;
    }

    const surfaceStyle = {
        backgroundColor: showExpanded ? tokens.expandedBackground : tokens.collapsedBackground,
        borderColor: tokens.borderColor,
        '--control-collapsed-hover': tokens.collapsedHoverBackground,
    } as React.CSSProperties;

    return (
        <>
            <motion.div
                className={`absolute bottom-8 left-1/2 -translate-x-1/2 z-60 w-full flex justify-center transition-all duration-300 pointer-events-none
                    ${currentView === 'home' ? 'max-w-[calc(100vw-120px)] md:max-w-lg' : 'max-w-lg px-4'}`}
                initial={false}
                animate={{
                    opacity: isHidden ? 0 : 1,
                    y: isHidden ? 24 : 0,
                    scale: isHidden ? 0.97 : 1,
                }}
                transition={{ duration: 0.26, ease: 'easeOut' }}
                style={{ pointerEvents: isHidden ? 'none' : 'auto' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div
                    className="pointer-events-auto w-full flex justify-center"
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    style={{
                        paddingBottom: `${HOVER_HITBOX_BOTTOM_BUFFER_PX}px`,
                        marginBottom: `${-HOVER_HITBOX_BOTTOM_BUFFER_PX}px`,
                    }}
                >
                    <motion.div
                        layout
                        transition={{ layout: CONTROL_LAYOUT_SPRING }}
                        onClick={handleClick}
                        className={`backdrop-blur-3xl border shadow-2xl overflow-hidden cursor-pointer rounded-full relative transition-colors duration-300
                            ${showExpanded ? 'p-3 w-full shadow-xl' : 'px-4 py-2 w-[80%] md:w-[60%] shadow-lg hover:bg-(--control-collapsed-hover)'}`}
                        style={surfaceStyle}
                    >
                        <motion.div layout transition={{ layout: CONTROL_LAYOUT_SPRING }} className="w-full">
                            {showExpanded ? (
                                <ExpandedView
                                    currentSong={currentSong}
                                    playerState={playerState}
                                    currentTime={currentTime}
                                    duration={duration}
                                    loopMode={loopMode}
                                    canTogglePlay={canTogglePlay}
                                    onSeek={onSeek}
                                    onTogglePlay={onTogglePlay}
                                    onToggleLoop={onToggleLoop}
                                    onToggleTimeline={() => setIsTimelineOpen(true)}
                                    onNextTrack={onNextTrack}
                                    onPrevTrack={onPrevTrack}
                                    onToggleQueue={onToggleQueue}
                                    noTrackText={noTrackText}
                                    primaryColor={primaryColor}
                                    secondaryColor={secondaryColor}
                                    hasLyrics={!!lyrics}
                                    tokens={tokens}
                                    controlsDisabled={controlsDisabled}
                                />
                            ) : (
                                <CollapsedView
                                    currentTime={currentTime}
                                    duration={duration}
                                    onSeek={onSeek}
                                    primaryColor={primaryColor}
                                    secondaryColor={secondaryColor}
                                    tokens={tokens}
                                    controlsDisabled={controlsDisabled}
                                />
                            )}
                        </motion.div>
                    </motion.div>
                </div>
            </motion.div>

            <LyricsTimelineModal
                isOpen={isTimelineOpen}
                onClose={() => setIsTimelineOpen(false)}
                lyrics={lyrics}
                duration={duration}
                currentTime={lyricCurrentTime ?? currentTime}
                onSeek={(time) => {
                    const offset = currentTime.get() - (lyricCurrentTime?.get() ?? currentTime.get());
                    onSeek(Math.max(0, time + offset));
                }}
                primaryColor={primaryColor}
                secondaryColor={secondaryColor}
                accentColor="var(--text-accent)"
                theme={theme}
                isDaylight={isDaylight}
                disabled={controlsDisabled}
            />
        </>
    );
};

export default FloatingPlayerControls;
