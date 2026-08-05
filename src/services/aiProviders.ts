// src/services/aiProviders.ts
// AI 供应商预设与凭据。
//
// 每家一套独立凭据：切换供应商时不该把上一家的 Key 冲掉，也不该让 Grok 的地址
// 顶在 Claude 的输入框里。凭据整体存成一个 AI_PROVIDER_CREDENTIALS 映射，
// 主进程按当前供应商取用（见 electron/aiProviderAdapters.cjs 的 pickProviderCredentials）。
//
// 这里的地址与默认模型必须与 electron/aiProviderAdapters.cjs 的同名字段保持一致：
// 设置页只负责把它们填进输入框，真正发请求的是主进程里的适配器。
// test/unit/electron/aiProviderAdapters.test.ts 会比对两边，防止改了一头忘了另一头。

export type AiProviderId = 'gemini' | 'openai' | 'claude' | 'grok' | 'deepseek' | 'kimi' | 'qwen';

export interface AiProviderPreset {
    id: AiProviderId;
    /** 完整品牌名：厂商 + 产品，避免只写产品名时认不出是谁家的。 */
    label: string;
    /** 接口基地址；Gemini 走原生 SDK，不需要填。 */
    apiUrl?: string;
    defaultModel?: string;
    /** 该家申请密钥的入口，设置页直接给个链接省得去搜。 */
    consoleUrl?: string;
}

export const AI_PROVIDER_PRESETS: readonly AiProviderPreset[] = [
    { id: 'gemini', label: 'Google Gemini', consoleUrl: 'https://aistudio.google.com/apikey' },
    { id: 'claude', label: 'Anthropic Claude', apiUrl: 'https://api.anthropic.com/v1', defaultModel: 'claude-sonnet-4-5', consoleUrl: 'https://console.anthropic.com/settings/keys' },
    { id: 'grok', label: 'xAI Grok', apiUrl: 'https://api.x.ai/v1', defaultModel: 'grok-4', consoleUrl: 'https://console.x.ai' },
    { id: 'deepseek', label: 'DeepSeek 深度求索', apiUrl: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat', consoleUrl: 'https://platform.deepseek.com/api_keys' },
    { id: 'kimi', label: 'Moonshot Kimi 月之暗面', apiUrl: 'https://api.moonshot.cn/v1', defaultModel: 'moonshot-v1-8k', consoleUrl: 'https://platform.moonshot.cn/console/api-keys' },
    { id: 'qwen', label: 'Alibaba Qwen 通义千问', apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen-plus', consoleUrl: 'https://bailian.console.aliyun.com' },
    { id: 'openai', label: 'OpenAI 及兼容接口', apiUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o', consoleUrl: 'https://platform.openai.com/api-keys' },
];

const PRESET_BY_ID = new Map(AI_PROVIDER_PRESETS.map(preset => [preset.id, preset]));

export interface AiProviderCredentials {
    apiKey: string;
    apiUrl: string;
    apiModel: string;
}

export type AiProviderCredentialMap = Partial<Record<AiProviderId, AiProviderCredentials>>;

export const EMPTY_AI_PROVIDER_CREDENTIALS: AiProviderCredentials = { apiKey: '', apiUrl: '', apiModel: '' };

export const isAiProviderId = (value: unknown): value is AiProviderId =>
    typeof value === 'string' && PRESET_BY_ID.has(value as AiProviderId);

export const getAiProviderPreset = (id: string): AiProviderPreset | undefined => PRESET_BY_ID.get(id as AiProviderId);

/** Gemini 之外一律走 OpenAI 兼容或各家原生适配器，未知取值按自定义处理。 */
export const isOpenAiCompatibleProvider = (id: string): boolean => id !== 'gemini';

export const getAiProviderLabel = (id: string): string => getAiProviderPreset(id)?.label ?? id;

export const readAiProviderCredentials = (
    map: AiProviderCredentialMap | undefined,
    id: string,
): AiProviderCredentials => ({ ...EMPTY_AI_PROVIDER_CREDENTIALS, ...(map?.[id as AiProviderId] ?? {}) });

export const writeAiProviderCredentials = (
    map: AiProviderCredentialMap | undefined,
    id: string,
    patch: Partial<AiProviderCredentials>,
): AiProviderCredentialMap => ({
    ...(map ?? {}),
    [id as AiProviderId]: { ...readAiProviderCredentials(map, id), ...patch },
});
