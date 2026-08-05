// src/components/tray/TrayMenuApp.tsx
// 自绘托盘菜单：顶部曲目信息 + 横向图标按钮行（原生 Menu 做不到的部分）+ 常规菜单项。
// 由 electron/main.cjs 的无边框透明窗加载（?trayMenu=1），状态经 tray-menu-state 推送。
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { useTranslation } from 'react-i18next';


const EMPTY_STATE: ElectronTrayMenuState = {
    playback: {
        hasActiveTrack: false,
        canGoPrevious: false,
        canGoNext: false,
        isPlaying: false,
        title: null,
        artist: null,
    },
    clickThroughEnabled: false,
    skipTaskbarEnabled: false,
    mainWindowVisible: false,
    canToggleWindow: false,
};

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
    const containerRef = useRef<HTMLDivElement>(null);
    const isDark = useSystemDarkMode();

    const bridge = typeof window !== 'undefined' ? window.electron : undefined;

    useEffect(() => {
        if (!bridge?.getTrayMenuState) {
            return;
        }

        void bridge.getTrayMenuState().then((next: ElectronTrayMenuState) => setState(next)).catch(() => undefined);
        return bridge.onTrayMenuState?.((next: ElectronTrayMenuState) => setState(next));
    }, [bridge]);

    // 内容高度随曲目信息有无而变，测量后让主进程贴着任务栏重新定位。
    useLayoutEffect(() => {
        const element = containerRef.current;
        if (!element || !bridge?.resizeTrayMenu) {
            return;
        }
        void bridge.resizeTrayMenu(Math.ceil(element.getBoundingClientRect().height)).catch(() => undefined);
    }, [bridge, state]);

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

    const renderItem = (label: string, action: ElectronTrayMenuAction, checked?: boolean, disabled?: boolean) => (
        <button
            type="button"
            disabled={disabled}
            onClick={() => runAction(action)}
            className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-(--tray-hover-bg) disabled:cursor-not-allowed disabled:opacity-40"
            style={itemStyle}
        >
            <span className="truncate">{label}</span>
            {checked ? <span className="ml-2 shrink-0 text-[11px] opacity-70">✓</span> : null}
        </button>
    );

    const transportButtonClass = 'flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-(--tray-hover-bg) disabled:cursor-not-allowed disabled:opacity-30';

    return (
        <div
            ref={containerRef}
            className="flex w-full flex-col gap-1 rounded-xl border p-1.5 backdrop-blur-2xl select-none"
            style={{ backgroundColor: surface, borderColor: border }}
        >
            {/* 曲目信息 */}
            <div className="px-2.5 pt-1.5 pb-1">
                <div className="truncate text-[13px] font-semibold" style={{ color: primaryText }}>
                    {playback.hasActiveTrack && playback.title ? playback.title : t('tray.noTrack')}
                </div>
                {playback.hasActiveTrack && playback.artist && (
                    <div className="truncate text-[11px]" style={{ color: secondaryText }}>
                        {playback.artist}
                    </div>
                )}
            </div>

            {/* 横向图标按钮行 —— 原生 Menu 无法内嵌，这正是自绘的理由 */}
            <div className="flex items-center justify-center gap-2 pb-1" style={itemStyle}>
                <button
                    type="button"
                    disabled={!playback.canGoPrevious}
                    onClick={() => runAction('previous', { keepOpen: true })}
                    aria-label={t('player.controls.previous')}
                    title={t('player.controls.previous')}
                    className={transportButtonClass}
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
                    className={`${transportButtonClass} h-9 w-9`}
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
                    className={transportButtonClass}
                    style={{ color: primaryText }}
                >
                    <SkipForward size={16} fill="currentColor" />
                </button>
            </div>

            <div className="h-px" style={{ backgroundColor: separator }} />

            {renderItem(t('tray.showHide'), 'toggle-window', undefined, !state.canToggleWindow)}
            {renderItem(t('tray.openRemote'), 'open-remote')}
            {renderItem(t('tray.clickThrough'), 'toggle-click-through', state.clickThroughEnabled, !state.canToggleWindow)}
            {renderItem(t('tray.hideTaskbar'), 'toggle-skip-taskbar', state.skipTaskbarEnabled, !state.canToggleWindow)}

            <div className="h-px" style={{ backgroundColor: separator }} />

            {renderItem(t('tray.quit'), 'quit')}
        </div>
    );
};

export default TrayMenuApp;
