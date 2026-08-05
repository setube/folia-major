import { describe, expect, it } from 'vitest';

// test/unit/electron/trayWindowBehavior.test.ts
// 锁定「关闭主面板」的拦截条件，避免退出流程或托盘缺失时窗口被隐藏后无法找回。

const { shouldHideMainWindowOnClose } = require('../../../electron/trayWindowBehavior.cjs') as {
    shouldHideMainWindowOnClose: (input: {
        hasTray: boolean;
        isQuitting: boolean;
        closeMainPanelEnabled: boolean;
        closeMainPanelAction: 'tray' | 'quit';
    }) => boolean;
};

const base = {
    hasTray: true,
    isQuitting: false,
    closeMainPanelEnabled: true,
    closeMainPanelAction: 'tray' as const,
};

describe('shouldHideMainWindowOnClose', () => {
    it('开关开启且选项为最小化到托盘时隐藏窗口而不是退出', () => {
        expect(shouldHideMainWindowOnClose(base)).toBe(true);
    });

    it('开关关闭时放行窗口关闭', () => {
        expect(shouldHideMainWindowOnClose({ ...base, closeMainPanelEnabled: false })).toBe(false);
    });

    it('选项为退出软件时放行窗口关闭', () => {
        expect(shouldHideMainWindowOnClose({ ...base, closeMainPanelAction: 'quit' })).toBe(false);
    });

    it('应用正在退出时放行窗口关闭，避免拦截 app.quit()', () => {
        expect(shouldHideMainWindowOnClose({ ...base, isQuitting: true })).toBe(false);
    });

    it('托盘创建失败时放行窗口关闭，避免窗口隐藏后无法找回', () => {
        expect(shouldHideMainWindowOnClose({ ...base, hasTray: false })).toBe(false);
    });
});
