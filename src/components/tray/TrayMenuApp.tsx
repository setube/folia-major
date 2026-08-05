// src/components/tray/TrayMenuApp.tsx
// 自绘托盘菜单：曲目信息 + 横向图标按钮行（原生 Menu 做不到的部分）+ 常规菜单项与二级菜单。
// 由 electron/main.cjs 的无边框透明窗加载（?trayMenu=1），状态经 tray-menu-state 推送。
// 窗口尺寸固定、内容贴右下角，多余部分透明：不做测量回灌，几何一次算准。
import React, { useCallback, useEffect, useState } from 'react';
import {
    Play, Pause, SkipBack, SkipForward, Music, PictureInPicture2, Power, Check, ChevronRight,
    ListOrdered, Repeat, Repeat1, Shuffle, Minus, AppWindow, Heart, Settings, type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

const MENU_WIDTH_PX = 200;
/** 喜欢按钮的选中色 */
const TRAY_LIKED_COLOR = '#ef4444';

const EMPTY_STATE: ElectronTrayMenuState = {
    playback: {
        hasActiveTrack: false,
        canGoPrevious: false,
        canGoNext: false,
        isPlaying: false,
        title: null,
        artist: null,
        loopMode: 'off',
        isLiked: false,
    },
    skipTaskbarEnabled: false,
    mainWindowVisible: false,
    canToggleWindow: false,
    displayMode: 'full',
};

const LOOP_MODES: ReadonlyArray<{
    mode: string;
    action: ElectronTrayMenuAction;
    icon: LucideIcon;
    labelKey: string;
}> = [
    { mode: 'off', action: 'loop-off', icon: ListOrdered, labelKey: 'player.controls.loopOff' },
    { mode: 'all', action: 'loop-all', icon: Repeat, labelKey: 'player.controls.loopAll' },
    { mode: 'one', action: 'loop-one', icon: Repeat1, labelKey: 'player.controls.loopOne' },
    { mode: 'shuffle', action: 'loop-shuffle', icon: Shuffle, labelKey: 'player.controls.shuffle' },
];

const DISPLAY_MODES: ReadonlyArray<{
    mode: ElectronTrayMenuState['displayMode'];
    action: ElectronTrayMenuAction;
    icon: LucideIcon;
    labelKey: string;
}> = [
    { mode: 'full', action: 'display-full', icon: AppWindow, labelKey: 'tray.displayFull' },
    { mode: 'mini', action: 'display-mini', icon: PictureInPicture2, labelKey: 'tray.displayMini' },
    { mode: 'minimized', action: 'display-minimize', icon: Minus, labelKey: 'tray.displayMinimize' },
];

// 托盘菜单是独立窗口，拿不到应用主题上下文，因此跟随系统深浅色 —— 与原生菜单的行为一致。
const useSystemDarkMode = (): boolean => {
    const [isDark, setIsDark] = useState(() =>
        typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches === true
    );

    useEffect(() => {
        const query = window.matchMedia?.('(prefers-color-scheme: dark)');
        if (!query) {
            return;
        }
        const handleChange = (event: MediaQueryListEvent) => setIsDark(event.matches);
        query.addEventListener('change', handleChange);
        return () => query.removeEventListener('change', handleChange);
    }, []);

    return isDark;
};

const TrayMenuApp: React.FC = () => {
    const { t } = useTranslation();
    const [state, setState] = useState<ElectronTrayMenuState>(EMPTY_STATE);
    const [openSubmenu, setOpenSubmenu] = useState<'loop' | 'display' | null>(null);
    const isDark = useSystemDarkMode();

    // index.css 给 body 设了不透明底色，透明窗里会从圆角外缘透出来变成黑边。
    // 同时禁掉滚动：内容一旦超过窗口高度就会出现纵向滚动条，把靠右的菜单往左挤，
    // 表现为「右边框先消失、随后又出现」的宽度跳变。
    useEffect(() => {
        document.body.style.backgroundColor = 'transparent';
        document.documentElement.style.backgroundColor = 'transparent';
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
    }, []);

    const bridge = typeof window !== 'undefined' ? window.electron : undefined;

    useEffect(() => {
        if (!bridge?.getTrayMenuState) {
            return;
        }

        void bridge.getTrayMenuState().then((next: ElectronTrayMenuState) => setState(next)).catch(() => undefined);
        return bridge.onTrayMenuState?.((next: ElectronTrayMenuState) => setState(next));
    }, [bridge]);

    // 菜单收起时窗口只是被移到屏幕外，不会触发 visibilitychange，用失焦作为关闭信号。
    useEffect(() => {
        const handleBlur = () => setOpenSubmenu(null);
        window.addEventListener('blur', handleBlur);
        return () => window.removeEventListener('blur', handleBlur);
    }, []);

    const closeMenu = useCallback(() => {
        void bridge?.closeTrayMenu?.().catch(() => undefined);
    }, [bridge]);

    const runAction = useCallback((action: ElectronTrayMenuAction, options?: { keepOpen?: boolean }) => {
        void bridge?.invokeTrayMenuAction?.(action).catch(() => undefined);
        if (!options?.keepOpen) {
            closeMenu();
        }
    }, [bridge, closeMenu]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                closeMenu();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [closeMenu]);

    const { playback } = state;
    const trackTitle = playback.hasActiveTrack && playback.title ? playback.title : t('tray.noTrack');
    const trackArtist = playback.hasActiveTrack ? (playback.artist ?? '') : '';
    // 截断后靠 title 属性把完整的「歌名 - 歌手」露出来。
    const trackLabel = trackArtist ? `${trackTitle} - ${trackArtist}` : trackTitle;
    const activeLoop = LOOP_MODES.find(item => item.mode === playback.loopMode) ?? LOOP_MODES[0];
    const activeDisplay = DISPLAY_MODES.find(item => item.mode === state.displayMode) ?? DISPLAY_MODES[0];

    const surface = isDark ? 'rgba(32,32,36,0.92)' : 'rgba(250,250,252,0.94)';
    const border = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)';
    const primaryText = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.88)';
    const secondaryText = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.52)';
    const hoverBg = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)';
    const separator = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';

    const itemStyle: React.CSSProperties = {
        color: primaryText,
        ['--tray-hover-bg' as string]: hoverBg,
    };

    const ITEM_CLASS = 'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-(--tray-hover-bg) disabled:cursor-not-allowed disabled:opacity-40';

    // 分隔线内缩到与菜单项文字同一段落宽度，不贴着卡片边缘。
    const renderSeparator = () => (
        <div className="mx-2.5 h-px" style={{ backgroundColor: separator }} />
    );

    const renderItem = (
        Icon: LucideIcon,
        label: string,
        action: ElectronTrayMenuAction,
        checked?: boolean,
        disabled?: boolean
    ) => (
        <button
            type="button"
            disabled={disabled}
            onClick={() => runAction(action)}
            title={label}
            className={ITEM_CLASS}
            style={itemStyle}
        >
            <Icon size={14} className="shrink-0 opacity-70" />
            <span className="min-w-0 flex-1 truncate">{label}</span>
            {checked ? <Check size={13} className="shrink-0 opacity-70" /> : null}
        </button>
    );

    // 二级菜单向左展开：窗口左侧预留了空白，不需要在展开时改窗口宽度。
    const renderSubmenu = (
        key: 'loop' | 'display',
        Icon: LucideIcon,
        activeLabel: string,
        items: ReadonlyArray<{ mode: string; action: ElectronTrayMenuAction; icon: LucideIcon; labelKey: string }>,
        activeMode: string,
    ) => (
        <div
            className="relative"
            onMouseEnter={() => setOpenSubmenu(key)}
            onMouseLeave={() => setOpenSubmenu(current => (current === key ? null : current))}
        >
            <div className={ITEM_CLASS} style={itemStyle} title={activeLabel}>
                <Icon size={14} className="shrink-0 opacity-70" />
                <span className="min-w-0 flex-1 truncate">{activeLabel}</span>
                <ChevronRight size={13} className="shrink-0 opacity-50" />
            </div>

            {openSubmenu === key && (
                <div
                    className="absolute right-full bottom-0 z-10 mr-1 w-[140px] rounded-lg border p-1.5 backdrop-blur-2xl"
                    style={{ backgroundColor: surface, borderColor: border }}
                >
                    {items.map(({ mode, action, icon: ItemIcon, labelKey }) => (
                        <button
                            key={mode}
                            type="button"
                            onClick={() => runAction(action, { keepOpen: true })}
                            className={ITEM_CLASS}
                            style={itemStyle}
                        >
                            <ItemIcon size={14} className="shrink-0 opacity-70" />
                            <span className="min-w-0 flex-1 truncate">{t(labelKey)}</span>
                            {activeMode === mode ? <Check size={13} className="shrink-0 opacity-70" /> : null}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );

    return (
        // 菜单绝对定位在窗口右下角：flex 对齐在 DPI 缩放下会有亚像素舍入，
        // 右边框会被压到窗口外沿裁掉，表现为「先没有右边框、随后又出现」。
        <div
            className="fixed inset-0"
            onClick={event => {
                if (event.target === event.currentTarget) {
                    closeMenu();
                }
            }}
        >
            <div
                className="absolute right-0 bottom-0 flex flex-col gap-1 rounded-lg border p-1.5 backdrop-blur-2xl select-none"
                style={{ backgroundColor: surface, borderColor: border, width: `${MENU_WIDTH_PX}px` }}
            >
                {/* 曲目信息：独立区块，点击进入播放页 */}
                <button
                    type="button"
                    onClick={() => runAction('open-player')}
                    title={trackLabel}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors hover:bg-(--tray-hover-bg)"
                    style={itemStyle}
                >
                    <Music size={14} className="shrink-0 opacity-70" style={{ color: secondaryText }} />
                    <div className="min-w-0 flex-1 truncate text-[13px]">
                        <span style={{ color: primaryText }}>{trackTitle}</span>
                        {trackArtist && (
                            <span style={{ color: secondaryText }}>{` - ${trackArtist}`}</span>
                        )}
                    </div>
                </button>

                {renderSeparator()}

                {/* 横向图标按钮行 —— 原生 Menu 无法内嵌，这正是自绘的理由 */}
                <div className="flex items-center gap-2 px-2.5 py-0.5" style={itemStyle}>
                    <button
                        type="button"
                        disabled={!playback.canGoPrevious}
                        onClick={() => runAction('previous', { keepOpen: true })}
                        aria-label={t('player.controls.previous')}
                        title={t('player.controls.previous')}
                        className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-(--tray-hover-bg) disabled:cursor-not-allowed disabled:opacity-30"
                        style={{ color: primaryText }}
                    >
                        <SkipBack size={16} fill="currentColor" />
                    </button>
                    <button
                        type="button"
                        disabled={!playback.hasActiveTrack}
                        onClick={() => runAction('play-pause', { keepOpen: true })}
                        aria-label={playback.isPlaying ? t('player.controls.pause') : t('player.controls.play')}
                        title={playback.isPlaying ? t('player.controls.pause') : t('player.controls.play')}
                        className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-(--tray-hover-bg) disabled:cursor-not-allowed disabled:opacity-30"
                        style={{ color: primaryText }}
                    >
                        {playback.isPlaying
                            ? <Pause size={18} fill="currentColor" />
                            : <Play size={18} fill="currentColor" className="ml-0.5" />}
                    </button>
                    <button
                        type="button"
                        disabled={!playback.canGoNext}
                        onClick={() => runAction('next', { keepOpen: true })}
                        aria-label={t('player.controls.next')}
                        title={t('player.controls.next')}
                        className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-(--tray-hover-bg) disabled:cursor-not-allowed disabled:opacity-30"
                        style={{ color: primaryText }}
                    >
                        <SkipForward size={16} fill="currentColor" />
                    </button>

                    <button
                        type="button"
                        disabled={!playback.hasActiveTrack}
                        onClick={() => runAction('like', { keepOpen: true })}
                        aria-label={t('player.controls.like')}
                        aria-pressed={playback.isLiked}
                        title={t('player.controls.like')}
                        className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-(--tray-hover-bg) disabled:cursor-not-allowed disabled:opacity-30"
                        style={{ color: playback.isLiked ? TRAY_LIKED_COLOR : primaryText }}
                    >
                        <Heart size={16} fill={playback.isLiked ? 'currentColor' : 'none'} />
                    </button>
                </div>

                {renderSeparator()}

                {renderSubmenu('loop', activeLoop.icon, t(activeLoop.labelKey), LOOP_MODES, playback.loopMode)}
                {renderSubmenu('display', activeDisplay.icon, t(activeDisplay.labelKey), DISPLAY_MODES, state.displayMode)}

                {renderSeparator()}

                {renderItem(Settings, t('tray.settings'), 'open-settings')}
                {renderItem(Power, t('tray.quit'), 'quit')}
            </div>
        </div>
    );
};

export default TrayMenuApp;
