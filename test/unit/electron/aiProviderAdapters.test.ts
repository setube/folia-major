import { describe, expect, it } from 'vitest';
import { AI_PROVIDER_PRESETS } from '@/services/aiProviders';

// test/unit/electron/aiProviderAdapters.test.ts
// 锁定各家适配器的结构性差异（端点、鉴权头、请求体、响应抽取），
// 并比对设置页预设与主进程适配器的默认值，防止改了一头忘了另一头。

type Adapter = {
    id: string;
    label: string;
    defaultBaseUrl: string;
    defaultModel: string;
    endpointPath: string;
    buildHeaders: (apiKey: string) => Record<string, string>;
    buildRequestBody: (input: {
        model: string;
        systemPrompt: string;
        sourcePrompt: string;
        temperature: number;
        jsonSchema?: unknown;
        jsonSchemaName?: string;
    }) => Record<string, any>;
    extractText: (payload: unknown) => string | null;
};

const {
    AI_PROVIDER_ADAPTERS,
    getAiProviderAdapter,
    resolveAdapterEndpoint,
    resolveAdapterModel,
    stripJsonFence,
} = require('../../../electron/aiProviderAdapters.cjs') as {
    AI_PROVIDER_ADAPTERS: Record<string, Adapter>;
    getAiProviderAdapter: (id: string) => Adapter;
    resolveAdapterEndpoint: (adapter: Adapter, rawBaseUrl?: string) => string;
    resolveAdapterModel: (adapter: Adapter, configuredModel?: string) => string;
    stripJsonFence: (text: string) => string;
};

const promptInput = {
    model: 'test-model',
    systemPrompt: 'system',
    sourcePrompt: 'source',
    temperature: 0.7,
};

describe('getAiProviderAdapter', () => {
    it('五家新供应商各自有独立适配器', () => {
        for (const id of ['claude', 'grok', 'deepseek', 'kimi', 'qwen']) {
            expect(getAiProviderAdapter(id).id).toBe(id);
        }
    });

    it('未知供应商按 OpenAI 兼容处理，不静默回落到别家', () => {
        expect(getAiProviderAdapter('somethingelse').id).toBe('openai');
        expect(getAiProviderAdapter('').id).toBe('openai');
    });
});

describe('鉴权头与端点按厂商区分', () => {
    it('Anthropic 用 x-api-key 加版本头，打到 /messages', () => {
        const adapter = getAiProviderAdapter('claude');
        const headers = adapter.buildHeaders('sk-ant-test');

        expect(headers['x-api-key']).toBe('sk-ant-test');
        expect(headers['anthropic-version']).toBeTruthy();
        expect(headers.Authorization).toBeUndefined();
        expect(resolveAdapterEndpoint(adapter, '')).toBe('https://api.anthropic.com/v1/messages');
    });

    it('OpenAI 系用 Bearer，打到 /chat/completions', () => {
        for (const id of ['openai', 'grok', 'deepseek', 'kimi', 'qwen']) {
            const adapter = getAiProviderAdapter(id);
            expect(adapter.buildHeaders('sk-test').Authorization).toBe('Bearer sk-test');
            expect(resolveAdapterEndpoint(adapter, '')).toMatch(/\/chat\/completions$/);
        }
    });

    it('Qwen 的兼容模式路径不会被当成普通路径截断', () => {
        expect(resolveAdapterEndpoint(getAiProviderAdapter('qwen'), ''))
            .toBe('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
    });
});

describe('resolveAdapterEndpoint', () => {
    const adapter = () => getAiProviderAdapter('deepseek');

    it('只给域名时补上 /v1 与端点路径', () => {
        expect(resolveAdapterEndpoint(adapter(), 'https://example.com'))
            .toBe('https://example.com/v1/chat/completions');
    });

    it('给到版本号时只补端点路径', () => {
        expect(resolveAdapterEndpoint(adapter(), 'https://example.com/v3'))
            .toBe('https://example.com/v3/chat/completions');
    });

    it('已经写到完整端点时原样使用，不重复拼接', () => {
        expect(resolveAdapterEndpoint(adapter(), 'https://example.com/v1/chat/completions'))
            .toBe('https://example.com/v1/chat/completions');
    });

    it('留空时退回该厂商默认地址', () => {
        expect(resolveAdapterEndpoint(adapter(), '   ')).toBe('https://api.deepseek.com/v1/chat/completions');
    });
});

describe('resolveAdapterModel', () => {
    it('用户填了就用用户的，留空退回厂商默认', () => {
        const adapter = getAiProviderAdapter('kimi');

        expect(resolveAdapterModel(adapter, ' kimi-k2 ')).toBe('kimi-k2');
        expect(resolveAdapterModel(adapter, '')).toBe('moonshot-v1-8k');
        expect(resolveAdapterModel(adapter, undefined)).toBe('moonshot-v1-8k');
    });
});

describe('请求体结构', () => {
    it('Anthropic 把 system 提到顶层，并带上必填的 max_tokens', () => {
        const body = getAiProviderAdapter('claude').buildRequestBody(promptInput);

        expect(body.system).toContain('system');
        expect(body.max_tokens).toBeGreaterThan(0);
        expect(body.messages).toHaveLength(1);
        expect(body.messages[0].role).toBe('user');
        // Anthropic 没有 response_format，不能照抄 OpenAI 的字段。
        expect(body.response_format).toBeUndefined();
    });

    it('OpenAI 在给了 schema 时走严格结构化输出', () => {
        const body = getAiProviderAdapter('openai').buildRequestBody({
            ...promptInput,
            jsonSchema: { type: 'object' },
            jsonSchemaName: 'theme',
        });

        expect(body.response_format.type).toBe('json_schema');
        expect(body.response_format.json_schema.strict).toBe(true);
        expect(body.response_format.json_schema.name).toBe('theme');
    });

    it('OpenAI 没有 schema 时退回 json_object', () => {
        expect(getAiProviderAdapter('openai').buildRequestBody(promptInput).response_format)
            .toEqual({ type: 'json_object' });
    });

    it('其余兼容厂商统一用 json_object，不发 json_schema', () => {
        for (const id of ['grok', 'deepseek', 'kimi', 'qwen']) {
            const body = getAiProviderAdapter(id).buildRequestBody({
                ...promptInput,
                jsonSchema: { type: 'object' },
                jsonSchemaName: 'theme',
            });

            expect(body.response_format).toEqual({ type: 'json_object' });
            expect(body.messages[0].role).toBe('system');
        }
    });
});

describe('响应抽取', () => {
    it('Anthropic 从 content[].text 拼出正文', () => {
        const adapter = getAiProviderAdapter('claude');

        expect(adapter.extractText({ content: [{ type: 'text', text: '{"a":' }, { type: 'text', text: '1}' }] }))
            .toBe('{"a":1}');
        expect(adapter.extractText({ content: [] })).toBeNull();
    });

    it('OpenAI 系从 choices[0].message.content 取，拒答要抛出', () => {
        const adapter = getAiProviderAdapter('grok');

        expect(adapter.extractText({ choices: [{ message: { content: 'ok' } }] })).toBe('ok');
        expect(() => adapter.extractText({ choices: [{ message: { refusal: 'nope' } }] })).toThrow(/refused/i);
        expect(adapter.extractText({ choices: [] })).toBeNull();
    });
});

describe('stripJsonFence', () => {
    it('剥掉 markdown 围栏，裸 JSON 原样返回', () => {
        expect(stripJsonFence('```json\n{"a":1}\n```')).toBe('{"a":1}');
        expect(stripJsonFence('```\n{"a":1}\n```')).toBe('{"a":1}');
        expect(stripJsonFence('  {"a":1}  ')).toBe('{"a":1}');
    });
});

// 设置页只把预设填进输入框，真正发请求的是主进程适配器；两边默认值必须一致。
describe('设置页预设与主进程适配器保持同步', () => {
    it('每个非 Gemini 预设都有对应适配器，且地址与默认模型一致', () => {
        const presets = AI_PROVIDER_PRESETS.filter(preset => preset.id !== 'gemini');

        expect(presets.length).toBeGreaterThan(0);
        for (const preset of presets) {
            const adapter = AI_PROVIDER_ADAPTERS[preset.id];
            expect(adapter, `缺少 ${preset.id} 的适配器`).toBeTruthy();
            expect(preset.apiUrl).toBe(adapter.defaultBaseUrl);
            expect(preset.defaultModel).toBe(adapter.defaultModel);
            expect(preset.label).toBe(adapter.label);
        }
    });
});

describe('pickProviderCredentials', () => {
    const { pickProviderCredentials } = require('../../../electron/aiProviderAdapters.cjs') as {
        pickProviderCredentials: (
            map: unknown,
            id: string,
            legacy?: { apiKey?: string; apiUrl?: string; apiModel?: string },
        ) => { apiKey: string; apiUrl: string; apiModel: string };
    };

    it('各家凭据互不干扰', () => {
        const map = {
            claude: { apiKey: 'sk-ant', apiUrl: 'https://a', apiModel: 'm-a' },
            grok: { apiKey: 'sk-grok', apiUrl: 'https://g', apiModel: 'm-g' },
        };

        expect(pickProviderCredentials(map, 'claude').apiKey).toBe('sk-ant');
        expect(pickProviderCredentials(map, 'grok').apiKey).toBe('sk-grok');
        expect(pickProviderCredentials(map, 'kimi')).toEqual({ apiKey: '', apiUrl: '', apiModel: '' });
    });

    it('openai 回落到历史扁平键，老用户升级后不用重填', () => {
        const legacy = { apiKey: 'sk-legacy', apiUrl: 'https://legacy', apiModel: 'gpt-4o' };

        expect(pickProviderCredentials({}, 'openai', legacy)).toEqual(legacy);
        // 新键存在时优先用新键。
        expect(pickProviderCredentials({ openai: { apiKey: 'sk-new' } }, 'openai', legacy).apiKey).toBe('sk-new');
        // 回落只对 openai 生效，不能把 OpenAI 的 Key 漏给别家。
        expect(pickProviderCredentials({}, 'claude', legacy).apiKey).toBe('');
    });

    it('缺失或非法入参不抛异常', () => {
        expect(pickProviderCredentials(undefined, 'grok')).toEqual({ apiKey: '', apiUrl: '', apiModel: '' });
        expect(pickProviderCredentials('nonsense', 'grok')).toEqual({ apiKey: '', apiUrl: '', apiModel: '' });
    });
});
