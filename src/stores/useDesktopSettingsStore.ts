// src/stores/useDesktopSettingsStore.ts
// Desktop-shell behaviour: tray and taskbar, close action, launch at login, wallpaper mode, display-sleep and voice-input
// interlocks, launch target, the experimental mod system switch, the Windows render GPU, and the
// opt-in background throttling.
//
// Split out of useSettingsUiStore.

import { create } from 'zustand';
import { getStoredBoolean, getStoredString, setStoredBoolean, setStoredString } from './storagePrimitives';
import { setStatusMessage } from './useStatusMessageStore';
import i18n from '../i18n/config';
import type { CloseMainPanelAction, LaunchAtLoginMode } from '../types';

// Mirrored from the main process's CLOSE_TO_TRAY, which the titlebar X (window-close IPC) consults.
export const CLOSE_TO_TRAY_STORAGE_KEY = 'close_to_tray';

// 关闭主面板的动作（tray / quit），与 CLOSE_TO_TRAY 一起由主进程 trayWindowBehavior 判定。
export const CLOSE_MAIN_PANEL_ACTION_STORAGE_KEY = 'close_main_panel_action';

// 开机自启以系统登录项为真源，这里只是镜像。
export const LAUNCH_AT_LOGIN_STORAGE_KEY = 'launch_at_login';

export const LAUNCH_AT_LOGIN_MODE_STORAGE_KEY = 'launch_at_login_mode';

export const VOICE_INPUT_PAUSE_STORAGE_KEY = 'voice_input_pause_enabled';

export const PREVENT_DISPLAY_SLEEP_DURING_PLAYBACK_STORAGE_KEY = 'prevent_display_sleep_during_playback';

export const MOD_SYSTEM_ENABLED_STORAGE_KEY = 'mod_system_enabled';

export const HIDE_TASKBAR_ICON_STORAGE_KEY = 'hide_taskbar_icon';

export const REMOTE_CONTROL_SKIP_TASKBAR_STORAGE_KEY = 'remote_control_skip_taskbar';

export const REMOTE_CONTROL_HIDE_TITLEBAR_STORAGE_KEY = 'remote_control_hide_titlebar';

export const REMOTE_CONTROL_CLICK_THROUGH_STORAGE_KEY = 'remote_control_click_through';

export const REMOTE_CONTROL_EXPAND_COVER_STORAGE_KEY = 'remote_control_expand_cover';

export const REMOTE_CONTROL_TEXT_SHADE_STORAGE_KEY = 'remote_control_text_shade';

export const WALLPAPER_MODE_STORAGE_KEY = 'wallpaper_mode';

export const WALLPAPER_ENTRY_CONFIRMED_STORAGE_KEY = 'wallpaper_entry_confirmed';

// macOS-only: auto-hide the Dock while a wallpaper session is active. On by default (a bottom Dock
// is hidden automatically; the switch is the explicit override the main process honours).
export const WALLPAPER_MAC_AUTOHIDE_DOCK_STORAGE_KEY = 'wallpaper_mac_autohide_dock';

export const OPEN_PLAYER_ON_LAUNCH_STORAGE_KEY = 'open_player_on_launch';

// Mirrored from the main process's GPU_PREFERENCE (electron/gpuPreference.cjs), which reads it
// before the GPU process starts. Windows only; a change takes effect on the next launch.
export const GPU_PREFERENCE_STORAGE_KEY = 'gpu_preference';

// Mirrored from the main process's BACKGROUND_THROTTLING (electron/backgroundThrottling.cjs), which
// applies it to the main window. Off by default: some streamers capture the window while it is covered.
export const BACKGROUND_THROTTLING_STORAGE_KEY = 'background_throttling';

/** Which GPU Chromium renders on: its own choice, the high-performance one, or the power-saving one. */
export type GpuPreference = 'auto' | 'high-performance' | 'low-power';

export const GPU_PREFERENCES: readonly GpuPreference[] = ['auto', 'high-performance', 'low-power'];

const readGpuPreference = (value: unknown): GpuPreference | null => (
    GPU_PREFERENCES.includes(value as GpuPreference) ? value as GpuPreference : null
);

const readCloseMainPanelAction = (value: unknown): CloseMainPanelAction | null => (
    value === 'tray' || value === 'quit' ? value : null
);

const readLaunchAtLoginMode = (value: unknown): LaunchAtLoginMode | null => (
    value === 'silent' || value === 'foreground' ? value : null
);

export type DesktopSettingsState = {
    /** Close button hides the main window to the tray instead of quitting the app. */
    closeToTray: boolean;
    /** 「关闭主面板」开着时点关闭执行的动作；选 quit 等同于关掉开关。 */
    closeMainPanelAction: CloseMainPanelAction;
    launchAtLogin: boolean;
    launchAtLoginMode: LaunchAtLoginMode;
    /** Transient (never persisted), from the main process: whether the OS login item can be set. */
    launchAtLoginSupported: boolean;
    voiceInputPauseEnabled: boolean;
    preventDisplaySleepDuringPlayback: boolean;
    /**
     * Master switch for the experimental mod system. Off by default: while it is
     * off the main process loads no mod at all and the mod commands stay out of
     * the palette, so an unfinished apiVersion 1 is opt-in rather than ambient.
     */
    modSystemEnabled: boolean;
    hideTaskbarIcon: boolean;
    hideRemoteControlTaskbarIcon: boolean;
    /** Remote control window: never reveal the top floating window-control bar. */
    hideRemoteControlTitlebar: boolean;
    /** Remote control window ignores the mouse (main process owns it; unlock from tray / palette). */
    remoteControlClickThrough: boolean;
    /** Remote control window: when idle, the cover opens into the large sleeve. On by default. */
    remoteControlExpandCover: boolean;
    /** Remote control window, transparent background: the idle type sits on a soft dark shade. Off by default. */
    remoteControlTextShade: boolean;
    wallpaperMode: boolean;
    /** Persisted: the one-time entry explanation has been accepted, so later entries go straight in. */
    wallpaperEntryConfirmed: boolean;
    /** Transient (never persisted): the "enter wallpaper mode?" confirmation is on screen. */
    wallpaperEntryConfirmOpen: boolean;
    /** macOS-only: auto-hide the Dock while wallpaper mode is active. On by default — a bottom Dock
     *  is hidden automatically; switching it off overrides the automatic rule. */
    wallpaperMacAutohideDock: boolean;
    openPlayerOnLaunch: boolean;
    /** Windows only: the saved GPU choice, which the next launch starts with. */
    gpuPreference: GpuPreference;
    /**
     * 后台节流: let Chromium throttle the window and hold the lyric animation while it is minimised or
     * hidden. The main process owns the value and stands it down where the window has to stay live
     * even out of sight (wallpaper, video export, OBS browser source).
     */
    backgroundThrottling: boolean;
    /** Transient (never persisted), from the main process: false on native Wayland, where always-on-top is silently ignored. */
    windowAlwaysOnTopSupported: boolean;
    setDesktopPreferenceSnapshot: (settings: { CLOSE_TO_TRAY?: unknown; CLOSE_MAIN_PANEL_ACTION?: unknown; LAUNCH_AT_LOGIN?: unknown; LAUNCH_AT_LOGIN_MODE?: unknown; LAUNCH_AT_LOGIN_SUPPORTED?: unknown; HIDE_TASKBAR_ICON?: unknown; REMOTE_CONTROL_SKIP_TASKBAR?: unknown; REMOTE_CONTROL_HIDE_TITLEBAR?: unknown; REMOTE_CONTROL_CLICK_THROUGH?: unknown; REMOTE_CONTROL_EXPAND_COVER?: unknown; REMOTE_CONTROL_TEXT_SHADE?: unknown; VOICE_INPUT_PAUSE_ENABLED?: unknown; PREVENT_DISPLAY_SLEEP_DURING_PLAYBACK?: unknown; MOD_SYSTEM_ENABLED?: unknown; GPU_PREFERENCE?: unknown; BACKGROUND_THROTTLING?: unknown; wallpaper_mode?: unknown; wallpaper_entry_confirmed?: unknown; wallpaper_mac_autohide_dock?: unknown; window_always_on_top_supported?: unknown; }) => void;
    handleToggleCloseToTray: (enable: boolean) => void;
    handleSetCloseMainPanelAction: (action: CloseMainPanelAction) => void;
    handleToggleLaunchAtLogin: (enable: boolean) => void;
    handleSetLaunchAtLoginMode: (mode: LaunchAtLoginMode) => void;
    handleToggleVoiceInputPause: (enable: boolean) => void;
    handleToggleModSystem: (enable: boolean) => void;
    handleTogglePreventDisplaySleepDuringPlayback: (enable: boolean) => void;
    handleToggleHideTaskbarIcon: (enable: boolean) => void;
    handleToggleHideRemoteControlTaskbarIcon: (enable: boolean) => void;
    handleToggleHideRemoteControlTitlebar: (enable: boolean) => void;
    handleToggleRemoteControlClickThrough: (enable: boolean) => void;
    handleToggleRemoteControlExpandCover: (enable: boolean) => void;
    handleToggleRemoteControlTextShade: (enable: boolean) => void;
    /**
     * The user-facing wallpaper switch (settings card, command palette, tray request). Leaving
     * applies at once; the first-ever entry opens the confirmation and waits for
     * confirmWallpaperEntry, later entries apply directly.
     */
    handleToggleWallpaperMode: (enable: boolean) => void;
    /** Unconfirmed apply. Only the confirmation and programmatic callers may use it. */
    applyWallpaperMode: (enable: boolean) => void;
    confirmWallpaperEntry: () => void;
    cancelWallpaperEntry: () => void;
    handleToggleWallpaperMacAutohideDock: (enable: boolean) => void;
    handleToggleOpenPlayerOnLaunch: (enable: boolean) => void;
    handleSetGpuPreference: (preference: GpuPreference) => void;
    handleToggleBackgroundThrottling: (enable: boolean) => void;
};

export const useDesktopSettingsStore = create<DesktopSettingsState>((set, get) => ({
    closeToTray: getStoredBoolean(CLOSE_TO_TRAY_STORAGE_KEY, false),
    closeMainPanelAction: readCloseMainPanelAction(getStoredString(CLOSE_MAIN_PANEL_ACTION_STORAGE_KEY, 'tray')) ?? 'tray',
    launchAtLogin: getStoredBoolean(LAUNCH_AT_LOGIN_STORAGE_KEY, false),
    launchAtLoginMode: readLaunchAtLoginMode(getStoredString(LAUNCH_AT_LOGIN_MODE_STORAGE_KEY, 'silent')) ?? 'silent',
    launchAtLoginSupported: false,
    voiceInputPauseEnabled: getStoredBoolean(VOICE_INPUT_PAUSE_STORAGE_KEY, false),
    preventDisplaySleepDuringPlayback: getStoredBoolean(PREVENT_DISPLAY_SLEEP_DURING_PLAYBACK_STORAGE_KEY, false),
    modSystemEnabled: getStoredBoolean(MOD_SYSTEM_ENABLED_STORAGE_KEY, false),
    hideTaskbarIcon: getStoredBoolean(HIDE_TASKBAR_ICON_STORAGE_KEY, false),
    hideRemoteControlTaskbarIcon: getStoredBoolean(REMOTE_CONTROL_SKIP_TASKBAR_STORAGE_KEY, false),
    hideRemoteControlTitlebar: getStoredBoolean(REMOTE_CONTROL_HIDE_TITLEBAR_STORAGE_KEY, false),
    remoteControlClickThrough: getStoredBoolean(REMOTE_CONTROL_CLICK_THROUGH_STORAGE_KEY, false),
    remoteControlExpandCover: getStoredBoolean(REMOTE_CONTROL_EXPAND_COVER_STORAGE_KEY, true),
    remoteControlTextShade: getStoredBoolean(REMOTE_CONTROL_TEXT_SHADE_STORAGE_KEY, false),
    wallpaperMode: getStoredBoolean(WALLPAPER_MODE_STORAGE_KEY, false),
    wallpaperEntryConfirmed: getStoredBoolean(WALLPAPER_ENTRY_CONFIRMED_STORAGE_KEY, false),
    wallpaperEntryConfirmOpen: false,
    wallpaperMacAutohideDock: getStoredBoolean(WALLPAPER_MAC_AUTOHIDE_DOCK_STORAGE_KEY, true),
    openPlayerOnLaunch: getStoredBoolean(OPEN_PLAYER_ON_LAUNCH_STORAGE_KEY, false),
    gpuPreference: readGpuPreference(getStoredString(GPU_PREFERENCE_STORAGE_KEY, 'auto')) ?? 'auto',
    backgroundThrottling: getStoredBoolean(BACKGROUND_THROTTLING_STORAGE_KEY, false),
    windowAlwaysOnTopSupported: true,
    setDesktopPreferenceSnapshot: (settings) => {
        const patch: Partial<DesktopSettingsState> = {};
        if (typeof settings.CLOSE_TO_TRAY === 'boolean') {
            patch.closeToTray = settings.CLOSE_TO_TRAY;
            setStoredBoolean(CLOSE_TO_TRAY_STORAGE_KEY, settings.CLOSE_TO_TRAY);
        }
        const closeMainPanelAction = readCloseMainPanelAction(settings.CLOSE_MAIN_PANEL_ACTION);
        if (closeMainPanelAction) {
            patch.closeMainPanelAction = closeMainPanelAction;
            setStoredString(CLOSE_MAIN_PANEL_ACTION_STORAGE_KEY, closeMainPanelAction);
        }
        // 开机自启以系统登录项为真源，主进程回传的状态直接覆盖本地缓存。
        if (typeof settings.LAUNCH_AT_LOGIN === 'boolean') {
            patch.launchAtLogin = settings.LAUNCH_AT_LOGIN;
            setStoredBoolean(LAUNCH_AT_LOGIN_STORAGE_KEY, settings.LAUNCH_AT_LOGIN);
        }
        const launchAtLoginMode = readLaunchAtLoginMode(settings.LAUNCH_AT_LOGIN_MODE);
        if (launchAtLoginMode) {
            patch.launchAtLoginMode = launchAtLoginMode;
            setStoredString(LAUNCH_AT_LOGIN_MODE_STORAGE_KEY, launchAtLoginMode);
        }
        if (typeof settings.LAUNCH_AT_LOGIN_SUPPORTED === 'boolean') {
            patch.launchAtLoginSupported = settings.LAUNCH_AT_LOGIN_SUPPORTED;
        }
        if (typeof settings.VOICE_INPUT_PAUSE_ENABLED === 'boolean') {
            patch.voiceInputPauseEnabled = settings.VOICE_INPUT_PAUSE_ENABLED;
            setStoredBoolean(VOICE_INPUT_PAUSE_STORAGE_KEY, settings.VOICE_INPUT_PAUSE_ENABLED);
        }
        if (typeof settings.PREVENT_DISPLAY_SLEEP_DURING_PLAYBACK === 'boolean') {
            patch.preventDisplaySleepDuringPlayback = settings.PREVENT_DISPLAY_SLEEP_DURING_PLAYBACK;
            setStoredBoolean(PREVENT_DISPLAY_SLEEP_DURING_PLAYBACK_STORAGE_KEY, settings.PREVENT_DISPLAY_SLEEP_DURING_PLAYBACK);
        }
        if (typeof settings.MOD_SYSTEM_ENABLED === 'boolean') {
            patch.modSystemEnabled = settings.MOD_SYSTEM_ENABLED;
            setStoredBoolean(MOD_SYSTEM_ENABLED_STORAGE_KEY, settings.MOD_SYSTEM_ENABLED);
        }
        if (typeof settings.HIDE_TASKBAR_ICON === 'boolean') {
            patch.hideTaskbarIcon = settings.HIDE_TASKBAR_ICON;
            setStoredBoolean(HIDE_TASKBAR_ICON_STORAGE_KEY, settings.HIDE_TASKBAR_ICON);
        }
        if (typeof settings.REMOTE_CONTROL_SKIP_TASKBAR === 'boolean') {
            patch.hideRemoteControlTaskbarIcon = settings.REMOTE_CONTROL_SKIP_TASKBAR;
            setStoredBoolean(REMOTE_CONTROL_SKIP_TASKBAR_STORAGE_KEY, settings.REMOTE_CONTROL_SKIP_TASKBAR);
        }
        if (typeof settings.REMOTE_CONTROL_HIDE_TITLEBAR === 'boolean') {
            patch.hideRemoteControlTitlebar = settings.REMOTE_CONTROL_HIDE_TITLEBAR;
            setStoredBoolean(REMOTE_CONTROL_HIDE_TITLEBAR_STORAGE_KEY, settings.REMOTE_CONTROL_HIDE_TITLEBAR);
        }
        if (typeof settings.REMOTE_CONTROL_CLICK_THROUGH === 'boolean') {
            patch.remoteControlClickThrough = settings.REMOTE_CONTROL_CLICK_THROUGH;
            setStoredBoolean(REMOTE_CONTROL_CLICK_THROUGH_STORAGE_KEY, settings.REMOTE_CONTROL_CLICK_THROUGH);
        }
        if (typeof settings.REMOTE_CONTROL_EXPAND_COVER === 'boolean') {
            patch.remoteControlExpandCover = settings.REMOTE_CONTROL_EXPAND_COVER;
            setStoredBoolean(REMOTE_CONTROL_EXPAND_COVER_STORAGE_KEY, settings.REMOTE_CONTROL_EXPAND_COVER);
        }
        if (typeof settings.REMOTE_CONTROL_TEXT_SHADE === 'boolean') {
            patch.remoteControlTextShade = settings.REMOTE_CONTROL_TEXT_SHADE;
            setStoredBoolean(REMOTE_CONTROL_TEXT_SHADE_STORAGE_KEY, settings.REMOTE_CONTROL_TEXT_SHADE);
        }
        if (typeof settings.wallpaper_mode === 'boolean') {
            patch.wallpaperMode = settings.wallpaper_mode;
            setStoredBoolean(WALLPAPER_MODE_STORAGE_KEY, settings.wallpaper_mode);
        }
        if (typeof settings.wallpaper_entry_confirmed === 'boolean') {
            const confirmed = get().wallpaperEntryConfirmed || settings.wallpaper_entry_confirmed;
            patch.wallpaperEntryConfirmed = confirmed;
            setStoredBoolean(WALLPAPER_ENTRY_CONFIRMED_STORAGE_KEY, confirmed);
        }
        if (typeof settings.wallpaper_mac_autohide_dock === 'boolean') {
            patch.wallpaperMacAutohideDock = settings.wallpaper_mac_autohide_dock;
            setStoredBoolean(WALLPAPER_MAC_AUTOHIDE_DOCK_STORAGE_KEY, settings.wallpaper_mac_autohide_dock);
        }
        const gpuPreference = readGpuPreference(settings.GPU_PREFERENCE);
        if (gpuPreference) {
            patch.gpuPreference = gpuPreference;
            setStoredString(GPU_PREFERENCE_STORAGE_KEY, gpuPreference);
        }
        if (typeof settings.BACKGROUND_THROTTLING === 'boolean') {
            patch.backgroundThrottling = settings.BACKGROUND_THROTTLING;
            setStoredBoolean(BACKGROUND_THROTTLING_STORAGE_KEY, settings.BACKGROUND_THROTTLING);
        }
        if (typeof settings.window_always_on_top_supported === 'boolean') {
            patch.windowAlwaysOnTopSupported = settings.window_always_on_top_supported;
        }
        set(patch);
    },
    handleToggleCloseToTray: (enable) => {
        setStoredBoolean(CLOSE_TO_TRAY_STORAGE_KEY, enable);
        set({ closeToTray: enable });
        if (window.electron?.saveSettings) {
            void window.electron.saveSettings('CLOSE_TO_TRAY', enable);
        }
        // 提示报实际效果：开关开着但动作选了退出，关闭仍是退出。
        const hidesToTray = enable && get().closeMainPanelAction === 'tray';
        setStatusMessage({
            type: 'info',
            text: i18n.t('notifications.' + (hidesToTray ? 'closeToTray' : 'closeToQuit')),
        });
    },
    handleSetCloseMainPanelAction: (action) => {
        setStoredString(CLOSE_MAIN_PANEL_ACTION_STORAGE_KEY, action);
        set({ closeMainPanelAction: action });
        if (window.electron?.saveSettings) {
            void window.electron.saveSettings('CLOSE_MAIN_PANEL_ACTION', action);
        }
        setStatusMessage({
            type: 'info',
            text: i18n.t('notifications.' + (action === 'tray' ? 'closeToTray' : 'closeToQuit')),
        });
    },
    handleToggleLaunchAtLogin: (enable) => {
        setStoredBoolean(LAUNCH_AT_LOGIN_STORAGE_KEY, enable);
        set({ launchAtLogin: enable });
        if (window.electron?.saveSettings) {
            void window.electron.saveSettings('LAUNCH_AT_LOGIN', enable);
        }
        setStatusMessage({
            type: 'info',
            text: i18n.t('notifications.' + (enable ? 'launchAtLoginOn' : 'launchAtLoginOff')),
        });
    },
    handleSetLaunchAtLoginMode: (mode) => {
        setStoredString(LAUNCH_AT_LOGIN_MODE_STORAGE_KEY, mode);
        set({ launchAtLoginMode: mode });
        // 登录项参数随模式变化，主进程要重写注册项，否则下次开机仍按旧模式启动。
        if (window.electron?.saveSettings) {
            void window.electron.saveSettings('LAUNCH_AT_LOGIN_MODE', mode);
        }
        setStatusMessage({
            type: 'info',
            text: i18n.t('notifications.' + (mode === 'foreground' ? 'launchAtLoginForeground' : 'launchAtLoginSilent')),
        });
    },
    handleToggleVoiceInputPause: (enable) => {
        setStoredBoolean(VOICE_INPUT_PAUSE_STORAGE_KEY, enable);
        set({ voiceInputPauseEnabled: enable });
        if (window.electron?.saveSettings) {
            void window.electron.saveSettings('VOICE_INPUT_PAUSE_ENABLED', enable);
        }
        setStatusMessage({
            type: 'info',
            text: i18n.t('notifications.' + (enable ? 'voiceInputPauseOn' : 'voiceInputPauseOff')),
        });
    },
    // The main process owns the authoritative value: it decides whether any mod
    // is loaded at all, so the switch is persisted there and only mirrored here.
    handleToggleModSystem: (enable) => {
        setStoredBoolean(MOD_SYSTEM_ENABLED_STORAGE_KEY, enable);
        set({ modSystemEnabled: enable });
        if (window.electron?.saveSettings) {
            void window.electron.saveSettings('MOD_SYSTEM_ENABLED', enable);
        }
    },
    handleTogglePreventDisplaySleepDuringPlayback: (enable) => {
        setStoredBoolean(PREVENT_DISPLAY_SLEEP_DURING_PLAYBACK_STORAGE_KEY, enable);
        set({ preventDisplaySleepDuringPlayback: enable });
        if (window.electron?.saveSettings) {
            void window.electron.saveSettings('PREVENT_DISPLAY_SLEEP_DURING_PLAYBACK', enable);
        }
        setStatusMessage({
            type: 'info',
            text: i18n.t('notifications.' + (enable ? 'preventDisplaySleepOn' : 'preventDisplaySleepOff')),
        });
    },
    handleToggleHideTaskbarIcon: (enable) => {
        setStoredBoolean(HIDE_TASKBAR_ICON_STORAGE_KEY, enable);
        set({ hideTaskbarIcon: enable });
        if (window.electron?.saveSettings) {
            void window.electron.saveSettings('HIDE_TASKBAR_ICON', enable);
        }
        setStatusMessage({
            type: 'info',
            text: i18n.t('notifications.' + (enable ? 'taskbarHidden' : 'taskbarRestored')),
        });
    },
    handleToggleHideRemoteControlTaskbarIcon: (enable) => {
        setStoredBoolean(REMOTE_CONTROL_SKIP_TASKBAR_STORAGE_KEY, enable);
        set({ hideRemoteControlTaskbarIcon: enable });
        if (window.electron?.saveSettings) {
            void window.electron.saveSettings('REMOTE_CONTROL_SKIP_TASKBAR', enable);
        }
    },
    handleToggleHideRemoteControlTitlebar: (enable) => {
        setStoredBoolean(REMOTE_CONTROL_HIDE_TITLEBAR_STORAGE_KEY, enable);
        set({ hideRemoteControlTitlebar: enable });
        if (window.electron?.saveSettings) {
            void window.electron.saveSettings('REMOTE_CONTROL_HIDE_TITLEBAR', enable);
        }
    },
    handleToggleRemoteControlClickThrough: (enable) => {
        setStoredBoolean(REMOTE_CONTROL_CLICK_THROUGH_STORAGE_KEY, enable);
        set({ remoteControlClickThrough: enable });
        if (window.electron?.saveSettings) {
            void window.electron.saveSettings('REMOTE_CONTROL_CLICK_THROUGH', enable);
        }
    },
    handleToggleRemoteControlExpandCover: (enable) => {
        setStoredBoolean(REMOTE_CONTROL_EXPAND_COVER_STORAGE_KEY, enable);
        set({ remoteControlExpandCover: enable });
        if (window.electron?.saveSettings) {
            void window.electron.saveSettings('REMOTE_CONTROL_EXPAND_COVER', enable);
        }
    },
    handleToggleRemoteControlTextShade: (enable) => {
        setStoredBoolean(REMOTE_CONTROL_TEXT_SHADE_STORAGE_KEY, enable);
        set({ remoteControlTextShade: enable });
        if (window.electron?.saveSettings) {
            void window.electron.saveSettings('REMOTE_CONTROL_TEXT_SHADE', enable);
        }
    },
    handleToggleWallpaperMode: (enable) => {
        // Entering sinks the window under the desktop and takes the keyboard away, so the first
        // entry asks first. Startup restore never lands here: it arrives through
        // setDesktopPreferenceSnapshot. Cancelling does not consume the warning.
        if (enable && !get().wallpaperMode && !get().wallpaperEntryConfirmed) {
            set({ wallpaperEntryConfirmOpen: true });
            return;
        }
        get().applyWallpaperMode(enable);
    },
    confirmWallpaperEntry: () => {
        // The dialog's buttons stay clickable during its exit animation: a second click, or a
        // Confirm after Cancel, must not apply (or re-apply) the entry.
        if (!get().wallpaperEntryConfirmOpen) {
            return;
        }
        set({ wallpaperEntryConfirmOpen: false });
        get().applyWallpaperMode(true);
    },
    cancelWallpaperEntry: () => {
        set({ wallpaperEntryConfirmOpen: false });
    },
    applyWallpaperMode: (enable) => {
        setStoredBoolean(WALLPAPER_MODE_STORAGE_KEY, enable);
        set({ wallpaperMode: enable });
        if (enable) {
            setStoredBoolean(WALLPAPER_ENTRY_CONFIRMED_STORAGE_KEY, true);
            set({ wallpaperEntryConfirmed: true });
            if (window.electron?.saveSettings) {
                void window.electron.saveSettings('wallpaper_entry_confirmed', true);
            }
        }
        if (window.electron?.saveSettings) {
            // The main process schedules a full relaunch after this IPC returns.
            void window.electron.saveSettings('wallpaper_mode', enable);
        }
        setStatusMessage({
            type: 'info',
            text: i18n.t('notifications.' + (enable ? 'wallpaperModeOn' : 'wallpaperModeOff')),
        });
    },
    // macOS-only: explicit override for the position-aware Dock auto-hide. The main process applies
    // it live on an already-active wallpaper session; otherwise it takes effect on the next entry.
    handleToggleWallpaperMacAutohideDock: (enable) => {
        setStoredBoolean(WALLPAPER_MAC_AUTOHIDE_DOCK_STORAGE_KEY, enable);
        set({ wallpaperMacAutohideDock: enable });
        if (window.electron?.saveSettings) {
            void window.electron.saveSettings(WALLPAPER_MAC_AUTOHIDE_DOCK_STORAGE_KEY, enable);
        }
        setStatusMessage({
            type: 'info',
            text: i18n.t('notifications.' + (enable ? 'macWallpaperAutohideDockOn' : 'macWallpaperAutohideDockOff')),
        });
    },
    handleToggleOpenPlayerOnLaunch: (enable) => {
        setStoredBoolean(OPEN_PLAYER_ON_LAUNCH_STORAGE_KEY, enable);
        set({ openPlayerOnLaunch: enable });
        setStatusMessage({
            type: 'info',
            text: i18n.t('notifications.' + (enable ? 'openPlayerOnLaunch' : 'openHomeOnLaunch')),
        });
    },
    // The main process owns the value: it adds the Chromium switch before the next launch's GPU process starts.
    handleSetGpuPreference: (preference) => {
        if (preference === get().gpuPreference) {
            return;
        }
        setStoredString(GPU_PREFERENCE_STORAGE_KEY, preference);
        set({ gpuPreference: preference });
        if (window.electron?.saveSettings) {
            void window.electron.saveSettings('GPU_PREFERENCE', preference);
        }
        setStatusMessage({
            type: 'info',
            text: i18n.t('notifications.gpuPreferenceChanged'),
        });
    },
    // The main process owns the value: it switches the window's throttling and tells the renderer.
    handleToggleBackgroundThrottling: (enable) => {
        setStoredBoolean(BACKGROUND_THROTTLING_STORAGE_KEY, enable);
        set({ backgroundThrottling: enable });
        if (window.electron?.saveSettings) {
            void window.electron.saveSettings('BACKGROUND_THROTTLING', enable);
        }
        setStatusMessage({
            type: 'info',
            text: i18n.t('notifications.' + (enable ? 'backgroundThrottlingOn' : 'backgroundThrottlingOff')),
        });
    },
}));

/**
 * The DesktopSettings half of the former settings snapshot, for the surfaces that
 * legitimately edit this whole domain at once. Ordinary consumers select one field instead.
 */
export const selectDesktopSettingsSnapshot = (state: DesktopSettingsState) => ({
    closeToTray: state.closeToTray,
    closeMainPanelAction: state.closeMainPanelAction,
    launchAtLogin: state.launchAtLogin,
    launchAtLoginMode: state.launchAtLoginMode,
    launchAtLoginSupported: state.launchAtLoginSupported,
    voiceInputPauseEnabled: state.voiceInputPauseEnabled,
    preventDisplaySleepDuringPlayback: state.preventDisplaySleepDuringPlayback,
    modSystemEnabled: state.modSystemEnabled,
    hideTaskbarIcon: state.hideTaskbarIcon,
    hideRemoteControlTaskbarIcon: state.hideRemoteControlTaskbarIcon,
    hideRemoteControlTitlebar: state.hideRemoteControlTitlebar,
    remoteControlClickThrough: state.remoteControlClickThrough,
    remoteControlExpandCover: state.remoteControlExpandCover,
    remoteControlTextShade: state.remoteControlTextShade,
    wallpaperMode: state.wallpaperMode,
    wallpaperMacAutohideDock: state.wallpaperMacAutohideDock,
    openPlayerOnLaunch: state.openPlayerOnLaunch,
    handleToggleCloseToTray: state.handleToggleCloseToTray,
    handleSetCloseMainPanelAction: state.handleSetCloseMainPanelAction,
    handleToggleLaunchAtLogin: state.handleToggleLaunchAtLogin,
    handleSetLaunchAtLoginMode: state.handleSetLaunchAtLoginMode,
    handleToggleVoiceInputPause: state.handleToggleVoiceInputPause,
    handleToggleModSystem: state.handleToggleModSystem,
    handleTogglePreventDisplaySleepDuringPlayback: state.handleTogglePreventDisplaySleepDuringPlayback,
    handleToggleHideTaskbarIcon: state.handleToggleHideTaskbarIcon,
    handleToggleHideRemoteControlTaskbarIcon: state.handleToggleHideRemoteControlTaskbarIcon,
    handleToggleHideRemoteControlTitlebar: state.handleToggleHideRemoteControlTitlebar,
    handleToggleRemoteControlClickThrough: state.handleToggleRemoteControlClickThrough,
    handleToggleRemoteControlExpandCover: state.handleToggleRemoteControlExpandCover,
    handleToggleRemoteControlTextShade: state.handleToggleRemoteControlTextShade,
    handleToggleWallpaperMode: state.handleToggleWallpaperMode,
    handleToggleWallpaperMacAutohideDock: state.handleToggleWallpaperMacAutohideDock,
    handleToggleOpenPlayerOnLaunch: state.handleToggleOpenPlayerOnLaunch,
    setDesktopPreferenceSnapshot: state.setDesktopPreferenceSnapshot,
});
