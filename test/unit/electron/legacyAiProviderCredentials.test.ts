import { describe, expect, it } from 'vitest';

// test/unit/electron/legacyAiProviderCredentials.test.ts
// 合并前按厂商分存的明文 AI 凭据：启动时只把当前那家写回上游的扁平键，再删掉整张映射。

const { LEGACY_AI_PROVIDER_CREDENTIALS_SETTING_KEY, migrateLegacyAiProviderCredentials } = require('../../../electron/legacyAiProviderCredentials.cjs') as {
    LEGACY_AI_PROVIDER_CREDENTIALS_SETTING_KEY: string;
    migrateLegacyAiProviderCredentials: (store: MemoryStore) => boolean;
};

type MemoryStore = {
    get: (key: string) => unknown;
    set: (key: string, value: unknown) => void;
    delete: (key: string) => void;
    data: Map<string, unknown>;
};

const createStore = (initial: Record<string, unknown>): MemoryStore => {
    const data = new Map(Object.entries(initial));
    return {
        data,
        get: key => data.get(key),
        set: (key, value) => { data.set(key, value); },
        delete: key => { data.delete(key); },
    };
};

const LEGACY_MAP = {
    deepseek: { apiUrl: ' https://api.example.test/v1 ', apiModel: 'model-a', apiKey: 'sk-deepseek' },
    kimi: { apiUrl: 'https://kimi.example.test/v1', apiModel: 'model-b', apiKey: 'sk-kimi' },
};

describe('migrateLegacyAiProviderCredentials', () => {
    it('没有旧映射时什么都不动', () => {
        const store = createStore({ AI_PROVIDER: 'openai', OPENAI_API_URL: 'https://keep.test/v1' });

        expect(migrateLegacyAiProviderCredentials(store)).toBe(false);
        expect(Object.fromEntries(store.data)).toEqual({ AI_PROVIDER: 'openai', OPENAI_API_URL: 'https://keep.test/v1' });
    });

    it('当前厂商的一套写回扁平键，厂商改为 openai，密钥地址绑定清掉，映射删除', () => {
        const store = createStore({
            AI_PROVIDER: 'deepseek',
            [LEGACY_AI_PROVIDER_CREDENTIALS_SETTING_KEY]: LEGACY_MAP,
            OPENAI_API_KEY_ENDPOINT: 'https://old.test/v1',
        });

        expect(migrateLegacyAiProviderCredentials(store)).toBe(true);
        expect(Object.fromEntries(store.data)).toEqual({
            AI_PROVIDER: 'openai',
            OPENAI_API_URL: 'https://api.example.test/v1',
            OPENAI_API_MODEL: 'model-a',
            OPENAI_API_KEY: 'sk-deepseek',
        });
    });

    it('选的是 gemini：不碰 OpenAI 键，只删映射', () => {
        const store = createStore({
            AI_PROVIDER: 'gemini',
            [LEGACY_AI_PROVIDER_CREDENTIALS_SETTING_KEY]: LEGACY_MAP,
            OPENAI_API_URL: 'https://keep.test/v1',
        });

        migrateLegacyAiProviderCredentials(store);

        expect(Object.fromEntries(store.data)).toEqual({ AI_PROVIDER: 'gemini', OPENAI_API_URL: 'https://keep.test/v1' });
    });

    it('当前厂商没有存过凭据：保留已有扁平键与地址绑定', () => {
        const store = createStore({
            AI_PROVIDER: 'qwen',
            [LEGACY_AI_PROVIDER_CREDENTIALS_SETTING_KEY]: LEGACY_MAP,
            OPENAI_API_KEY_ENDPOINT: 'https://keep.test/v1',
        });

        migrateLegacyAiProviderCredentials(store);

        expect(Object.fromEntries(store.data)).toEqual({ AI_PROVIDER: 'openai', OPENAI_API_KEY_ENDPOINT: 'https://keep.test/v1' });
    });

    it('空白字段不覆盖已有值，没有新密钥时保留地址绑定', () => {
        const store = createStore({
            AI_PROVIDER: 'openai',
            [LEGACY_AI_PROVIDER_CREDENTIALS_SETTING_KEY]: { openai: { apiUrl: '  ', apiModel: 'gpt-x', apiKey: '' } },
            OPENAI_API_URL: 'https://keep.test/v1',
            OPENAI_API_KEY_ENDPOINT: 'https://keep.test/v1',
        });

        migrateLegacyAiProviderCredentials(store);

        expect(Object.fromEntries(store.data)).toEqual({
            AI_PROVIDER: 'openai',
            OPENAI_API_URL: 'https://keep.test/v1',
            OPENAI_API_MODEL: 'gpt-x',
            OPENAI_API_KEY_ENDPOINT: 'https://keep.test/v1',
        });
    });
});
