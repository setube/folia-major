// electron/legacyAiProviderCredentials.cjs
// 合并上游 0.7.25 之前，设置页按厂商（claude / grok / deepseek / kimi / qwen / openai）各存一套明文凭据，
// AI_PROVIDER 存厂商 id。上游只认 gemini / openai：OpenAI 兼容连接的地址、模型、密钥存扁平键，
// 密钥由 aiCredentialStore 加密并绑定地址。
//
// 启动时把当前选中那家的一套写回扁平键（随后 aiCredentials.migrate() 加密、绑定），
// 再删掉整张明文映射，免得它随设置快照进渲染进程。只迁当前那家：其余厂商的凭据不保留。

const LEGACY_AI_PROVIDER_CREDENTIALS_SETTING_KEY = 'AI_PROVIDER_CREDENTIALS';

const FIELD_TO_SETTING_KEY = Object.freeze([
  ['apiUrl', 'OPENAI_API_URL'],
  ['apiModel', 'OPENAI_API_MODEL'],
  ['apiKey', 'OPENAI_API_KEY'],
]);

const trimmedString = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * @param {{ get: (key: string) => unknown, set: (key: string, value: unknown) => void, delete: (key: string) => void }} store
 * @returns {boolean} 是否发现并清理了旧映射
 */
function migrateLegacyAiProviderCredentials(store) {
  const map = store.get(LEGACY_AI_PROVIDER_CREDENTIALS_SETTING_KEY);
  if (map === undefined) {
    return false;
  }

  const provider = store.get('AI_PROVIDER');
  if (typeof provider === 'string' && provider !== 'gemini') {
    if (provider !== 'openai') {
      store.set('AI_PROVIDER', 'openai');
    }
    const credentials = map && typeof map === 'object' ? map[provider] : null;
    if (credentials && typeof credentials === 'object') {
      for (const [field, key] of FIELD_TO_SETTING_KEY) {
        const value = trimmedString(credentials[field]);
        if (value) {
          store.set(key, value);
        }
      }
      // 新写入的密钥按迁移后的地址重新绑定。
      if (trimmedString(credentials.apiKey)) {
        store.delete('OPENAI_API_KEY_ENDPOINT');
      }
    }
  }

  store.delete(LEGACY_AI_PROVIDER_CREDENTIALS_SETTING_KEY);
  return true;
}

module.exports = {
  LEGACY_AI_PROVIDER_CREDENTIALS_SETTING_KEY,
  migrateLegacyAiProviderCredentials,
};
