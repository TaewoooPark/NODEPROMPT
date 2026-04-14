import type { LLMProvider, ProviderId } from './types';
import { PROVIDER_CATALOG } from './catalog';
import { createAnthropicProvider } from './providers/anthropic';
import { createOpenAICompatProvider } from './providers/openaiCompat';
import { createGeminiProvider } from './providers/gemini';

// ── 다중 프로바이더 키 저장소 ──
//
// 구 단일 키(nodeprompt_api_key)는 anthropic 슬롯으로 1회 마이그레이션.

const KEYS_STORAGE = 'nodeprompt_api_keys';
const ACTIVE_STORAGE = 'nodeprompt_active_provider';
const LEGACY_KEY_STORAGE = 'nodeprompt_api_key';

type KeyMap = Partial<Record<ProviderId, string>>;

function migrateLegacy(): void {
  try {
    const legacy = localStorage.getItem(LEGACY_KEY_STORAGE);
    if (!legacy) return;
    const raw = localStorage.getItem(KEYS_STORAGE);
    const map: KeyMap = raw ? JSON.parse(raw) : {};
    if (!map.anthropic) {
      map.anthropic = legacy;
      localStorage.setItem(KEYS_STORAGE, JSON.stringify(map));
    }
    localStorage.removeItem(LEGACY_KEY_STORAGE);
  } catch {
    // 무시
  }
}

function loadKeys(): KeyMap {
  migrateLegacy();
  try {
    const raw = localStorage.getItem(KEYS_STORAGE);
    if (!raw) return {};
    return JSON.parse(raw) as KeyMap;
  } catch {
    return {};
  }
}

function saveKeys(map: KeyMap): void {
  localStorage.setItem(KEYS_STORAGE, JSON.stringify(map));
}

export function getProviderKey(id: ProviderId): string {
  const map = loadKeys();
  if (map[id]) return map[id]!;
  // 환경변수 fallback (dev 편의)
  const envVars: Record<ProviderId, string | undefined> = {
    anthropic: import.meta.env.VITE_ANTHROPIC_API_KEY,
    openai: import.meta.env.VITE_OPENAI_API_KEY,
    gemini: import.meta.env.VITE_GEMINI_API_KEY,
    grok: import.meta.env.VITE_XAI_API_KEY,
    deepseek: import.meta.env.VITE_DEEPSEEK_API_KEY,
    qwen: import.meta.env.VITE_QWEN_API_KEY,
  };
  return envVars[id] ?? '';
}

export function setProviderKey(id: ProviderId, key: string): void {
  const map = loadKeys();
  if (key) map[id] = key;
  else delete map[id];
  saveKeys(map);
}

export function hasProviderKey(id: ProviderId): boolean {
  return Boolean(getProviderKey(id));
}

export function getActiveProviderId(): ProviderId {
  const saved = localStorage.getItem(ACTIVE_STORAGE) as ProviderId | null;
  if (saved && PROVIDER_CATALOG[saved]) return saved;
  return 'anthropic';
}

export function setActiveProviderId(id: ProviderId): void {
  localStorage.setItem(ACTIVE_STORAGE, id);
}

// ── 프로바이더 인스턴스 팩토리 ──

function createProvider(id: ProviderId): LLMProvider {
  switch (id) {
    case 'anthropic':
      return createAnthropicProvider(() => getProviderKey('anthropic'));
    case 'openai':
      return createOpenAICompatProvider({
        id: 'openai',
        baseURL: '/api/openai/v1',
        getKey: () => getProviderKey('openai'),
      });
    case 'grok':
      return createOpenAICompatProvider({
        id: 'grok',
        baseURL: '/api/xai/v1',
        getKey: () => getProviderKey('grok'),
      });
    case 'deepseek':
      return createOpenAICompatProvider({
        id: 'deepseek',
        baseURL: '/api/deepseek/v1',
        getKey: () => getProviderKey('deepseek'),
      });
    case 'qwen':
      return createOpenAICompatProvider({
        id: 'qwen',
        baseURL: '/api/qwen/compatible-mode/v1',
        getKey: () => getProviderKey('qwen'),
      });
    case 'gemini':
      return createGeminiProvider(() => getProviderKey('gemini'));
  }
}

// 캐시: 동일 프로바이더는 재사용
const cache = new Map<ProviderId, LLMProvider>();

export function getProvider(id?: ProviderId): LLMProvider {
  const pid = id ?? getActiveProviderId();
  let p = cache.get(pid);
  if (!p) {
    p = createProvider(pid);
    cache.set(pid, p);
  }
  return p;
}

export function resolveModelId(id: ProviderId, role: 'fast' | 'flagship'): string {
  return PROVIDER_CATALOG[id].defaultModels[role].id;
}
