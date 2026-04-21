import type {
  LLMProvider, StructuredCallOpts, SimpleCallOpts, StreamOpts, Attachment,
} from '../types';
import { UnsupportedAttachmentError } from '../types';
import { PROVIDER_CATALOG } from '../catalog';

// Gemini REST via generativelanguage.googleapis.com
// Vite 프록시: /api/gemini → https://generativelanguage.googleapis.com
// Gemini는 URL 쿼리스트링으로 key를 받는다.

const BASE = '/api/gemini/v1beta';

// Anthropic tool schema → Gemini responseSchema 변환
// Gemini 제약: additionalProperties 미지원, type union(['string','null']) 미지원 → nullable:true
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toGeminiSchema(schema: any): any {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (!schema || typeof schema !== 'object') return schema;

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema)) {
    if (k === 'additionalProperties') continue; // Gemini 미지원
    if (k === 'type' && Array.isArray(v)) {
      const nonNull = (v as string[]).filter((t) => t !== 'null');
      out.type = (nonNull[0] ?? 'string').toUpperCase();
      if ((v as string[]).includes('null')) out.nullable = true;
    } else if (k === 'type' && typeof v === 'string') {
      out.type = v.toUpperCase();
    } else {
      out[k] = toGeminiSchema(v);
    }
  }
  return out;
}

// 멀티모달 parts: 첨부는 앞에, 텍스트는 뒤에.
function buildUserParts(user: string, attachments: readonly Attachment[] | undefined): unknown[] {
  const parts: unknown[] = [];
  if (attachments) {
    for (const a of attachments) {
      if (a.kind === 'image' || a.kind === 'pdf') {
        parts.push({ inline_data: { mime_type: a.mimeType, data: a.dataBase64 } });
      } else {
        throw new UnsupportedAttachmentError('gemini', (a as Attachment).kind);
      }
    }
  }
  parts.push({ text: user });
  return parts;
}

export function createGeminiProvider(getKey: () => string): LLMProvider {
  function modelFor(role: 'fast' | 'flagship'): string {
    return PROVIDER_CATALOG.gemini.defaultModels[role].id;
  }

  function url(model: string, method: 'generateContent' | 'streamGenerateContent'): string {
    const key = getKey();
    const q = method === 'streamGenerateContent' ? '?alt=sse&key=' : '?key=';
    return `${BASE}/models/${model}:${method}${q}${encodeURIComponent(key)}`;
  }

  return {
    id: 'gemini',

    async checkConnection(): Promise<boolean> {
      const key = getKey();
      if (!key) return false;
      try {
        const res = await fetch(url(modelFor('fast'), 'generateContent'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(10_000),
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
            generationConfig: { maxOutputTokens: 1 },
          }),
        });
        return res.ok;
      } catch {
        return false;
      }
    },

    async callStructured(opts: StructuredCallOpts): Promise<unknown> {
      const schema = toGeminiSchema(opts.tool.input_schema);
      const res = await fetch(url(modelFor(opts.role), 'generateContent'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: opts.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: opts.system }] },
          contents: [{ role: 'user', parts: buildUserParts(opts.user, opts.attachments) }],
          generationConfig: {
            temperature: opts.temperature,
            maxOutputTokens: opts.maxTokens,
            responseMimeType: 'application/json',
            responseSchema: schema,
          },
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Gemini API 오류: ${res.status} — ${body}`);
      }
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text !== 'string') {
        throw new Error('Gemini가 JSON 텍스트를 반환하지 않았습니다.');
      }
      try {
        return JSON.parse(text);
      } catch (e) {
        throw new Error(`Gemini 응답 JSON 파싱 실패: ${(e as Error).message}`);
      }
    },

    async callSimple(opts: SimpleCallOpts): Promise<string> {
      const res = await fetch(url(modelFor(opts.role), 'generateContent'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: opts.signal ?? AbortSignal.timeout(15_000),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: opts.system }] },
          contents: [{ role: 'user', parts: buildUserParts(opts.user, opts.attachments) }],
          generationConfig: {
            temperature: opts.temperature,
            maxOutputTokens: opts.maxTokens,
          },
        }),
      });
      if (!res.ok) throw new Error(`Gemini API 오류: ${res.status}`);
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      return String(text).trim();
    },

    async *stream(opts: StreamOpts): AsyncGenerator<string> {
      const res = await fetch(url(modelFor(opts.role), 'streamGenerateContent'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: opts.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: opts.system }] },
          contents: [{ role: 'user', parts: [{ text: opts.user }] }],
          generationConfig: {
            temperature: opts.temperature,
            maxOutputTokens: opts.maxTokens,
          },
        }),
      });

      if (!res.ok || !res.body) {
        const body = await res.text().catch(() => '');
        throw new Error(`Gemini 스트림 오류: ${res.status} — ${body}`);
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
            if (!payload) continue;
            try {
              const event = JSON.parse(payload);
              const parts = event.candidates?.[0]?.content?.parts;
              if (Array.isArray(parts)) {
                for (const p of parts) {
                  if (typeof p.text === 'string' && p.text.length > 0) {
                    yield p.text;
                  }
                }
              }
            } catch {
              // 무시
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    },
  };
}
