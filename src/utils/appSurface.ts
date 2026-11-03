// src/utils/appSurface.ts
// Which root this window mounts, decided once from the URL. bootstrap.tsx picks the React root with
// it; features that only make sense in the main app window (the video layer, mod clients) read the
// same answer instead of re-parsing the URL.

const searchParams = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);

export const isObsBrowserSourceSurface = typeof window !== 'undefined'
    && (searchParams.get('obs') === '1' || window.location.pathname === '/obs');

export const obsSourceKind = searchParams.get('obsSource');

export const isRemoteControlSurface = !isObsBrowserSourceSurface && searchParams.get('remote') === '1';

/** 托盘自绘菜单窗口（主进程用 ?trayMenu=1 打开）：不跑模组，不算主窗口。 */
export const isTrayMenuSurface = !isObsBrowserSourceSurface && !isRemoteControlSurface && searchParams.get('trayMenu') === '1';

export const isMainAppSurface = typeof window !== 'undefined' && !isObsBrowserSourceSurface && !isRemoteControlSurface && !isTrayMenuSurface;
