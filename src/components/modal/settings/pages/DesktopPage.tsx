import React from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useDesktopSettingsStore } from '../../../../stores/useDesktopSettingsStore';
import { usePlayerChromeSettingsStore } from '../../../../stores/usePlayerChromeSettingsStore';
import { FoldedGroup, Group, Reveal, Row, Segmented, Toggle, option, type SettingsGroupDef, type SettingsOptionDef } from '../kit';
import { WallpaperDisplayRow } from './desktop/WallpaperDisplayRow';
import { hasWallpaperDisplayChoice } from './desktop/wallpaperDisplays';

// src/components/modal/settings/pages/DesktopPage.tsx
// The 桌面 page (desktop app only): what closing the main window does, launch at login, the taskbar
// and its fullscreen button, the wallpaper mode, and a folded group for the Remote Control window.

const WINDOW: SettingsGroupDef = { id: 'desktopTrayBehavior', titleKey: 'options.desktopTrayBehavior', electronOnly: true };
const REMOTE: SettingsGroupDef = { id: 'remoteControl', titleKey: 'options.remoteControlGroup', electronOnly: true };

const O = {
    closeToTray: option(WINDOW, 'closeToTray', 'options.closeMainPanel'),
    closeMainPanelAction: option(WINDOW, 'closeMainPanelAction', 'options.closeMainPanelAction'),
    launchAtLogin: option(WINDOW, 'launchAtLogin', 'options.launchAtLogin'),
    launchAtLoginMode: option(WINDOW, 'launchAtLoginMode', 'options.launchAtLoginMode'),
    hideTaskbarIcon: option(WINDOW, 'hideTaskbarIcon', 'options.hideTaskbarIcon'),
    hideFullscreenButton: option(WINDOW, 'hideFullscreenButton', 'options.hideFullscreenButton'),
    nativeMacFullscreen: option(WINDOW, 'useNativeMacFullscreenButton', 'options.useNativeMacFullscreenButton'),
    wallpaperMode: option(WINDOW, 'wallpaperMode', 'options.wallpaperMode'),
    // Drawn only with more than one display connected, where wallpaper mode can use any of them.
    wallpaperDisplay: option(WINDOW, 'wallpaperDisplay', 'options.wallpaperDisplay', { available: hasWallpaperDisplayChoice }),
    wallpaperDock: option(WINDOW, 'wallpaperMacAutohideDock', 'options.wallpaperMacAutohideDock'),
    remoteTaskbarIcon: option(REMOTE, 'hideRemoteControlTaskbarIcon', 'options.hideRemoteControlTaskbarIcon'),
    remoteTitlebar: option(REMOTE, 'hideRemoteControlTitlebar', 'options.hideRemoteControlTitlebar'),
    remoteClickThrough: option(REMOTE, 'remoteControlClickThrough', 'options.remoteControlClickThrough'),
    remoteExpandCover: option(REMOTE, 'remoteControlExpandCover', 'options.remoteControlExpandCover'),
    remoteTextShade: option(REMOTE, 'remoteControlTextShade', 'options.remoteControlTextShade'),
};

const PLATFORM = typeof window === 'undefined' ? undefined : window.electron?.platform;
const IS_MAC = PLATFORM === 'darwin';
const HAS_WALLPAPER_MODE = IS_MAC || PLATFORM === 'win32' || PLATFORM === 'linux';
const MAC_ONLY: SettingsOptionDef[] = [O.nativeMacFullscreen, O.wallpaperDock];

// The search lists the two macOS rows only on macOS.
export const OPTIONS: SettingsOptionDef[] = Object.values(O).filter(row => IS_MAC || !MAC_ONLY.includes(row));

const DesktopPage: React.FC = () => {
    const { t } = useTranslation();
    const desktop = useDesktopSettingsStore(useShallow(state => ({
        closeToTray: state.closeToTray,
        closeMainPanelAction: state.closeMainPanelAction,
        launchAtLogin: state.launchAtLogin,
        launchAtLoginMode: state.launchAtLoginMode,
        launchAtLoginSupported: state.launchAtLoginSupported,
        hideTaskbarIcon: state.hideTaskbarIcon,
        wallpaperMode: state.wallpaperMode,
        wallpaperDock: state.wallpaperMacAutohideDock,
        remoteTaskbarIcon: state.hideRemoteControlTaskbarIcon,
        remoteTitlebar: state.hideRemoteControlTitlebar,
        remoteClickThrough: state.remoteControlClickThrough,
        remoteExpandCover: state.remoteControlExpandCover,
        remoteTextShade: state.remoteControlTextShade,
        setCloseToTray: state.handleToggleCloseToTray,
        setCloseMainPanelAction: state.handleSetCloseMainPanelAction,
        setLaunchAtLogin: state.handleToggleLaunchAtLogin,
        setLaunchAtLoginMode: state.handleSetLaunchAtLoginMode,
        setHideTaskbarIcon: state.handleToggleHideTaskbarIcon,
        setWallpaperMode: state.handleToggleWallpaperMode,
        setWallpaperDock: state.handleToggleWallpaperMacAutohideDock,
        setRemoteTaskbarIcon: state.handleToggleHideRemoteControlTaskbarIcon,
        setRemoteTitlebar: state.handleToggleHideRemoteControlTitlebar,
        setRemoteClickThrough: state.handleToggleRemoteControlClickThrough,
        setRemoteExpandCover: state.handleToggleRemoteControlExpandCover,
        setRemoteTextShade: state.handleToggleRemoteControlTextShade,
    })));
    const chrome = usePlayerChromeSettingsStore(useShallow(state => ({
        hideFullscreenButton: state.hideFullscreenButton,
        nativeMacFullscreen: state.useNativeMacFullscreenButton,
        setHideFullscreenButton: state.handleToggleHideFullscreenButton,
        setNativeMacFullscreen: state.handleToggleNativeMacFullscreenButton,
    })));
    // Counts the switches moved off their default; expand cover is on by default, so it counts when off.
    const remoteOnCount = [desktop.remoteTaskbarIcon, desktop.remoteTitlebar, desktop.remoteClickThrough, !desktop.remoteExpandCover, desktop.remoteTextShade].filter(Boolean).length;

    return (
        <>
            <Group def={WINDOW}>
                <Row option={O.closeToTray} note={t('options.closeMainPanelDesc')}>
                    <Toggle checked={desktop.closeToTray} onChange={desktop.setCloseToTray} />
                </Row>
                <Reveal when={desktop.closeToTray}>
                    <Row sub option={O.closeMainPanelAction}>
                        <Segmented
                            value={desktop.closeMainPanelAction}
                            options={[
                                { value: 'tray', label: t('options.closeMainPanelTray') },
                                { value: 'quit', label: t('options.closeMainPanelQuit') },
                            ]}
                            onChange={desktop.setCloseMainPanelAction}
                        />
                    </Row>
                </Reveal>
                {/* 系统登录项写不进去时（如部分 Linux 桌面）开关置灰，并给出提示。 */}
                <Row option={O.launchAtLogin} note={t('options.launchAtLoginDesc')} disabled={!desktop.launchAtLoginSupported}>
                    <Toggle checked={desktop.launchAtLogin} onChange={desktop.setLaunchAtLogin} />
                </Row>
                <Reveal when={!desktop.launchAtLoginSupported}>
                    <Row sub notice={t('options.launchAtLoginUnsupported')} />
                </Reveal>
                <Reveal when={desktop.launchAtLoginSupported && desktop.launchAtLogin}>
                    <Row sub option={O.launchAtLoginMode}>
                        <Segmented
                            value={desktop.launchAtLoginMode}
                            options={[
                                { value: 'silent', label: t('options.launchAtLoginModeSilent') },
                                { value: 'foreground', label: t('options.launchAtLoginModeForeground') },
                            ]}
                            onChange={desktop.setLaunchAtLoginMode}
                        />
                    </Row>
                </Reveal>
                <Row option={O.hideTaskbarIcon}>
                    <Toggle checked={desktop.hideTaskbarIcon} onChange={desktop.setHideTaskbarIcon} />
                </Row>
                <Reveal when={desktop.hideTaskbarIcon}>
                    <Row sub notice={t('options.hideTaskbarIconNotice')} />
                </Reveal>
                <Row option={O.hideFullscreenButton} hint={t('options.hideFullscreenButtonDesc')}>
                    <Toggle checked={chrome.hideFullscreenButton} onChange={chrome.setHideFullscreenButton} />
                </Row>
                {IS_MAC && (
                    <Row option={O.nativeMacFullscreen} hint={t('options.useNativeMacFullscreenButtonDesc')}>
                        <Toggle checked={chrome.nativeMacFullscreen} onChange={chrome.setNativeMacFullscreen} />
                    </Row>
                )}
                {HAS_WALLPAPER_MODE && (
                    <Row
                        option={O.wallpaperMode}
                        hint={t('options.wallpaperModeDesc')}
                        note={IS_MAC ? t('options.wallpaperModeMacPermissionHint') : undefined}
                    >
                        {/* Turning it on asks first: the store opens the app's confirmation. */}
                        <Toggle checked={desktop.wallpaperMode} onChange={desktop.setWallpaperMode} />
                    </Row>
                )}
                {/* Not in a Reveal: the choice also holds for the next time wallpaper mode is entered. */}
                {HAS_WALLPAPER_MODE && <WallpaperDisplayRow option={O.wallpaperDisplay} />}
                {IS_MAC && (
                    // Not in a Reveal: it also holds for the next time wallpaper mode is entered.
                    <Row sub option={O.wallpaperDock}>
                        <Toggle checked={desktop.wallpaperDock} onChange={desktop.setWallpaperDock} />
                    </Row>
                )}
            </Group>

            <FoldedGroup
                def={REMOTE}
                summary={remoteOnCount === 0 ? t('options.remoteControlGroupDefault') : t('options.remoteControlGroupOn', { count: remoteOnCount })}
            >
                <Row option={O.remoteTaskbarIcon}>
                    <Toggle checked={desktop.remoteTaskbarIcon} onChange={desktop.setRemoteTaskbarIcon} />
                </Row>
                <Row option={O.remoteTitlebar} hint={t('options.hideRemoteControlTitlebarHint')} note={t('options.hideRemoteControlTitlebarDesc')}>
                    <Toggle checked={desktop.remoteTitlebar} onChange={desktop.setRemoteTitlebar} />
                </Row>
                <Row option={O.remoteClickThrough} hint={t('options.remoteControlClickThroughHint')} note={t('options.remoteControlClickThroughDesc')}>
                    <Toggle checked={desktop.remoteClickThrough} onChange={desktop.setRemoteClickThrough} />
                </Row>
                <Row option={O.remoteExpandCover} hint={t('options.remoteControlExpandCoverHint')}>
                    <Toggle checked={desktop.remoteExpandCover} onChange={desktop.setRemoteExpandCover} />
                </Row>
                {/* Not greyed out: the transparent background is chosen in the remote window itself, so this page cannot tell. */}
                <Row option={O.remoteTextShade} hint={t('options.remoteControlTextShadeHint')}>
                    <Toggle checked={desktop.remoteTextShade} onChange={desktop.setRemoteTextShade} />
                </Row>
            </FoldedGroup>
        </>
    );
};

export default DesktopPage;
