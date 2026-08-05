// electron/aiProviderAdapters.cjs
// 各家 AI 供应商的请求适配器。抽成独立模块的理由是它们的差异是**结构性**的，
// 不是几个 if 能盖住的：Anthropic 用 /v1/messages + x-api-key + 顶层 system + 必填
// max_tokens，响应在 content[].text；OpenAI 系走 /v1/chat/completions + Bearer，
// 响应在 choices[0].message.content。强行塞进一条链路只会让两边都别扭。
//
// 模块只做纯计算（端点、请求头、请求体、抽取文本），不发请求，便于单测覆盖。

const ANTHROPIC_VERSION = '2023-06-01';
/** Anthropic 的 max_tokens 是必填项，主题 JSON 撑死几百 token，留足余量即可。 */
const ANTHROPIC_MAX_TOKENS = 4096;

const trimOrEmpty = (value) => (typeof value === 'string' ? value.trim() : '');

/** 把用户填的基地址补成完整端点。已经写到具体路径的就原样用，不去猜。 */
function resolveEndpoint(rawBaseUrl, fallbackBaseUrl, endpointPath) {
  const trimmed = trimOrEmpty(rawBaseUrl) || fallbackBaseUrl;

  try {
    const parsed = new URL(trimmed);
    const normalizedPath = parsed.pathname.replace(/\/+$/, '');

    // 已经指到具体端点（.../chat/completions、.../messages）就别再拼。
    if (normalizedPath.endsWith(endpointPath)) {
      parsed.pathname = normalizedPath;
      return parsed.toString();
    }

    if (!normalizedPath || normalizedPath === '/') {
      parsed.pathname = `/v1${endpointPath}`;
      return parsed.toString();
    }

    if (/\/v\d+$/.test(normalizedPath) || /\/compatible-mode\/v\d+$/.test(normalizedPath)) {
      parsed.pathname = `${normalizedPath}${endpointPath}`;
      return parsed.toString();
    }

    parsed.pathname = normalizedPath;
    return parsed.toString();
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}

/** 从可能带 markdown 围栏的文本里取出 JSON 主体。 */
function stripJsonFence(text) {
  const trimmed = trimOrEmpty(text);
  if (!trimmed.startsWith('```')) {
    return trimmed;
  }

  return trimmed.replace(/^```(json)?\s*\n?/, '').replace(/\n?```$/, '').trim();
}

function extractChatCompletionsText(payload) {
  const message = payload?.choices?.[0]?.message;
  if (!message) {
    return null;
  }

  if (typeof message.refusal === 'string' && message.refusal.trim()) {
    throw new Error(`Model refused request: ${message.refusal}`);
  }

  if (typeof message.content === 'string') {
    return message.content;
  }

  if (Array.isArray(message.content)) {
    const text = message.content
      .filter((part) => part && typeof part === 'object' && part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('');
    return text || null;
  }

  return null;
}

function extractAnthropicText(payload) {
  if (payload?.stop_reason === 'refusal') {
    throw new Error('Model refused request.');
  }

  if (!Array.isArray(payload?.content)) {
    return null;
  }

  const text = payload.content
    .filter((part) => part && typeof part === 'object' && part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('');
  return text || null;
}

const bearerHeaders = (apiKey) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${apiKey}`,
});

const chatCompletionsBody = ({ model, systemPrompt, sourcePrompt, temperature }) => ({
  model,
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: sourcePrompt },
  ],
  temperature,
  response_format: { type: 'json_object' },
});

const AI_PROVIDER_ADAPTERS = {
  // OpenAI 独家支持 json_schema 严格结构化输出，能直接消掉一类解析失败。
  openai: {
    id: 'openai',
    label: 'OpenAI 及兼容接口',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    endpointPath: '/chat/completions',
    buildHeaders: bearerHeaders,
    buildRequestBody: ({ model, systemPrompt, sourcePrompt, temperature, jsonSchema, jsonSchemaName }) => (
      jsonSchema
        ? {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: sourcePrompt },
          ],
          temperature,
          response_format: {
            type: 'json_schema',
            json_schema: { name: jsonSchemaName, strict: true, schema: jsonSchema },
          },
        }
        : chatCompletionsBody({ model, systemPrompt, sourcePrompt, temperature })
    ),
    extractText: extractChatCompletionsText,
  },

  // Anthropic 原生 Messages API：鉴权头、system 位置、响应结构都与 OpenAI 系不同。
  claude: {
    id: 'claude',
    label: 'Anthropic Claude',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-sonnet-4-5',
    endpointPath: '/messages',
    buildHeaders: (apiKey) => ({
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    }),
    // Anthropic 没有 response_format，只能在提示里要求纯 JSON，
    // 再靠 stripJsonFence 兜住偶尔套出来的 markdown 围栏。
    buildRequestBody: ({ model, systemPrompt, sourcePrompt, temperature }) => ({
      model,
      max_tokens: ANTHROPIC_MAX_TOKENS,
      temperature,
      system: `${systemPrompt}\n\nRespond with a single raw JSON object only. Do not wrap it in markdown fences and do not add commentary.`,
      messages: [{ role: 'user', content: sourcePrompt }],
    }),
    extractText: extractAnthropicText,
  },

  grok: {
    id: 'grok',
    label: 'xAI Grok',
    defaultBaseUrl: 'https://api.x.ai/v1',
    defaultModel: 'grok-4',
    endpointPath: '/chat/completions',
    buildHeaders: bearerHeaders,
    buildRequestBody: chatCompletionsBody,
    extractText: extractChatCompletionsText,
  },

  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek 深度求索',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    endpointPath: '/chat/completions',
    buildHeaders: bearerHeaders,
    buildRequestBody: chatCompletionsBody,
    extractText: extractChatCompletionsText,
  },

  kimi: {
    id: 'kimi',
    label: 'Moonshot Kimi 月之暗面',
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k',
    endpointPath: '/chat/completions',
    buildHeaders: bearerHeaders,
    buildRequestBody: chatCompletionsBody,
    extractText: extractChatCompletionsText,
  },

  qwen: {
    id: 'qwen',
    label: 'Alibaba Qwen 通义千问',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    endpointPath: '/chat/completions',
    buildHeaders: bearerHeaders,
    buildRequestBody: chatCompletionsBody,
    extractText: extractChatCompletionsText,
  },
};

/**
 * 取某家供应商的凭据。每家独立存放，切换供应商不会互相冲掉。
 * openai 额外回落到历史上的扁平键（OPENAI_API_KEY 等），老用户升级后不用重填。
 */
function pickProviderCredentials(credentialMap, providerId, legacy) {
  const map = credentialMap && typeof credentialMap === 'object' ? credentialMap : {};
  const entry = map[providerId] && typeof map[providerId] === 'object' ? map[providerId] : {};
  const fallback = providerId === 'openai' && legacy && typeof legacy === 'object' ? legacy : {};
  const pick = (primary, secondary) => (
    trimOrEmpty(primary) || trimOrEmpty(secondary)
  );

  return {
    apiKey: pick(entry.apiKey, fallback.apiKey),
    apiUrl: pick(entry.apiUrl, fallback.apiUrl),
    apiModel: pick(entry.apiModel, fallback.apiModel),
  };
}

/** 未知供应商按 OpenAI 兼容处理 —— 用户填的自定义地址多半就是兼容端点。 */
function getAiProviderAdapter(providerId) {
  return AI_PROVIDER_ADAPTERS[providerId] || AI_PROVIDER_ADAPTERS.openai;
}

function resolveAdapterEndpoint(adapter, rawBaseUrl) {
  return resolveEndpoint(rawBaseUrl, adapter.defaultBaseUrl, adapter.endpointPath);
}

function resolveAdapterModel(adapter, configuredModel) {
  return trimOrEmpty(configuredModel) || adapter.defaultModel;
}

module.exports = {
  ANTHROPIC_VERSION,
  ANTHROPIC_MAX_TOKENS,
  AI_PROVIDER_ADAPTERS,
  getAiProviderAdapter,
  pickProviderCredentials,
  resolveAdapterEndpoint,
  resolveAdapterModel,
  stripJsonFence,
  extractChatCompletionsText,
  extractAnthropicText,
};
