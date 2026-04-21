// ── 통일된 LLM 프로바이더 인터페이스 ──
//
// 목적: claude.ts의 orchestration 코드(4-pass, 재시도, 트리밍)를 그대로 두고
// 네트워크 레이어만 교체 가능하게 만든다.

export type ProviderId = 'anthropic' | 'openai' | 'gemini' | 'grok' | 'deepseek' | 'qwen';

export type ModelRole = 'fast' | 'flagship';

export interface ModelInfo {
  id: string;
  role: ModelRole;
  label?: string;
}

/** 프로바이더별 툴 정의 (Anthropic tool input_schema와 동일 포맷의 JSON Schema) */
export interface ToolDef {
  name: string;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input_schema: any;
}

/** 사용자 프롬프트와 함께 전송되는 멀티모달 첨부 */
export type Attachment =
  | { kind: 'image'; mimeType: string; dataBase64: string; name?: string }
  | { kind: 'pdf'; mimeType: 'application/pdf'; dataBase64: string; name?: string };

/** 특정 프로바이더가 지원하지 않는 첨부가 주어졌을 때 던지는 에러. */
export class UnsupportedAttachmentError extends Error {
  providerId: ProviderId;
  kind: Attachment['kind'];
  constructor(providerId: ProviderId, kind: Attachment['kind']) {
    super(`Provider '${providerId}' does not support ${kind} attachments.`);
    this.name = 'UnsupportedAttachmentError';
    this.providerId = providerId;
    this.kind = kind;
  }
}

export interface StructuredCallOpts {
  role: ModelRole;
  system: string;
  user: string;
  tool: ToolDef;
  temperature: number;
  maxTokens: number;
  signal: AbortSignal;
  attachments?: Attachment[];
}

export interface SimpleCallOpts {
  role: ModelRole;
  system: string;
  user: string;
  temperature: number;
  maxTokens: number;
  signal?: AbortSignal;
  attachments?: Attachment[];
}

export interface StreamOpts {
  role: ModelRole;
  system: string;
  user: string;
  temperature: number;
  maxTokens: number;
  signal: AbortSignal;
}

export interface LLMProvider {
  id: ProviderId;
  /** 최소 비용 핑 */
  checkConnection(): Promise<boolean>;
  /** 툴 강제 호출로 구조화 JSON을 얻어 반환 (파싱 전 raw input) */
  callStructured(opts: StructuredCallOpts): Promise<unknown>;
  /** 비구조화 단문 텍스트 생성 (generateNodeDescription 용) */
  callSimple(opts: SimpleCallOpts): Promise<string>;
  /** SSE 스트리밍 텍스트 생성 */
  stream(opts: StreamOpts): AsyncGenerator<string>;
}
