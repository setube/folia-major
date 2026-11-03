// src/components/player-controls/ExpandedView.tsx
// 展开态三段排布：左(歌名/歌手) — 中(喜欢·模式·上一首·播放·下一首·列表) — 右(音量·自定义槽位)，进度条通栏压在最后一行。
// 中间列取 auto、两侧取等宽 1fr，因此主控件组始终位于胶囊正中，不随两侧内容长度漂移。
// 循环、上一首/下一首、喜欢都从胶囊补齐后的槽位上下文取，和槽位按钮、浮动命令用同一份状态。
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    Play, Pause, SkipBack, SkipForward, ListMusic, Heart,
    Volume2, Volume1, VolumeX,
} from 'lucide-react';
import { MotionValue } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import ProgressBar from '../ProgressBar';
import { PlayerState } from '../../types';
import type { PlayerControlSlotActionId } from '../../types/playerControlSlots';
import type { PlayerControlSlotContext } from '../floating-player/playerControlSlotActions';
import PlayerControlSlotButton from '../floating-player/PlayerControlSlotButton';
import { loopModeIcon, loopModeLabelName } from '../shared/loopModeDisplay';
import { HifiProgressRow } from '../hifi/HifiBadge';
import { useIsHifiRoute } from '../hifi/useHifiSignalPath';
import type { ControlSurfaceTokens } from './controlSurface';

/**
 * 这套布局固定摆出来的动作。槽位选到其中之一时不再重复画一颗，
 * 右列只放其余动作（默认是歌词时间轴）；浮动命令也据此去重。
 */
export const FIXED_LAYOUT_SLOT_ACTIONS: readonly PlayerControlSlotActionId[] = ['like', 'loop', 'prev', 'next', 'queue', 'volume'];

/** Tailwind 无法表达动态 hover 色，这里用自定义属性把派生色喂给 hover:bg-(--control-hover-bg)。 */
const withHoverVar = (color: string, rest?: React.CSSProperties): React.CSSProperties => ({
    ...rest,
    '--control-hover-bg': color,
} as React.CSSProperties);

const ICON_BUTTON_CLASS = 'rounded-full p-2 transition-colors disabled:cursor-not-allowed';

/** 进度条那一行：跨满三列压在最后一行，seek 命中区拉到整条胶囊宽。 */
const PROGRESS_ROW_CLASS = 'col-span-3 row-start-3 w-full px-2 sm:row-start-2';

/** 滚轮调音量的单步幅度 */
const VOLUME_WHEEL_STEP = 0.03;

export interface ExpandedViewProps {
    currentSong: { name: string; artists?: { name: string }[] } | null;
    playerState: PlayerState;
    currentTime: MotionValue<number>;
    duration: number;
    canTogglePlay: boolean;
    onSeek: (time: number) => void;
    onTogglePlay: () => void;
    /** 胶囊补齐后的完整槽位上下文。 */
    slotContext: PlayerControlSlotContext;
    slotPrimary: PlayerControlSlotActionId;
    slotSecondary: PlayerControlSlotActionId;
    onCustomizePrimary?: (anchorRect: DOMRect) => void;
    onCustomizeSecondary?: (anchorRect: DOMRect) => void;
    /** 相邻曲目标题，作为箭头的悬浮提示；未知时回落到通用文案。 */
    prevTrackTitle?: string | null;
    nextTrackTitle?: string | null;
    onToggleQueue?: () => void;
    /** 传歌手在 currentSong.artists 中的下标，由上层解析成具体的艺术家详情。 */
    onOpenArtist?: (artistIndex: number) => void;
    /** 0~1 */
    volume?: number;
    onVolumeChange?: (volume: number) => void;
    noTrackText: string;
    primaryColor: string;
    secondaryColor: string;
    tokens: ControlSurfaceTokens;
    isDaylight: boolean;
    controlsDisabled?: boolean;
}

const ExpandedView: React.FC<ExpandedViewProps> = ({
    currentSong,
    playerState,
    currentTime,
    duration,
    canTogglePlay,
    onSeek,
    onTogglePlay,
    slotContext,
    slotPrimary,
    slotSecondary,
    onCustomizePrimary,
    onCustomizeSecondary,
    prevTrackTitle = null,
    nextTrackTitle = null,
    onToggleQueue,
    onOpenArtist,
    volume,
    onVolumeChange,
    noTrackText,
    primaryColor,
    secondaryColor,
    tokens,
    isDaylight,
    controlsDisabled = false,
}) => {
    const { t } = useTranslation();
    const isHifiRoute = useIsHifiRoute();
    const [isVolumeOpen, setIsVolumeOpen] = useState(false);
    const [volumeAnchor, setVolumeAnchor] = useState<DOMRect | null>(null);
    const volumeButtonRef = useRef<HTMLButtonElement>(null);
    const volumeCloseTimerRef = useRef<number | null>(null);

    const cancelVolumeClose = useCallback(() => {
        if (volumeCloseTimerRef.current !== null) {
            window.clearTimeout(volumeCloseTimerRef.current);
            volumeCloseTimerRef.current = null;
        }
    }, []);

    const closeVolume = useCallback(() => {
        cancelVolumeClose();
        setIsVolumeOpen(false);
    }, [cancelVolumeClose]);

    // 面板挂在 body 上，指针在按钮与面板之间移动时会短暂离开两者，延迟关闭避免闪断。
    const scheduleVolumeClose = useCallback(() => {
        cancelVolumeClose();
        volumeCloseTimerRef.current = window.setTimeout(() => {
            volumeCloseTimerRef.current = null;
            setIsVolumeOpen(false);
        }, 160);
    }, [cancelVolumeClose]);

    const openVolume = useCallback(() => {
        cancelVolumeClose();
        const rect = volumeButtonRef.current?.getBoundingClientRect();
        if (rect) {
            setVolumeAnchor(rect);
        }
        setIsVolumeOpen(true);
    }, [cancelVolumeClose]);

    // 向上滚提高音量。面板挂在 body 上且页面禁滚，无需 preventDefault
    // （React 的 wheel 监听是 passive 的，调了也无效）。
    const handleVolumeWheel = useCallback((event: React.WheelEvent) => {
        if (!onVolumeChange) {
            return;
        }
        const delta = event.deltaY < 0 ? VOLUME_WHEEL_STEP : -VOLUME_WHEEL_STEP;
        const current = Math.min(1, Math.max(0, Number.isFinite(volume) ? (volume as number) : 1));
        onVolumeChange(Math.min(1, Math.max(0, current + delta)));
    }, [onVolumeChange, volume]);

    useEffect(() => cancelVolumeClose, [cancelVolumeClose]);

    const safeVolume = Math.min(1, Math.max(0, Number.isFinite(volume) ? (volume as number) : 1));
    const VolumeIcon = safeVolume === 0 ? VolumeX : (safeVolume < 0.5 ? Volume1 : Volume2);

    const isPlaying = playerState === PlayerState.PLAYING;
    const { loopMode } = slotContext;
    const LoopIcon = loopModeIcon(loopMode);
    const loopLabel = t(`player.${loopModeLabelName(loopMode)}`);
    const isLoopActive = loopMode !== 'off';
    const isLiked = slotContext.isLiked;
    const isLikeDisabled = controlsDisabled || slotContext.likeDisabled;
    const artists = (currentSong?.artists ?? []).filter(artist => Boolean(artist?.name));
    const extraSlots = [
        { side: 'primary' as const, actionId: slotPrimary, onCustomize: onCustomizePrimary },
        { side: 'secondary' as const, actionId: slotSecondary, onCustomize: onCustomizeSecondary },
    ].filter(slot => !FIXED_LAYOUT_SLOT_ACTIONS.includes(slot.actionId));

    const stop = (handler?: () => void) => (event: React.MouseEvent) => {
        event.stopPropagation();
        handler?.();
    };

    const progressBar = (
        <ProgressBar
            currentTime={currentTime}
            duration={duration}
            onSeek={onSeek}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            trackColor={tokens.trackColor}
            disabled={controlsDisabled}
        />
    );

    return (
        <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-x-3 gap-y-2">
            {/* 歌曲信息：移动端整行居中，桌面端退到左列 */}
            <div className="col-span-3 row-start-1 min-w-0 px-2 select-none sm:col-span-1 sm:col-start-1">
                <div className="min-w-0 text-center sm:text-left">
                    <div className="truncate text-sm font-bold" style={{ color: primaryColor }}>
                        {currentSong?.name || noTrackText}
                    </div>
                    {artists.length > 0 && (
                        <div className="truncate text-[11px] opacity-70" style={{ color: secondaryColor }}>
                            {artists.map((artist, index) => (
                                <React.Fragment key={`${artist.name}-${index}`}>
                                    {index > 0 && ' / '}
                                    {onOpenArtist ? (
                                        <button
                                            type="button"
                                            onClick={stop(() => onOpenArtist(index))}
                                            title={artist.name}
                                            className="cursor-pointer"
                                            style={{ color: 'inherit' }}
                                        >
                                            {artist.name}
                                        </button>
                                    ) : artist.name}
                                </React.Fragment>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* 主控件组：喜欢 · 模式 · 上一首 · 播放/暂停 · 下一首 · 列表 */}
            <div className="col-span-3 row-start-2 flex items-center justify-center gap-1 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                <button
                    onClick={stop(slotContext.onLike)}
                    disabled={isLikeDisabled}
                    aria-label={t('player.controls.like')}
                    aria-pressed={isLiked}
                    title={t('player.controls.like')}
                    className={`${ICON_BUTTON_CLASS} hover:bg-(--control-hover-bg) disabled:opacity-25 ${isLiked ? '' : 'opacity-50 hover:opacity-100'}`}
                    style={withHoverVar(tokens.hoverBackground, {
                        color: isLiked ? 'var(--text-accent)' : primaryColor,
                    })}
                >
                    <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} />
                </button>

                <button
                    onClick={stop(slotContext.onToggleLoop)}
                    disabled={controlsDisabled}
                    aria-label={loopLabel}
                    aria-pressed={isLoopActive}
                    title={loopLabel}
                    className={`${ICON_BUTTON_CLASS} opacity-60 hover:opacity-100 hover:bg-(--control-hover-bg) ${controlsDisabled ? 'opacity-35' : ''}`}
                    style={withHoverVar(tokens.hoverBackground, { color: primaryColor })}
                >
                    <LoopIcon size={18} />
                </button>

                <button
                    onClick={stop(slotContext.onPrev)}
                    disabled={controlsDisabled || !slotContext.canPrev}
                    aria-label={t('player.controls.previous')}
                    title={prevTrackTitle || t('player.controls.previous')}
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
                    onClick={stop(slotContext.onNext)}
                    disabled={controlsDisabled || !slotContext.canNext}
                    aria-label={t('player.controls.next')}
                    title={nextTrackTitle || t('player.controls.next')}
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
                    // 标记给 QueuePopover 的外点关闭用：这颗按钮自己会 toggle，
                    // 不打标记的话浮层会先被"点到外面"关掉，再被按钮打开，等于点了没反应。
                    data-queue-popover-trigger="true"
                    className={`${ICON_BUTTON_CLASS} opacity-40 hover:opacity-100 hover:bg-(--control-hover-bg) disabled:opacity-20`}
                    style={withHoverVar(tokens.hoverBackground, { color: primaryColor })}
                >
                    <ListMusic size={18} />
                </button>
            </div>

            {/* 音量 + 自定义槽位：移动端空间不足，仅桌面端显示 */}
            <div
                data-ponder-slots
                className="hidden sm:col-start-3 sm:row-start-1 sm:flex sm:items-center sm:justify-end sm:gap-1"
            >
                {onVolumeChange && (
                    <div
                        className="relative"
                        onMouseEnter={openVolume}
                        onMouseLeave={scheduleVolumeClose}
                        onWheel={handleVolumeWheel}
                    >
                        <button
                            ref={volumeButtonRef}
                            onClick={stop(() => (isVolumeOpen ? closeVolume() : openVolume()))}
                            aria-label={t('player.controls.volume')}
                            title={t('player.controls.volume')}
                            className={`${ICON_BUTTON_CLASS} opacity-40 hover:opacity-100 hover:bg-(--control-hover-bg)`}
                            style={withHoverVar(tokens.hoverBackground, { color: primaryColor })}
                        >
                            <VolumeIcon size={18} />
                        </button>

                        {isVolumeOpen && volumeAnchor && createPortal(
                            // 控制栏胶囊有 overflow-hidden（圆角裁剪进度条两端要靠它），
                            // 面板留在里面会被切掉，所以挂到 body 上按按钮位置定位。
                            <div
                                className="fixed z-[70] flex w-12 flex-col items-center gap-1 rounded-2xl border py-2 shadow-lg backdrop-blur-2xl"
                                style={{
                                    left: volumeAnchor.left + volumeAnchor.width / 2,
                                    top: volumeAnchor.top - 8,
                                    transform: 'translate(-50%, -100%)',
                                    backgroundColor: tokens.expandedBackground,
                                    borderColor: tokens.borderColor,
                                }}
                                onMouseEnter={cancelVolumeClose}
                                onMouseLeave={scheduleVolumeClose}
                                onWheel={handleVolumeWheel}
                                onClick={event => event.stopPropagation()}
                            >
                                <div className="flex h-24 w-9 items-center justify-center">
                                    <input
                                        type="range"
                                        min={0}
                                        max={1}
                                        step={0.01}
                                        value={safeVolume}
                                        onChange={event => onVolumeChange(Number(event.currentTarget.value))}
                                        aria-label={t('player.controls.volume')}
                                        className="h-1 w-24 -rotate-90 cursor-pointer appearance-none rounded-full [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow"
                                        style={{ backgroundColor: tokens.trackColor }}
                                    />
                                </div>
                                <span
                                    className="text-[10px] font-mono tabular-nums opacity-70"
                                    style={{ color: primaryColor }}
                                >
                                    {Math.round(safeVolume * 100)}%
                                </span>
                            </div>,
                            document.body
                        )}
                    </div>
                )}

                {extraSlots.map(slot => (
                    <PlayerControlSlotButton
                        key={slot.side}
                        actionId={slot.actionId}
                        context={slotContext}
                        primaryColor={primaryColor}
                        isDaylight={isDaylight}
                        controlsDisabled={controlsDisabled}
                        onCustomize={slot.onCustomize}
                    />
                ))}
            </div>

            {/* HiFi 路线上时长后面多一块 HiFi 徽标；Web 路线只有进度条。 */}
            {isHifiRoute ? (
                <HifiProgressRow className={PROGRESS_ROW_CLASS} isDaylight={isDaylight} disabled={controlsDisabled}>
                    {progressBar}
                </HifiProgressRow>
            ) : (
                <div className={PROGRESS_ROW_CLASS}>{progressBar}</div>
            )}
        </div>
    );
};

export default ExpandedView;
