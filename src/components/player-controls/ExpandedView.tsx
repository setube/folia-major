// src/components/player-controls/ExpandedView.tsx
// 展开态按网易云客户端的排布：左(歌名/歌手) — 中(模式·上一首·播放·下一首·列表) — 右(歌词时间轴)，进度条通栏压在最后一行。
// 中间列取 auto、两侧取等宽 1fr，因此主控件组始终位于胶囊正中，不随两侧内容长度漂移。
import React from 'react';
import {
    Play, Pause, Repeat, Repeat1, RepeatOff, Shuffle,
    SkipBack, SkipForward, ListMusic, ChartBar, type LucideIcon,
} from 'lucide-react';
import { MotionValue } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import ProgressBar from '../ProgressBar';
import { PlayerState, type PlayerLoopMode } from '../../types';
import type { ControlSurfaceTokens } from './controlSurface';

const LOOP_ICONS: Partial<Record<PlayerLoopMode, LucideIcon>> = {
    off: RepeatOff,
    one: Repeat1,
    shuffle: Shuffle,
};

const LOOP_LABEL_KEYS: Partial<Record<PlayerLoopMode, string>> = {
    off: 'player.controls.loopOff',
    one: 'player.controls.loopOne',
    shuffle: 'player.controls.shuffle',
};

/** Tailwind 无法表达动态 hover 色，这里用自定义属性把派生色喂给 hover:bg-(--control-hover-bg)。 */
const withHoverVar = (color: string, rest?: React.CSSProperties): React.CSSProperties => ({
    ...rest,
    '--control-hover-bg': color,
} as React.CSSProperties);

const ICON_BUTTON_CLASS = 'rounded-full p-2 transition-colors disabled:cursor-not-allowed';

export interface ExpandedViewProps {
    currentSong: { name: string; artists?: { name: string }[] } | null;
    playerState: PlayerState;
    currentTime: MotionValue<number>;
    duration: number;
    loopMode: PlayerLoopMode;
    canTogglePlay: boolean;
    onSeek: (time: number) => void;
    onTogglePlay: () => void;
    onToggleLoop: () => void;
    onToggleTimeline: () => void;
    onNextTrack?: () => void;
    onPrevTrack?: () => void;
    onToggleQueue?: () => void;
    noTrackText: string;
    primaryColor: string;
    secondaryColor: string;
    hasLyrics: boolean;
    tokens: ControlSurfaceTokens;
    controlsDisabled?: boolean;
}

const ExpandedView: React.FC<ExpandedViewProps> = ({
    currentSong,
    playerState,
    currentTime,
    duration,
    loopMode,
    canTogglePlay,
    onSeek,
    onTogglePlay,
    onToggleLoop,
    onToggleTimeline,
    onNextTrack,
    onPrevTrack,
    onToggleQueue,
    noTrackText,
    primaryColor,
    secondaryColor,
    hasLyrics,
    tokens,
    controlsDisabled = false,
}) => {
    const { t } = useTranslation();

    const isPlaying = playerState === PlayerState.PLAYING;
    const LoopIcon = LOOP_ICONS[loopMode] ?? Repeat;
    const loopLabel = t(LOOP_LABEL_KEYS[loopMode] ?? 'player.controls.loopAll');
    const isLoopActive = loopMode !== 'off';
    const artistText = currentSong?.artists?.map(artist => artist.name).filter(Boolean).join(' / ') ?? '';

    const stop = (handler?: () => void) => (event: React.MouseEvent) => {
        event.stopPropagation();
        handler?.();
    };

    return (
        <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-x-3 gap-y-2">
            {/* 歌曲信息：移动端整行居中，桌面端退到左列 */}
            <div className="col-span-3 row-start-1 min-w-0 px-2 text-center select-none sm:col-span-1 sm:col-start-1 sm:text-left">
                <div className="truncate text-sm font-bold" style={{ color: primaryColor }}>
                    {currentSong?.name || noTrackText}
                </div>
                {artistText && (
                    <div className="truncate text-[11px] opacity-70" style={{ color: secondaryColor }}>
                        {artistText}
                    </div>
                )}
            </div>

            {/* 主控件组：模式 · 上一首 · 播放/暂停 · 下一首 · 列表 */}
            <div className="col-span-3 row-start-2 flex items-center justify-center gap-1 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                <button
                    onClick={stop(onToggleLoop)}
                    disabled={controlsDisabled}
                    aria-label={loopLabel}
                    aria-pressed={isLoopActive}
                    title={loopLabel}
                    className={`${ICON_BUTTON_CLASS} ${isLoopActive ? '' : 'opacity-40 hover:opacity-100 hover:bg-(--control-hover-bg)'} ${controlsDisabled ? 'opacity-35' : ''}`}
                    style={withHoverVar(tokens.hoverBackground, {
                        color: primaryColor,
                        backgroundColor: isLoopActive ? tokens.activeToggleBackground : undefined,
                    })}
                >
                    <LoopIcon size={18} />
                </button>

                <button
                    onClick={stop(onPrevTrack)}
                    disabled={!onPrevTrack || controlsDisabled}
                    aria-label={t('player.controls.previous')}
                    title={t('player.controls.previous')}
                    className={`${ICON_BUTTON_CLASS} opacity-60 hover:opacity-100 hover:bg-(--control-hover-bg) disabled:opacity-25`}
                    style={withHoverVar(tokens.hoverBackground, { color: primaryColor })}
                >
                    <SkipBack size={18} fill="currentColor" />
                </button>

                <button
                    onClick={stop(onTogglePlay)}
                    disabled={!canTogglePlay || controlsDisabled}
                    aria-label={isPlaying ? t('player.controls.pause') : t('player.controls.play')}
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-none shadow-lg transition-transform ${controlsDisabled ? 'cursor-not-allowed opacity-45' : 'hover:scale-105'}`}
                    style={{ backgroundColor: primaryColor, color: 'var(--bg-color)' }}
                >
                    {isPlaying
                        ? <Pause size={18} fill="currentColor" />
                        : <Play size={18} fill="currentColor" className="ml-0.5" />}
                </button>

                <button
                    onClick={stop(onNextTrack)}
                    disabled={!onNextTrack || controlsDisabled}
                    aria-label={t('player.controls.next')}
                    title={t('player.controls.next')}
                    className={`${ICON_BUTTON_CLASS} opacity-60 hover:opacity-100 hover:bg-(--control-hover-bg) disabled:opacity-25`}
                    style={withHoverVar(tokens.hoverBackground, { color: primaryColor })}
                >
                    <SkipForward size={18} fill="currentColor" />
                </button>

                <button
                    onClick={stop(onToggleQueue)}
                    disabled={!onToggleQueue}
                    aria-label={t('player.controls.queue')}
                    title={t('player.controls.queue')}
                    className={`${ICON_BUTTON_CLASS} opacity-40 hover:opacity-100 hover:bg-(--control-hover-bg) disabled:opacity-20`}
                    style={withHoverVar(tokens.hoverBackground, { color: primaryColor })}
                >
                    <ListMusic size={18} />
                </button>
            </div>

            {/* 歌词时间轴：移动端空间不足，仅桌面端显示 */}
            <div className="hidden sm:col-start-3 sm:row-start-1 sm:flex sm:justify-end">
                <button
                    onClick={stop(onToggleTimeline)}
                    disabled={!hasLyrics}
                    aria-label={t('player.controls.lyricsTimeline')}
                    title={t('player.controls.lyricsTimeline')}
                    className={`${ICON_BUTTON_CLASS} ${hasLyrics ? 'opacity-40 hover:opacity-100 hover:bg-(--control-hover-bg)' : 'opacity-20'}`}
                    style={withHoverVar(tokens.hoverBackground, { color: primaryColor })}
                >
                    <ChartBar size={18} />
                </button>
            </div>

            {/* 进度条：跨满三列压在最后一行，seek 命中区拉到整条胶囊宽 */}
            <div className="col-span-3 row-start-3 w-full px-2 sm:row-start-2">
                <ProgressBar
                    currentTime={currentTime}
                    duration={duration}
                    onSeek={onSeek}
                    primaryColor={primaryColor}
                    secondaryColor={secondaryColor}
                    trackColor={tokens.trackColor}
                    disabled={controlsDisabled}
                />
            </div>
        </div>
    );
};

export default ExpandedView;
