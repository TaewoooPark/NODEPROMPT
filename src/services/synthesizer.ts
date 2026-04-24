import type { NodeData, EdgeData, SynthesisSegment } from '../types';
import { flattenSegments } from '../types';

const RELATION_LABELS: Record<string, (s: string, t: string) => string> = {
  causal:       (s, t) => `"${s}" causes/leads to "${t}"`,
  contrast:     (s, t) => `"${s}" contrasts with "${t}"`,
  amplify:      (s, t) => `"${s}" amplifies "${t}"`,
  suppress:     (s, t) => `"${s}" suppresses "${t}"`,
  parallel:     (s, t) => `"${s}" is parallel to "${t}"`,
  dependency:   (s, t) => `"${s}" depends on "${t}"`,
  'parent-child': (s, t) => `"${s}" contains "${t}"`,
  'cross-link': (s, t) => `"${s}" relates to "${t}" (cross-branch)`,
  custom:       (s, t) => `"${s}" relates to "${t}"`,
};

const SEP_NL: SynthesisSegment = {
  text: '\n',
  kind: 'text',
  provenance: { nodeIds: [], edgeIds: [] },
};

const SEP_BLANK: SynthesisSegment = {
  text: '\n\n',
  kind: 'text',
  provenance: { nodeIds: [], edgeIds: [] },
};

function heading(text: string): SynthesisSegment {
  return { text, kind: 'heading', provenance: { nodeIds: [], edgeIds: [] } };
}

function instruction(text: string): SynthesisSegment {
  return { text, kind: 'instruction', provenance: { nodeIds: [], edgeIds: [] } };
}

function originalSeg(text: string): SynthesisSegment {
  return { text, kind: 'original', provenance: { nodeIds: [], edgeIds: [] } };
}

export function synthesizePromptSegments(
  originalPrompt: string,
  nodes: NodeData[],
  edges: EdgeData[],
): SynthesisSegment[] {
  const active = nodes.filter((n) => !n.isDeleted);
  const deleted = nodes.filter((n) => n.isDeleted);
  const activeIds = new Set(active.map((n) => n.id));

  const hasHierarchy = active.some((n) => n.depth > 0);

  const out: SynthesisSegment[] = [];

  out.push(heading('## Original prompt'));
  out.push(SEP_NL);
  out.push(originalSeg(originalPrompt));
  out.push(SEP_BLANK);

  out.push(heading(hasHierarchy ? '## Concept Hierarchy (user-curated)' : '## Priority concepts (user-weighted)'));
  out.push(SEP_NL);

  if (hasHierarchy) {
    pushTreeSegments(out, active);
  } else {
    const sorted = [...active].sort((a, b) => b.weight - a.weight);
    sorted.forEach((n, i) => {
      out.push({
        text: `[${n.type.toUpperCase()} / w:${n.weight.toFixed(2)}] "${n.label}": ${n.description}`,
        kind: 'hierarchy-node',
        provenance: { nodeIds: [n.id], edgeIds: [], weight: n.weight },
      });
      if (i < sorted.length - 1) out.push(SEP_NL);
    });
  }

  const crossEdgeSegs: SynthesisSegment[] = [];
  for (const e of edges) {
    if (e.isDeleted) continue;
    if (e.relation === 'parent-child') continue;
    if (!activeIds.has(e.sourceId) || !activeIds.has(e.targetId)) continue;
    const source = active.find((n) => n.id === e.sourceId);
    const target = active.find((n) => n.id === e.targetId);
    if (!source || !target) continue;
    const labelFn = RELATION_LABELS[e.relation] ?? RELATION_LABELS['custom']!;
    crossEdgeSegs.push({
      text: `  → ${labelFn(source.label, target.label)} (strength: ${e.strength.toFixed(2)})`,
      kind: 'cross-edge',
      provenance: { nodeIds: [source.id, target.id], edgeIds: [e.id], weight: e.strength },
    });
  }

  if (crossEdgeSegs.length > 0) {
    out.push(SEP_BLANK);
    out.push(heading('## Cross-Branch Relationships'));
    out.push(SEP_NL);
    crossEdgeSegs.forEach((s, i) => {
      out.push(s);
      if (i < crossEdgeSegs.length - 1) out.push(SEP_NL);
    });
  }

  if (deleted.length > 0) {
    out.push(SEP_BLANK);
    out.push(heading('## Excluded perspectives'));
    out.push(SEP_NL);
    deleted.forEach((n, i) => {
      out.push({
        text: n.label,
        kind: 'excluded',
        provenance: { nodeIds: [n.id], edgeIds: [], deletedMark: true },
      });
      if (i < deleted.length - 1) {
        out.push({
          text: ', ',
          kind: 'text',
          provenance: { nodeIds: [], edgeIds: [] },
        });
      }
    });
  }

  out.push(SEP_BLANK);
  out.push(heading('## Instructions'));
  out.push(SEP_NL);
  out.push(
    instruction(
      hasHierarchy
        ? 'Answer the original prompt using the concept hierarchy above as a structural scaffold.\nThemes → major sections. Basic concepts → detailed discussion. Details → evidence and examples.\nCross-branch relationships → transitions between sections.'
        : 'Answer the original prompt. Let the weighted concept graph above steer your emphasis.\nConcepts with higher weight should be more central to your answer.',
    ),
  );

  return out;
}

/**
 * 편집된 그래프 → 구조화된 합성 프롬프트 (문자열).
 * 세그먼트 생성기 위에 얇은 flatten 래퍼 — 기존 호출자와 호환 유지.
 */
export function synthesizePrompt(
  originalPrompt: string,
  nodes: NodeData[],
  edges: EdgeData[],
): string {
  return flattenSegments(synthesizePromptSegments(originalPrompt, nodes, edges));
}

function pushTreeSegments(out: SynthesisSegment[], nodes: NodeData[]): void {
  const byParent = new Map<string | null, NodeData[]>();
  for (const n of nodes) {
    const list = byParent.get(n.parentId) ?? [];
    list.push(n);
    byParent.set(n.parentId, list);
  }

  const collected: SynthesisSegment[] = [];

  function walk(parentId: string | null, indent: number): void {
    const children = (byParent.get(parentId) ?? []).sort((a, b) => b.weight - a.weight);
    for (const n of children) {
      const prefix = indent === 0 ? '### ' : '  '.repeat(indent) + '├─ ';
      const facetStr = n.facets ? ` [${n.facets.epistemological}, ${n.facets.rhetorical}]` : '';
      const head = `${prefix}${n.label} [${n.type}] (w:${n.weight.toFixed(2)}, ${n.abstractionLevel})${facetStr}`;

      collected.push({
        text: head,
        kind: 'hierarchy-node',
        provenance: { nodeIds: [n.id], edgeIds: [], weight: n.weight },
      });

      if (indent === 0 && n.description) {
        collected.push(SEP_NL);
        collected.push({
          text: `${'  '.repeat(indent + 1)}${n.description}`,
          kind: 'hierarchy-node',
          provenance: { nodeIds: [n.id], edgeIds: [], weight: n.weight },
        });
      }

      collected.push(SEP_NL);
      walk(n.id, indent + 1);
    }
  }

  walk(null, 0);

  // 마지막 trailing newline 제거 (섹션 경계는 호출자가 SEP_BLANK 으로 관리)
  while (collected.length > 0 && collected[collected.length - 1] === SEP_NL) {
    collected.pop();
  }

  out.push(...collected);
}
