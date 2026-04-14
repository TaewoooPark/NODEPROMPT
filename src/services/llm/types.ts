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

export interface StructuredCallOpts {
  role: ModelRole;
  system: string;
  user: string;
  tool: ToolDef;
  temperature: number;
  maxTokens: number;
  signal: AbortSignal;
}

export interface SimpleCallOpts {
  role: ModelRole;
  system: string;
  user: string;
  temperature: number;
  maxTokens: number;
  signal?: AbortSignal;
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
