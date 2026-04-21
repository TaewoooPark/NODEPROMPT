import type { ProviderId, ModelInfo } from './types';

// 2026-04-14 시점 스냅샷. listModels() 실패 시 fallback으로 사용.
// 각 프로바이더의 fast(추출용)와 flagship(생성용) 역할로 분기.

export interface ProviderMeta {
  id: ProviderId;
  label: string;
  short: string;
  keyHint: string;
  docsUrl: string;
  defaultModels: {
    fast: ModelInfo;
    flagship: ModelInfo;
  };
  /** 멀티모달 첨부 지원 여부 (현재 catalog의 default 모델 기준) */
  supports: {
    image: boolean;
    pdf: boolean;
  };
  /** 특정 모델이 표준 API 키 외에 추가 활성화/인증을 요구하는 경우의 사용자 안내. */
  note?: {
    ko: string;
    en: string;
  };
}

export const PROVIDER_CATALOG: Record<ProviderId, ProviderMeta> = {
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic',
    short: 'Claude',
    keyHint: 'sk-ant-...',
    docsUrl: 'https://docs.anthropic.com',
    defaultModels: {
      fast: { id: 'claude-haiku-4-5-20251001', role: 'fast', label: 'Claude Haiku 4.5' },
      flagship: { id: 'claude-sonnet-4-6', role: 'flagship', label: 'Claude Sonnet 4.6' },
    },
    supports: { image: true, pdf: true },
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    short: 'GPT',
    keyHint: 'sk-...',
    docsUrl: 'https://platform.openai.com',
    defaultModels: {
      fast: { id: 'gpt-5.4-mini', role: 'fast', label: 'GPT-5.4 Mini' },
      flagship: { id: 'gpt-5.4', role: 'flagship', label: 'GPT-5.4' },
    },
    supports: { image: true, pdf: false },
    note: {
      ko: 'gpt-5.4 플래그십 모델은 OpenAI 대시보드에서 조직 인증(Verified Organization)이 선행되어야 호출됩니다. gpt-5.4-mini 까지는 일반 키로 동작합니다.',
      en: 'The gpt-5.4 flagship model requires Verified Organization status on the OpenAI dashboard. Standard keys can still reach gpt-5.4-mini.',
    },
  },
  gemini: {
    id: 'gemini',
    label: 'Google',
    short: 'Gemini',
    keyHint: 'AIza...',
    docsUrl: 'https://ai.google.dev',
    defaultModels: {
      fast: { id: 'gemini-2.5-flash', role: 'fast', label: 'Gemini 2.5 Flash' },
      flagship: { id: 'gemini-3.1-pro', role: 'flagship', label: 'Gemini 3.1 Pro' },
    },
    supports: { image: true, pdf: true },
    note: {
      ko: 'gemini-3.1-pro 는 결제(Billing)가 활성화된 유료 티어 키가 필요합니다. 무료 AI Studio 키로는 gemini-2.5-flash 까지만 호출됩니다.',
      en: 'gemini-3.1-pro requires a paid-tier key with billing enabled. Free AI Studio keys can only reach gemini-2.5-flash.',
    },
  },
  grok: {
    id: 'grok',
    label: 'xAI',
    short: 'Grok',
    keyHint: 'xai-...',
    docsUrl: 'https://docs.x.ai',
    defaultModels: {
      fast: { id: 'grok-4-1-fast-non-reasoning', role: 'fast', label: 'Grok 4.1 Fast' },
      flagship: { id: 'grok-4-1-fast-reasoning', role: 'flagship', label: 'Grok 4.1 Fast Reasoning' },
    },
    supports: { image: true, pdf: false },
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    short: 'DeepSeek',
    keyHint: 'sk-...',
    docsUrl: 'https://api-docs.deepseek.com',
    defaultModels: {
      fast: { id: 'deepseek-chat', role: 'fast', label: 'DeepSeek V3.2 Chat' },
      flagship: { id: 'deepseek-reasoner', role: 'flagship', label: 'DeepSeek Reasoner' },
    },
    supports: { image: false, pdf: false },
  },
  qwen: {
    id: 'qwen',
    label: 'Alibaba',
    short: 'Qwen',
    keyHint: 'sk-...',
    docsUrl: 'https://www.alibabacloud.com/help/en/model-studio',
    defaultModels: {
      fast: { id: 'qwen3.5-flash', role: 'fast', label: 'Qwen3.5 Flash' },
      flagship: { id: 'qwen3-max', role: 'flagship', label: 'Qwen3 Max' },
    },
    supports: { image: false, pdf: false },
    note: {
      ko: 'qwen3-max 는 DashScope 콘솔에서 모델별 사용 신청(Activation)을 먼저 완료해야 호출됩니다. qwen3.5-flash 는 기본 활성화되어 있습니다.',
      en: 'qwen3-max requires per-model activation in the DashScope console before it can be called. qwen3.5-flash is enabled by default.',
    },
  },
};

export const PROVIDER_ORDER: ProviderId[] = [
  'anthropic', 'openai', 'gemini', 'grok', 'deepseek', 'qwen',
];
