import {
  ExtractionResultSchema, EXTRACTION_TOOL, type ExtractionResult,
  buildHierarchicalTool,
  ThemeResultSchema, ConceptResultSchema, DetailResultSchema, CrossLinkResultSchema,
  ScaffoldResultSchema, FillResultSchema, ValidateResultSchema,
  SCAFFOLD_TOOL, FILL_TOOL, VALIDATE_TOOL,
  type ScaffoldNode, type FillNode, type PatchNode,
} from './schemas';
import {
  detectLanguage, getExtractionPrompt, getGenerationPrompt, getHierarchicalPrompt,
  getScaffoldPrompt, getFillPrompt, getValidatePrompt,
} from './prompts';
import type { ExtractionConfig } from '../types/extraction';
import { allocateBudget, allocateLevelBudget, computeBranchingFactor } from '../types/extraction';

// Vite 프록시를 통해 api.anthropic.com 으로 포워딩 (CORS 우회)
const API_BASE = '/api/anthropic/v1';
const EXTRACTION_MODEL = 'claude-haiku-4-5-20251001';
const GENERATION_MODEL = 'claude-sonnet-4-6';

const API_KEY_STORAGE = 'nodeprompt_api_key';

function getApiKey(): string {
  return localStorage.getItem(API_KEY_STORAGE) || import.meta.env.VITE_ANTHROPIC_API_KEY || '';
}

export function setApiKey(key: string): void {
  localStorage.setItem(API_KEY_STORAGE, key);
}

export function getSavedApiKey(): string {
  return getApiKey();
}

function headers(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-api-key': getApiKey(),
    'anthropic-version': '2023-06-01',
  };
}

let extractController: AbortController | null = null;
let streamController: AbortController | null = null;

/** 3-Phase용: 외부에서 controller 생성 후 cancelRequest로 취소 가능 */
export function createExtractController(timeoutMs = 300_000): AbortController {
  extractController?.abort();
  const controller = new AbortController();
  extractController = controller;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  controller.signal.addEventListener('abort', () => clearTimeout(timeoutId), { once: true });
  return controller;
}

// ── 연결 확인 ──

export async function checkClaudeConnection(): Promise<boolean> {
  const key = getApiKey();
  if (!key || key === 'your-api-key-here') return false;

  try {
    // 최소 비용 호출로 연결 + 키 유효성 확인
    const res = await fetch(`${API_BASE}/messages`, {
      method: 'POST',
      headers: headers(),
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        model: EXTRACTION_MODEL,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── 취소 ──

export function cancelRequest() {
  extractController?.abort();
  extractController = null;
  streamController?.abort();
  streamController = null;
}

// ── 노드 설명 자동 생성 ──

export async function generateNodeDescription(
  label: string,
  type: string,
  originalPrompt: string,
): Promise<string> {
  const key = getApiKey();
  if (!key) throw new Error('API 키가 설정되지 않았습니다.');

  const res = await fetch(`${API_BASE}/messages`, {
    method: 'POST',
    headers: headers(),
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({
      model: EXTRACTION_MODEL,
      max_tokens: 150,
      temperature: 0.3,
      system: 'You are a concise concept describer. Write a 1-2 sentence description of the given concept node. Respond ONLY with the description text, nothing else. Match the language of the original prompt.',
      messages: [{
        role: 'user',
        content: `Original prompt: "${originalPrompt}"\n\nNode label: "${label}"\nNode type: ${type}\n\nWrite a brief description:`,
      }],
    }),
  });

  if (!res.ok) throw new Error(`API 오류: ${res.status}`);
  const data = await res.json();
  const text = data.content?.[0]?.text ?? '';
  return text.trim();
}

// ── 노드 추출 (tool_use 기반 구조화 출력) ──

async function callClaudeExtract(
  prompt: string,
  systemPrompt: string,
  temperature: number,
  signal: AbortSignal,
): Promise<ExtractionResult> {
  const response = await fetch(`${API_BASE}/messages`, {
    method: 'POST',
    headers: headers(),
    signal,
    body: JSON.stringify({
      model: EXTRACTION_MODEL,
      max_tokens: 4096,
      temperature,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
      tools: [EXTRACTION_TOOL],
      tool_choice: { type: 'tool', name: 'extract_nodes' },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Claude API 오류: ${response.status} ${response.statusText} — ${errorBody}`);
  }

  const data = await response.json();

  // tool_use 블록에서 input 추출
  const toolBlock = data.content?.find(
    (block: { type: string }) => block.type === 'tool_use',
  );
  if (!toolBlock?.input) {
    throw new Error('Claude가 tool_use 블록을 반환하지 않았습니다.');
  }

  const validated = ExtractionResultSchema.parse(toolBlock.input);

  // 엣지 참조 무결성 검증
  const nodeIds = new Set(validated.nodes.map((n) => n.id));
  validated.edges = validated.edges.filter(
    (e) => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId),
  );

  return validated;
}

/**
 * 재시도 패턴으로 노드 추출.
 * AbortController 타임아웃 (60초).
 */
export async function extractNodes(prompt: string): Promise<ExtractionResult> {
  const lang = detectLanguage(prompt);
  const systemPrompt = getExtractionPrompt(lang);

  const controller = new AbortController();
  extractController = controller;
  const timeoutId = setTimeout(() => controller.abort(), 60_000);

  const attempts = [
    { temp: 0.1 },
    { temp: 0.3 },
    { temp: 0.5 },
  ];

  try {
    for (let i = 0; i < attempts.length; i++) {
      if (controller.signal.aborted) {
        throw new Error('요청이 취소되었습니다.');
      }
      const { temp } = attempts[i]!;
      try {
        const result = await callClaudeExtract(
          prompt,
          systemPrompt,
          temp,
          controller.signal,
        );
        return result;
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          throw new Error('요청이 취소되었거나 시간이 초과되었습니다.');
        }
        console.warn(`추출 시도 ${i + 1}/${attempts.length} 실패:`, error);
        if (i < attempts.length - 1) {
          await new Promise((r) => setTimeout(r, 500 * Math.pow(2, i)));
        }
      }
    }
    throw new Error('모든 추출 시도가 실패했습니다. API 키를 확인하세요.');
  } finally {
    clearTimeout(timeoutId);
    if (extractController === controller) extractController = null;
  }
}

// ── 스트리밍 응답 생성 (SSE) ──

export async function* streamResponse(
  synthesizedPrompt: string,
  lang: 'ko' | 'en' = 'ko',
): AsyncGenerator<string> {
  const controller = new AbortController();
  streamController = controller;

  const response = await fetch(`${API_BASE}/messages`, {
    method: 'POST',
    headers: headers(),
    signal: controller.signal,
    body: JSON.stringify({
      model: GENERATION_MODEL,
      max_tokens: 8192,
      temperature: 0.7,
      stream: true,
      system: getGenerationPrompt(lang),
      messages: [{ role: 'user', content: synthesizedPrompt }],
    }),
  });

  if (!response.ok || !response.body) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Claude 응답 생성 오류: ${response.status} — ${errorBody}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        // SSE format: "event: ...\n" "data: ...\n"
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6);
        try {
          const event = JSON.parse(payload);

          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            yield event.delta.text;
          }

          if (event.type === 'message_stop') return;
        } catch {
          // 파싱 불가 라인 무시
        }
      }
    }
  } finally {
    reader.releaseLock();
    if (streamController === controller) streamController = null;
  }
}

// ── 계층적 다단계 추출 ──

interface HierarchicalNode {
  id: string;
  label: string;
  type: string;
  weight: number;
  description: string;
  parentId: string | null;
  abstractionLevel: string;
  facets?: { cognitive: string; epistemological: string; rhetorical: string };
}

interface HierarchicalResult {
  nodes: HierarchicalNode[];
  edges: { sourceId: string; targetId: string; relation: string; strength: number }[];
}

function serializeTree(nodes: HierarchicalNode[]): string {
  const byParent = new Map<string | null, HierarchicalNode[]>();
  for (const n of nodes) {
    const list = byParent.get(n.parentId) ?? [];
    list.push(n);
    byParent.set(n.parentId, list);
  }
  function render(parentId: string | null, indent: number): string {
    const children = byParent.get(parentId) ?? [];
    return children
      .sort((a, b) => b.weight - a.weight)
      .map((n) => {
        const prefix = '  '.repeat(indent) + '- ';
        const meta = `[${n.abstractionLevel}, ${n.type}, w=${n.weight.toFixed(2)}]`;
        return `${prefix}${n.label} ${meta} (id: ${n.id})\n${render(n.id, indent + 1)}`;
      })
      .join('');
  }
  return render(null, 0) || '(empty)';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolDef = { name: string; description: string; input_schema: any };

async function callClaudePass(
  prompt: string,
  systemPrompt: string,
  tool: ToolDef,
  signal: AbortSignal,
  temperature = 0.2,
): Promise<unknown> {
  const response = await fetch(`${API_BASE}/messages`, {
    method: 'POST',
    headers: headers(),
    signal,
    body: JSON.stringify({
      model: EXTRACTION_MODEL,
      max_tokens: 8192,
      temperature,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
      tools: [tool],
      tool_choice: { type: 'tool', name: tool.name },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Claude API 오류: ${response.status} — ${body}`);
  }

  const data = await response.json();
  const toolBlock = data.content?.find((b: { type: string }) => b.type === 'tool_use');
  if (!toolBlock?.input) throw new Error(`Claude가 ${tool.name} 블록을 반환하지 않았습니다.`);
  return toolBlock.input;
}

/** 패스별 재시도 (temperature 올려가며 최대 2회) */
async function callPassWithRetry(
  prompt: string,
  systemPrompt: string,
  tool: ToolDef,
  signal: AbortSignal,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  validate: (raw: unknown) => any,
) {
  const temps = [0.2, 0.4, 0.6];
  for (let i = 0; i < temps.length; i++) {
    try {
      const raw = await callClaudePass(prompt, systemPrompt, tool, signal, temps[i]);
      return validate(raw);
    } catch (error) {
      console.warn(`Pass ${tool.name} 시도 ${i + 1}/${temps.length} 실패:`, error);
      if (i === temps.length - 1) throw error;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error('unreachable');
}

/**
 * 계층적 다단계 추출.
 * Pass 1: 테마 → Pass 2: 기본개념 → Pass 3: 세부 → Pass 4: 횡단연결
 */
export async function extractHierarchical(
  prompt: string,
  config: ExtractionConfig,
  onProgress?: (pass: number, total: number, nodesSoFar: number) => void,
): Promise<HierarchicalResult> {
  const lang = detectLanguage(prompt);
  const budget = allocateBudget(config.maxNodes, config.maxDepth);
  const branching = computeBranchingFactor(config.maxNodes, config.maxDepth);
  const totalPasses = config.maxDepth === 1 ? 1 : config.maxDepth === 2 ? 2 : 4;

  /** 예산 초과 시 weight 순 트리밍 */
  function trimTobudget<T extends { weight: number }>(items: T[], max: number): T[] {
    if (items.length <= max) return items;
    return [...items].sort((a, b) => b.weight - a.weight).slice(0, max);
  }

  const controller = new AbortController();
  extractController = controller;
  const timeoutId = setTimeout(() => controller.abort(), 300_000); // 5분 (4패스 × 재시도)

  const allNodes: HierarchicalNode[] = [];
  const allEdges: { sourceId: string; targetId: string; relation: string; strength: number }[] = [];

  try {
    const nodeIds = new Set<string>();

    // Pass 1: 테마 추출
    onProgress?.(1, totalPasses, 0);
    const tool1 = buildHierarchicalTool(1, config);
    const sys1 = getHierarchicalPrompt(1, lang, { budget: budget.pass1, branchingFactor: branching });
    const pass1 = await callPassWithRetry(prompt, sys1, tool1, controller.signal,
      (raw) => ThemeResultSchema.parse(raw));
    const trimmed1 = trimTobudget(pass1.nodes, budget.pass1);
    for (const n of trimmed1) {
      allNodes.push({ ...n, parentId: null, abstractionLevel: 'superordinate' });
      nodeIds.add(n.id);
    }
    onProgress?.(1, totalPasses, allNodes.length);

    if (config.maxDepth < 2) {
      return { nodes: allNodes, edges: allEdges };
    }

    // Pass 2: 기본개념 확장
    onProgress?.(2, totalPasses, allNodes.length);
    const tool2 = buildHierarchicalTool(2, config);
    const sys2 = getHierarchicalPrompt(2, lang, {
      budget: budget.pass2,
      branchingFactor: branching,
      existingTree: serializeTree(allNodes),
    });
    const pass2 = await callPassWithRetry(prompt, sys2, tool2, controller.signal,
      (raw) => ConceptResultSchema.parse(raw));
    // parentId 참조 무결성: 존재하지 않는 부모 → 첫 번째 테마에 연결
    const fallbackParent = allNodes[0]?.id ?? '';
    const fixed2 = pass2.nodes.map((n: { parentId: string; [k: string]: unknown }) =>
      nodeIds.has(n.parentId) ? n : { ...n, parentId: fallbackParent },
    );
    const trimmed2 = trimTobudget(fixed2, budget.pass2);
    for (const n of trimmed2) {
      allNodes.push({ ...n, abstractionLevel: 'basic' });
      nodeIds.add(n.id);
      allEdges.push({ sourceId: n.parentId, targetId: n.id, relation: 'parent-child', strength: 0.8 });
    }
    onProgress?.(2, totalPasses, allNodes.length);

    if (config.maxDepth < 3) {
      return { nodes: allNodes, edges: allEdges };
    }

    // Pass 3: 세부 분해 (실패해��� 이미 추출된 노드로 진행)
    if (budget.pass3 > 0) {
      try {
        onProgress?.(3, totalPasses, allNodes.length);
        const tool3 = buildHierarchicalTool(3, config);
        const sys3 = getHierarchicalPrompt(3, lang, {
          budget: budget.pass3,
          branchingFactor: branching,
          existingTree: serializeTree(allNodes),
        });
        const pass3 = await callPassWithRetry(prompt, sys3, tool3, controller.signal,
          (raw) => DetailResultSchema.parse(raw));
        const fixed3 = pass3.nodes.map((n: { parentId: string; [k: string]: unknown }) =>
          nodeIds.has(n.parentId) ? n : { ...n, parentId: allNodes[allNodes.length - 1]?.id ?? '' },
        );
        const trimmed3 = trimTobudget(fixed3, budget.pass3);
        for (const n of trimmed3) {
          allNodes.push({ ...n, abstractionLevel: n.abstractionLevel ?? 'subordinate' });
          nodeIds.add(n.id);
          allEdges.push({ sourceId: n.parentId, targetId: n.id, relation: 'parent-child', strength: 0.7 });
        }
        onProgress?.(3, totalPasses, allNodes.length);
      } catch {
        console.warn('Pass 3 (detail) 실패, 기존 노드로 계속 진행');
      }
    }

    // Pass 4: 횡단 연결
    try {
      onProgress?.(4, totalPasses, allNodes.length);
      const tool4 = buildHierarchicalTool(4, config);
      const sys4 = getHierarchicalPrompt(4, lang, {
        budget: 0,
        branchingFactor: branching,
        existingTree: serializeTree(allNodes),
      });
      const pass4 = await callPassWithRetry(prompt, sys4, tool4, controller.signal,
        (raw) => CrossLinkResultSchema.parse(raw));
      for (const e of pass4.edges) {
        if (nodeIds.has(e.sourceId) && nodeIds.has(e.targetId)) {
          allEdges.push(e);
        }
      }
    } catch {
      // Pass 4 실패는 허용 — 횡단 연결은 선택적
      console.warn('Pass 4 (cross-link) 실패, 노드는 정상 추출됨');
    }
    onProgress?.(totalPasses, totalPasses, allNodes.length);

    return { nodes: allNodes, edges: allEdges };
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new Error('요청이 취소되었거나 시간이 초과되었습니다.');
    }
    // Pass 1-3 실패 → 에러를 사용자에게 표시
    throw new Error(`추출 실패 (${allNodes.length}개 노드 생성 후): ${(error as Error).message}`);
  } finally {
    clearTimeout(timeoutId);
    if (extractController === controller) extractController = null;
  }
}

// ── 3-Phase 추출 ──

/** Phase 1: 트리 구조 스캐폴딩 — 정확히 N개 노드, D 깊이 */
export async function scaffoldNodes(
  prompt: string,
  config: ExtractionConfig,
  signal: AbortSignal,
): Promise<ScaffoldNode[]> {
  const lang = detectLanguage(prompt);
  const levelBudget = allocateLevelBudget(config.maxNodes, config.maxDepth);
  const sysPrompt = getScaffoldPrompt(lang, config.maxNodes, config.maxDepth, levelBudget);

  const raw = await callPassWithRetry(prompt, sysPrompt, SCAFFOLD_TOOL, signal,
    (data) => {
      const parsed = ScaffoldResultSchema.parse(data);
      if (parsed.nodes.length === 0) throw new Error('스캐폴드 노드가 비어 있습니다');
      return parsed;
    });

  // 참조 무결성: 존재하지 않는 parentId → null
  const nodeIds = new Set(raw.nodes.map((n: ScaffoldNode) => n.id));
  let nodes = raw.nodes.map((n: ScaffoldNode) =>
    n.parentId && !nodeIds.has(n.parentId) ? { ...n, parentId: null } : n,
  );

  // 노드 수 보정: API가 N과 다른 수를 반환하면 트리밍 또는 패딩
  const target = config.maxNodes;
  if (nodes.length > target) {
    // 깊은 노드부터 제거 (리프 우선)
    const depthOf = (n: ScaffoldNode): number => {
      if (!n.parentId) return 0;
      const parent = nodes.find((p) => p.id === n.parentId);
      return parent ? depthOf(parent) + 1 : 0;
    };
    nodes = [...nodes].sort((a, b) => depthOf(b) - depthOf(a)).slice(0, target);
    // 제거된 부모 참조 수정
    const kept = new Set(nodes.map((n) => n.id));
    nodes = nodes.map((n) =>
      n.parentId && !kept.has(n.parentId) ? { ...n, parentId: null } : n,
    );
  }

  return nodes;
}

/** Phase 2: 내용 채우기 — 배치 호출 + 미채워진 노드 재귀 재시도 */
export async function fillNodes(
  prompt: string,
  skeleton: ScaffoldNode[],
  signal: AbortSignal,
): Promise<FillNode[]> {
  const lang = detectLanguage(prompt);
  const skeletonIds = new Set(skeleton.map((s) => s.id));

  const allFilled: FillNode[] = [];
  const filledIds = new Set<string>();

  /** 주어진 노드 목록을 배치 분할하여 Fill 호출 */
  async function fillBatch(targets: ScaffoldNode[], batchCount: number) {
    const batches: ScaffoldNode[][] = Array.from({ length: batchCount }, () => []);
    targets.forEach((s, i) => batches[i % batchCount]!.push(s));

    for (let b = 0; b < batchCount; b++) {
      if (signal.aborted) break;
      const batch = batches[b]!;
      if (batch.length === 0) continue;

      const sysPrompt = getFillPrompt(lang, batch);

      try {
        const raw = await callPassWithRetry(prompt, sysPrompt, FILL_TOOL, signal,
          (data) => FillResultSchema.parse(data));

        for (const n of raw.nodes) {
          if (skeletonIds.has(n.id) && !filledIds.has(n.id)) {
            allFilled.push(n);
            filledIds.add(n.id);
          }
        }
      } catch (error) {
        console.warn(`Fill 배치 실패:`, error);
      }
    }
  }

  // ── 1차 시도: 3 배치 ──
  await fillBatch(skeleton, 3);

  // ── 재시도: 미채워진 노드가 있으면 최대 2회 추가 시도 ──
  const MAX_RETRIES = 2;
  for (let retry = 0; retry < MAX_RETRIES; retry++) {
    if (signal.aborted) break;
    const unfilled = skeleton.filter((s) => !filledIds.has(s.id));
    if (unfilled.length === 0) break;

    console.warn(`Fill 재시도 ${retry + 1}/${MAX_RETRIES}: 미채워진 노드 ${unfilled.length}개`);
    // 재시도는 단일 배치 (노드 수가 적으므로)
    await fillBatch(unfilled, 1);
  }

  // ── 최종 폴백: 그래도 남은 노드는 부모/형제 컨텍스트로 라벨 생성 ──
  for (const s of skeleton) {
    if (!filledIds.has(s.id)) {
      // 부모 노드의 라벨을 참고하여 의미 있는 폴백 생성
      const parent = s.parentId ? allFilled.find((f) => f.id === s.parentId) : null;
      const parentLabel = parent?.label ?? '';
      const depthLabel = s.abstractionLevel === 'superordinate' ? '핵심 주제'
        : s.abstractionLevel === 'basic' ? '세부 개념'
        : s.abstractionLevel === 'subordinate' ? '구체적 요소'
        : '사례';
      allFilled.push({
        id: s.id,
        label: parentLabel ? `${parentLabel} — ${depthLabel}` : depthLabel,
        type: 'concept',
        weight: s.abstractionLevel === 'superordinate' ? 0.75
          : s.abstractionLevel === 'basic' ? 0.50
          : 0.30,
        description: parentLabel
          ? `${parentLabel}의 하위 ${depthLabel} (자동 생성)`
          : `${depthLabel} (자동 생성)`,
      });
    }
  }

  return allFilled;
}

/** Phase 3: 검증 및 패치 — weight 분포 조정 + 횡단 연결 */
export async function validateGraph(
  prompt: string,
  fullNodes: readonly { id: string; label: string; type: string; weight: number; parentId: string | null; abstractionLevel: string }[],
  signal: AbortSignal,
): Promise<{ patches: PatchNode[]; edges: { sourceId: string; targetId: string; relation: string; strength: number }[] }> {
  const lang = detectLanguage(prompt);
  const sysPrompt = getValidatePrompt(lang, fullNodes);

  const raw = await callPassWithRetry(prompt, sysPrompt, VALIDATE_TOOL, signal,
    (data) => ValidateResultSchema.parse(data));

  // 노드 참조 무결성
  const nodeIds = new Set(fullNodes.map((n) => n.id));
  return {
    patches: raw.patches.filter((p: PatchNode) => nodeIds.has(p.id)),
    edges: raw.edges.filter((e: { sourceId: string; targetId: string }) =>
      nodeIds.has(e.sourceId) && nodeIds.has(e.targetId)),
  };
}
