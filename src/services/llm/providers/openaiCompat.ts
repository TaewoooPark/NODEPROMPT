import type {
  LLMProvider, ProviderId, StructuredCallOpts, SimpleCallOpts, StreamOpts,
} from '../types';
import { PROVIDER_CATALOG } from '../catalog';

// ── OpenAI 호환 API (OpenAI / Grok / DeepSeek / Qwen) ──
//
// 네 프로바이더 모두 /chat/completions, response_format json_schema, SSE를 공유한다.
// baseURL + auth 헤더만 다르다.

export interface OpenAICompatConfig {
  id: Extract<ProviderId, 'openai' | 'grok' | 'deepseek' | 'qwen'>;
  baseURL: string;
  getKey: () => string;
}

// Anthropic tool schema 포맷(`type: ['string', 'null']` 등)을 OpenAI strict json_schema로 변환
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeSchema(schema: any): any {
  if (Array.isArray(schema)) return schema.map(normalizeSchema);
  if (!schema || typeof schema !== 'object') return schema;

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema)) {
    if (k === 'type' && Array.isArray(v)) {
      // ['string', 'null'] → 'string' + nullable 처리는 strict 모드에서 까다로움
      // OpenAI strict 모드에서는 anyOf 사용
      const nonNull = v.filter((t) => t !== 'null');
      if (v.includes('null') && nonNull.length === 1) {
        // 단일 타입 + null → 그대로 배열 유지 (OpenAI는 union type 지원)
        out[k] = v;
      } else {
        out[k] = nonNull.length === 1 ? nonNull[0] : v;
      }
    } else {
      out[k] = normalizeSchema(v);
    }
  }

  // 오브젝트에 additionalProperties: false 강제 (OpenAI strict 요구)
  if (out.type === 'object' && out.properties && !('additionalProperties' in out)) {
    out.additionalProperties = false;
    // strict 모드는 모든 key가 required 여야 함 — 원본 required를 유지하고 부족분은 추가 안 함
    // (OpenAI strict는 까다롭지만 대부분 프로바이더는 permissive)
  }
  return out;
}

export function createOpenAICompatProvider(cfg: OpenAICompatConfig): LLMProvider {
  const { id, baseURL, getKey } = cfg;

  function headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getKey()}`,
    };
  }

  function modelFor(role: 'fast' | 'flagship'): string {
    return PROVIDER_CATALOG[id].defaultModels[role].id;
  }

  async function chatCompletions(body: Record<string, unknown>, signal?: AbortSignal): Promise<Response> {
    return fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: headers(),
      signal,
      body: JSON.stringify(body),
    });
  }

  return {
    id,

    async checkConnection(): Promise<boolean> {
      const key = getKey();
      if (!key) return false;
      try {
        const res = await chatCompletions({
          model: modelFor('fast'),
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        }, AbortSignal.timeout(10_000));
        return res.ok;
      } catch {
        return false;
      }
    },

    async callStructured(opts: StructuredCallOpts): Promise<unknown> {
      const schema = normalizeSchema(opts.tool.input_schema);
      const res = await chatCompletions({
        model: modelFor(opts.role),
        max_tokens: opts.maxTokens,
        temperature: opts.temperature,
        messages: [
          { role: 'system', content: opts.system },
          { role: 'user', content: opts.user },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: opts.tool.name,
            schema,
          },
        },
      }, opts.signal);

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`${id} API 오류: ${res.status} — ${body}`);
      }
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        throw new Error(`${id}가 JSON 콘텐츠를 반환하지 않았습니다.`);
      }
      try {
        return JSON.parse(content);
      } catch (e) {
        throw new Error(`${id} 응답 JSON 파싱 실패: ${(e as Error).message}`);
      }
    },

    async callSimple(opts: SimpleCallOpts): Promise<string> {
      const res = await chatCompletions({
        model: modelFor(opts.role),
        max_tokens: opts.maxTokens,
        temperature: opts.temperature,
        messages: [
          { role: 'system', content: opts.system },
          { role: 'user', content: opts.user },
        ],
      }, opts.signal ?? AbortSignal.timeout(15_000));
      if (!res.ok) throw new Error(`${id} API 오류: ${res.status}`);
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content ?? '';
      return String(text).trim();
    },

    async *stream(opts: StreamOpts): AsyncGenerator<string> {
      const res = await chatCompletions({
        model: modelFor(opts.role),
        max_tokens: opts.maxTokens,
        temperature: opts.temperature,
        stream: true,
        messages: [
          { role: 'system', content: opts.system },
          { role: 'user', content: opts.user },
        ],
      }, opts.signal);

      if (!res.ok || !res.body) {
        const body = await res.text().catch(() => '');
        throw new Error(`${id} 스트림 오류: ${res.status} — ${body}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const payload = line.slice(6).trim();
            if (payload === '[DONE]') return;
            try {
              const event = JSON.parse(payload);
              const delta = event.choices?.[0]?.delta?.content;
              if (typeof delta === 'string' && delta.length > 0) {
                yield delta;
              }
            } catch {
              // 파싱 불가 라인 무시
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    },
  };
}
