import type {
  LLMProvider, StructuredCallOpts, SimpleCallOpts, StreamOpts, Attachment,
} from '../types';
import { UnsupportedAttachmentError } from '../types';
import { PROVIDER_CATALOG } from '../catalog';

const BASE = '/api/anthropic/v1';

// user 메시지를 멀티모달 content 배열로 변환. attachments가 있으면 파일 블록들이 앞에,
// 텍스트는 마지막에 배치 (Anthropic 권장 순서 — 파일 → 지시).
function buildUserContent(user: string, attachments: readonly Attachment[] | undefined): unknown {
  if (!attachments || attachments.length === 0) return user;

  const blocks: unknown[] = [];
  for (const a of attachments) {
    if (a.kind === 'image') {
      blocks.push({
        type: 'image',
        source: { type: 'base64', media_type: a.mimeType, data: a.dataBase64 },
      });
    } else if (a.kind === 'pdf') {
      blocks.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: a.dataBase64 },
      });
    } else {
      throw new UnsupportedAttachmentError('anthropic', (a as Attachment).kind);
    }
  }
  blocks.push({ type: 'text', text: user });
  return blocks;
}

export function createAnthropicProvider(getKey: () => string): LLMProvider {
  function headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': getKey(),
      'anthropic-version': '2023-06-01',
    };
  }

  function modelFor(role: 'fast' | 'flagship'): string {
    return PROVIDER_CATALOG.anthropic.defaultModels[role].id;
  }

  return {
    id: 'anthropic',

    async checkConnection(): Promise<boolean> {
      const key = getKey();
      if (!key || key === 'your-api-key-here') return false;
      try {
        const res = await fetch(`${BASE}/messages`, {
          method: 'POST',
          headers: headers(),
          signal: AbortSignal.timeout(10_000),
          body: JSON.stringify({
            model: modelFor('fast'),
            max_tokens: 1,
            messages: [{ role: 'user', content: 'ping' }],
          }),
        });
        return res.ok;
      } catch {
        return false;
      }
    },

    async callStructured(opts: StructuredCallOpts): Promise<unknown> {
      const res = await fetch(`${BASE}/messages`, {
        method: 'POST',
        headers: headers(),
        signal: opts.signal,
        body: JSON.stringify({
          model: modelFor(opts.role),
          max_tokens: opts.maxTokens,
          temperature: opts.temperature,
          system: opts.system,
          messages: [{ role: 'user', content: buildUserContent(opts.user, opts.attachments) }],
          tools: [opts.tool],
          tool_choice: { type: 'tool', name: opts.tool.name },
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Anthropic API 오류: ${res.status} ${res.statusText} — ${body}`);
      }
      const data = await res.json();
      const toolBlock = data.content?.find((b: { type: string }) => b.type === 'tool_use');
      if (!toolBlock?.input) {
        throw new Error(`Anthropic가 ${opts.tool.name} tool_use 블록을 반환하지 않았습니다.`);
      }
      return toolBlock.input;
    },

    async callSimple(opts: SimpleCallOpts): Promise<string> {
      const res = await fetch(`${BASE}/messages`, {
        method: 'POST',
        headers: headers(),
        signal: opts.signal ?? AbortSignal.timeout(15_000),
        body: JSON.stringify({
          model: modelFor(opts.role),
          max_tokens: opts.maxTokens,
          temperature: opts.temperature,
          system: opts.system,
          messages: [{ role: 'user', content: buildUserContent(opts.user, opts.attachments) }],
        }),
      });
      if (!res.ok) throw new Error(`Anthropic API 오류: ${res.status}`);
      const data = await res.json();
      return (data.content?.[0]?.text ?? '').trim();
    },

    async *stream(opts: StreamOpts): AsyncGenerator<string> {
      const res = await fetch(`${BASE}/messages`, {
        method: 'POST',
        headers: headers(),
        signal: opts.signal,
        body: JSON.stringify({
          model: modelFor(opts.role),
          max_tokens: opts.maxTokens,
          temperature: opts.temperature,
          stream: true,
          system: opts.system,
          messages: [{ role: 'user', content: opts.user }],
        }),
      });
      if (!res.ok || !res.body) {
        const body = await res.text().catch(() => '');
        throw new Error(`Anthropic 스트림 오류: ${res.status} — ${body}`);
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
            const payload = line.slice(6);
            try {
              const event = JSON.parse(payload);
              if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                yield event.delta.text as string;
              }
              if (event.type === 'message_stop') return;
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
