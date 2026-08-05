import { describe, expect, it } from 'vitest';

// test/unit/electron/launchAtLogin.test.ts
// 锁定开机自启的平台支持范围、开发态入口路径处理、读写参数的对称性，
// 以及静默启动标记只出现在写入参数里（查询参数带上它会匹配不到已注册项）。

type LoginItemQuery = { path?: string; args?: string[] };

const {
    SILENT_LAUNCH_FLAG,
    isLaunchAtLoginSupported,
    isSilentLaunch,
    buildLoginItemQuery,
    buildLoginItemSettings,
} = require('../../../electron/launchAtLogin.cjs') as {
    SILENT_LAUNCH_FLAG: string;
    isLaunchAtLoginSupported: (platform: string) => boolean;
    isSilentLaunch: (argv: unknown) => boolean;
    buildLoginItemQuery: (input: {
        execPath: string;
        isPackaged: boolean;
        appPath?: string;
        mode?: 'silent' | 'foreground';
    }) => LoginItemQuery;
    buildLoginItemSettings: (input: {
        enabled: boolean;
        mode?: 'silent' | 'foreground';
        execPath: string;
        isPackaged: boolean;
        appPath?: string;
    }) => { openAtLogin: boolean; openAsHidden: boolean } & LoginItemQuery;
};

const devContext = {
    execPath: 'C:/repo/node_modules/electron/dist/electron.exe',
    isPackaged: false,
    appPath: 'C:/repo',
};

const packagedContext = {
    execPath: 'C:/Program Files/Folia/Folia.exe',
    isPackaged: true,
    appPath: 'C:/Program Files/Folia/resources/app.asar',
};

describe('isLaunchAtLoginSupported', () => {
    it('在 macOS 与 Windows 上受支持', () => {
        expect(isLaunchAtLoginSupported('darwin')).toBe(true);
        expect(isLaunchAtLoginSupported('win32')).toBe(true);
    });

    it('Linux 不受支持，需要用户自建 autostart 项', () => {
        expect(isLaunchAtLoginSupported('linux')).toBe(false);
    });
});

describe('buildLoginItemSettings', () => {
    it('打包后不写死可执行文件路径，只带静默标记', () => {
        expect(buildLoginItemSettings({ enabled: true, mode: 'silent', ...packagedContext }))
            .toEqual({ openAtLogin: true, openAsHidden: true, args: [SILENT_LAUNCH_FLAG] });
    });

    it('前台模式不带静默标记，macOS 的 openAsHidden 同步关闭', () => {
        const settings = buildLoginItemSettings({ enabled: true, mode: 'foreground', ...packagedContext });

        expect(settings).toEqual({ openAtLogin: true, openAsHidden: false });
    });

    it('开发态显式带上应用入口，避免注册成 Electron 本体', () => {
        const settings = buildLoginItemSettings({ enabled: true, mode: 'foreground', ...devContext });

        expect(settings.path).toBe(devContext.execPath);
        expect(settings.args).toEqual([devContext.appPath]);
    });

    it('开发态静默启动在入口路径之后追加标记', () => {
        const settings = buildLoginItemSettings({ enabled: true, mode: 'silent', ...devContext });

        expect(settings.args).toEqual([devContext.appPath, SILENT_LAUNCH_FLAG]);
    });

    it('未指定模式时默认静默启动', () => {
        expect(buildLoginItemSettings({ enabled: true, ...packagedContext }).openAsHidden).toBe(true);
    });

    it('关闭时同样返回 openAtLogin: false', () => {
        expect(buildLoginItemSettings({ enabled: false, ...packagedContext }).openAtLogin).toBe(false);
    });
});

// Windows 的 getLoginItemSettings 按 path + args 比对注册项：
// 写入带 path/args 而读取不带，会匹配不到刚写入的记录并误报未开启。
describe('buildLoginItemQuery 与写入参数保持对称', () => {
    it('开发态查询参数与写入的 path / args 完全一致（前台模式）', () => {
        const written = buildLoginItemSettings({ enabled: true, mode: 'foreground', ...devContext });
        const query = buildLoginItemQuery({ ...devContext, mode: 'foreground' });

        expect(query).toEqual({ path: written.path, args: written.args });
    });

    it('静默模式的查询参数同样带上标记，否则读回来会误报未开启', () => {
        const written = buildLoginItemSettings({ enabled: true, mode: 'silent', ...devContext });
        const query = buildLoginItemQuery({ ...devContext, mode: 'silent' });

        expect(query).toEqual({ path: written.path, args: written.args });
        expect(query.args).toContain(SILENT_LAUNCH_FLAG);
    });

    it('打包态静默查询只带标记，前台查询为空', () => {
        expect(buildLoginItemQuery({ ...packagedContext, mode: 'silent' })).toEqual({ args: [SILENT_LAUNCH_FLAG] });
        expect(buildLoginItemQuery({ ...packagedContext, mode: 'foreground' })).toEqual({});
    });

    it('打包态不写死可执行文件路径', () => {
        const written = buildLoginItemSettings({ enabled: true, mode: 'foreground', ...packagedContext });

        expect(buildLoginItemQuery({ ...packagedContext, mode: 'foreground' })).toEqual({});
        expect(written.path).toBeUndefined();
    });

    it('缺少 appPath 时退回默认定位，不构造半截参数', () => {
        expect(buildLoginItemQuery({ execPath: devContext.execPath, isPackaged: false, mode: 'foreground' })).toEqual({});
    });
});

describe('isSilentLaunch', () => {
    it('命令行带标记时判定为静默启动', () => {
        expect(isSilentLaunch(['folia.exe', SILENT_LAUNCH_FLAG])).toBe(true);
    });

    it('普通启动与非数组入参都判定为否', () => {
        expect(isSilentLaunch(['folia.exe'])).toBe(false);
        expect(isSilentLaunch(undefined)).toBe(false);
    });
});
