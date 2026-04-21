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
import type { ToolDef, Attachment } from './llm/types';
import {
  getProvider,
  getProviderKey,
  setProviderKey,
  getActiveProviderId,
  assertAttachmentsSupported,
} from './llm/registry';

// ── 활성 프로바이더 추상화 ──
//
// 모든 호출은 registry에서 꺼낸 LLMProvider를 경유한다. orchestration(4-pass, 재시도,
// 트리밍, 참조 무결성)는 아래 함수들 그대로 유지.

// ── 키/연결 (호환 API) ──
// 기존 호출부가 setApiKey/getSavedApiKey/checkClaudeConnection를 쓰므로 이름 유지.
// 내부적으로는 현재 활성 프로바이더에 위임.

export function setApiKey(key: string): void {
  setProviderKey(getActiveProviderId(), key);
}

export function getSavedApiKey(): string {
  return getProviderKey(getActiveProviderId());
}

export async function checkClaudeConnection(): Promise<boolean> {
  return getProvider().checkConnection();
}

// ── 요청 취소 컨트롤러 ──

let extractController: AbortController | null = null;
let streamController: AbortController | null = null;

export function createExtractController(timeoutMs = 300_000): AbortController {
  extractController?.abort();
  const controller = new AbortController();
  extractController = controller;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  controller.signal.addEventListener('abort', () => clearTimeout(timeoutId), { once: true });
  return controller;
}

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
  const key = getSavedApiKey();
  if (!key) throw new Error('API 키가 설정되지 않았습니다.');

  return getProvider().callSimple({
    role: 'fast',
    system: 'You are a concise concept describer. Write a 1-2 sentence description of the given concept node. Respond ONLY with the description text, nothing else. Match the language of the original prompt.',
    user: `Original prompt: "${originalPrompt}"\n\nNode label: "${label}"\nNode type: ${type}\n\nWrite a brief description:`,
    temperature: 0.3,
    maxTokens: 150,
  });
}

// ── 단일 패스 추출 (호환 API) ──

async function callExtractOnce(
  prompt: string,
  systemPrompt: string,
  temperature: number,
  signal: AbortSignal,
): Promise<ExtractionResult> {
  const raw = await getProvider().callStructured({
    role: 'fast',
    system: systemPrompt,
    user: prompt,
    tool: EXTRACTION_TOOL,
    temperature,
    maxTokens: 4096,
    signal,
  });

  const validated = ExtractionResultSchema.parse(raw);
  const nodeIds = new Set(validated.nodes.map((n) => n.id));
  validated.edges = validated.edges.filter(
    (e) => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId),
  );
  return validated;
}

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
        return await callExtractOnce(prompt, systemPrompt, temp, controller.signal);
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

// ── 스트리밍 응답 생성 ──

export async function* streamResponse(
  synthesizedPrompt: string,
  lang: 'ko' | 'en' = 'ko',
): AsyncGenerator<string> {
  const controller = new AbortController();
  streamController = controller;

  try {
    const iterator = getProvider().stream({
      role: 'flagship',
      system: getGenerationPrompt(lang),
      user: synthesizedPrompt,
      temperature: 0.7,
      maxTokens: 8192,
      signal: controller.signal,
    });
    for await (const chunk of iterator) {
      yield chunk;
    }
  } finally {
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

async function callPass(
  prompt: string,
  systemPrompt: string,
  tool: ToolDef,
  signal: AbortSignal,
  temperature = 0.2,
  attachments?: readonly Attachment[],
): Promise<unknown> {
  return getProvider().callStructured({
    role: 'fast',
    system: systemPrompt,
    user: prompt,
    tool,
    temperature,
    maxTokens: 8192,
    signal,
    attachments: attachments ? [...attachments] : undefined,
  });
}

async function callPassWithRetry(
  prompt: string,
  systemPrompt: string,
  tool: ToolDef,
  signal: AbortSignal,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  validate: (raw: unknown) => any,
  attachments?: readonly Attachment[],
) {
  const temps = [0.2, 0.4, 0.6];
  for (let i = 0; i < temps.length; i++) {
    try {
      const raw = await callPass(prompt, systemPrompt, tool, signal, temps[i], attachments);
      return validate(raw);
    } catch (error) {
      console.warn(`Pass ${tool.name} 시도 ${i + 1}/${temps.length} 실패:`, error);
      if (i === temps.length - 1) throw error;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error('unreachable');
}

export async function extractHierarchical(
  prompt: string,
  config: ExtractionConfig,
  onProgress?: (pass: number, total: number, nodesSoFar: number) => void,
): Promise<HierarchicalResult> {
  const lang = detectLanguage(prompt);
  const budget = allocateBudget(config.maxNodes, config.maxDepth);
  const branching = computeBranchingFactor(config.maxNodes, config.maxDepth);
  const totalPasses = config.maxDepth === 1 ? 1 : config.maxDepth === 2 ? 2 : 4;

  function trimTobudget<T extends { weight: number }>(items: T[], max: number): T[] {
    if (items.length <= max) return items;
    return [...items].sort((a, b) => b.weight - a.weight).slice(0, max);
  }

  const controller = new AbortController();
  extractController = controller;
  const timeoutId = setTimeout(() => controller.abort(), 300_000);

  const allNodes: HierarchicalNode[] = [];
  const allEdges: { sourceId: string; targetId: string; relation: string; strength: number }[] = [];

  try {
    const nodeIds = new Set<string>();

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

    onProgress?.(2, totalPasses, allNodes.length);
    const tool2 = buildHierarchicalTool(2, config);
    const sys2 = getHierarchicalPrompt(2, lang, {
      budget: budget.pass2,
      branchingFactor: branching,
      existingTree: serializeTree(allNodes),
    });
    const pass2 = await callPassWithRetry(prompt, sys2, tool2, controller.signal,
      (raw) => ConceptResultSchema.parse(raw));
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
      console.warn('Pass 4 (cross-link) 실패, 노드는 정상 추출됨');
    }
    onProgress?.(totalPasses, totalPasses, allNodes.length);

    return { nodes: allNodes, edges: allEdges };
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new Error('요청이 취소되었거나 시간이 초과되었습니다.');
    }
    throw new Error(`추출 실패 (${allNodes.length}개 노드 생성 후): ${(error as Error).message}`);
  } finally {
    clearTimeout(timeoutId);
    if (extractController === controller) extractController = null;
  }
}

// ── 3-Phase 추출 ──

export async function scaffoldNodes(
  prompt: string,
  config: ExtractionConfig,
  signal: AbortSignal,
  attachments?: readonly Attachment[],
): Promise<ScaffoldNode[]> {
  assertAttachmentsSupported(getActiveProviderId(), attachments);
  const lang = detectLanguage(prompt);
  const levelBudget = allocateLevelBudget(config.maxNodes, config.maxDepth);
  const sysPrompt = getScaffoldPrompt(lang, config.maxNodes, config.maxDepth, levelBudget);

  const raw = await callPassWithRetry(prompt, sysPrompt, SCAFFOLD_TOOL, signal,
    (data) => {
      const parsed = ScaffoldResultSchema.parse(data);
      if (parsed.nodes.length === 0) throw new Error('스캐폴드 노드가 비어 있습니다');
      return parsed;
    }, attachments);

  const nodeIds = new Set(raw.nodes.map((n: ScaffoldNode) => n.id));
  let nodes = raw.nodes.map((n: ScaffoldNode) =>
    n.parentId && !nodeIds.has(n.parentId) ? { ...n, parentId: null } : n,
  );

  const target = config.maxNodes;
  if (nodes.length > target) {
    const depthOf = (n: ScaffoldNode): number => {
      if (!n.parentId) return 0;
      const parent = nodes.find((p) => p.id === n.parentId);
      return parent ? depthOf(parent) + 1 : 0;
    };
    nodes = [...nodes].sort((a, b) => depthOf(b) - depthOf(a)).slice(0, target);
    const kept = new Set(nodes.map((n) => n.id));
    nodes = nodes.map((n) =>
      n.parentId && !kept.has(n.parentId) ? { ...n, parentId: null } : n,
    );
  }

  return nodes;
}

export async function fillNodes(
  prompt: string,
  skeleton: ScaffoldNode[],
  signal: AbortSignal,
  attachments?: readonly Attachment[],
): Promise<FillNode[]> {
  assertAttachmentsSupported(getActiveProviderId(), attachments);
  const lang = detectLanguage(prompt);
  const skeletonIds = new Set(skeleton.map((s) => s.id));

  const allFilled: FillNode[] = [];
  const filledIds = new Set<string>();

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
          (data) => FillResultSchema.parse(data), attachments);

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

  await fillBatch(skeleton, 3);

  const MAX_RETRIES = 2;
  for (let retry = 0; retry < MAX_RETRIES; retry++) {
    if (signal.aborted) break;
    const unfilled = skeleton.filter((s) => !filledIds.has(s.id));
    if (unfilled.length === 0) break;

    console.warn(`Fill 재시도 ${retry + 1}/${MAX_RETRIES}: 미채워진 노드 ${unfilled.length}개`);
    await fillBatch(unfilled, 1);
  }

  for (const s of skeleton) {
    if (!filledIds.has(s.id)) {
      const parent = s.parentId ? allFilled.find((f) => f.id === s.parentId) : null;
      const parentLabel = parent?.label ?? '';
      const depthLabel = s.abstractionLevel === 'superordinate' ? '핵심 주제'
        : s.abstractionLevel === 'basic' ? '세부 개념'
        : s.abstractionLevel === 'subordinate' ? '구체적 요소'
        : '사례';
      allFilled.push({
        id: s.id,
        label: parentLabel ? `${parentLabel} — ${depthLabel}` : depthLabel,
        type: 'ens',
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

export async function validateGraph(
  prompt: string,
  fullNodes: readonly { id: string; label: string; type: string; weight: number; parentId: string | null; abstractionLevel: string }[],
  signal: AbortSignal,
  attachments?: readonly Attachment[],
): Promise<{ patches: PatchNode[]; edges: { sourceId: string; targetId: string; relation: string; strength: number }[] }> {
  assertAttachmentsSupported(getActiveProviderId(), attachments);
  const lang = detectLanguage(prompt);
  const sysPrompt = getValidatePrompt(lang, fullNodes);

  const raw = await callPassWithRetry(prompt, sysPrompt, VALIDATE_TOOL, signal,
    (data) => ValidateResultSchema.parse(data), attachments);

  const nodeIds = new Set(fullNodes.map((n) => n.id));
  return {
    patches: raw.patches.filter((p: PatchNode) => nodeIds.has(p.id)),
    edges: raw.edges.filter((e: { sourceId: string; targetId: string }) =>
      nodeIds.has(e.sourceId) && nodeIds.has(e.targetId)),
  };
}
