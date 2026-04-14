import type { NodeData, EdgeData } from '../types';

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

/**
 * 편집된 그래프 → 구조화된 합성 프롬프트.
 * 계층적 트리 구조를 보존하여 응답의 구조를 유도.
 */
export function synthesizePrompt(
  originalPrompt: string,
  nodes: NodeData[],
  edges: EdgeData[],
): string {
  const active = nodes.filter((n) => !n.isDeleted);
  const deleted = nodes.filter((n) => n.isDeleted);
  const activeIds = new Set(active.map((n) => n.id));

  // 계층 트리 렌더링
  const hasHierarchy = active.some((n) => n.depth > 0);

  let conceptSection: string;
  if (hasHierarchy) {
    conceptSection = renderTree(active);
  } else {
    conceptSection = active
      .sort((a, b) => b.weight - a.weight)
      .map((n) => `[${n.type.toUpperCase()} / w:${n.weight.toFixed(2)}] "${n.label}": ${n.description}`)
      .join('\n');
  }

  // 횡단 관계 (parent-child 제외)
  const crossEdges = edges
    .filter((e) => !e.isDeleted && e.relation !== 'parent-child' && activeIds.has(e.sourceId) && activeIds.has(e.targetId))
    .map((e) => {
      const source = active.find((n) => n.id === e.sourceId);
      const target = active.find((n) => n.id === e.targetId);
      if (!source || !target) return '';
      const labelFn = RELATION_LABELS[e.relation] ?? RELATION_LABELS['custom']!;
      return `  → ${labelFn(source.label, target.label)} (strength: ${e.strength.toFixed(2)})`;
    })
    .filter(Boolean)
    .join('\n');

  const excluded = deleted.map((n) => n.label);

  const parts: string[] = [
    `## Original prompt`,
    originalPrompt,
    ``,
    hasHierarchy ? `## Concept Hierarchy (user-curated)` : `## Priority concepts (user-weighted)`,
    conceptSection,
  ];

  if (crossEdges) {
    parts.push(``, `## Cross-Branch Relationships`, crossEdges);
  }

  if (excluded.length > 0) {
    parts.push(``, `## Excluded perspectives`, excluded.join(', '));
  }

  parts.push(
    ``,
    `## Instructions`,
    hasHierarchy
      ? `Answer the original prompt using the concept hierarchy above as a structural scaffold.\nThemes → major sections. Basic concepts → detailed discussion. Details → evidence and examples.\nCross-branch relationships → transitions between sections.`
      : `Answer the original prompt. Let the weighted concept graph above steer your emphasis.\nConcepts with higher weight should be more central to your answer.`,
  );

  return parts.join('\n');
}

function renderTree(nodes: NodeData[]): string {
  const byParent = new Map<string | null, NodeData[]>();
  for (const n of nodes) {
    const list = byParent.get(n.parentId) ?? [];
    list.push(n);
    byParent.set(n.parentId, list);
  }

  function render(parentId: string | null, indent: number): string {
    const children = (byParent.get(parentId) ?? []).sort((a, b) => b.weight - a.weight);
    return children.map((n) => {
      const prefix = indent === 0 ? '### ' : '  '.repeat(indent) + '├─ ';
      const facetStr = n.facets ? ` [${n.facets.epistemological}, ${n.facets.rhetorical}]` : '';
      const line = `${prefix}${n.label} [${n.type}] (w:${n.weight.toFixed(2)}, ${n.abstractionLevel})${facetStr}`;
      const desc = indent > 0 ? '' : `\n${'  '.repeat(indent + 1)}${n.description}`;
      const sub = render(n.id, indent + 1);
      return line + desc + (sub ? '\n' + sub : '');
    }).join('\n');
  }

  return render(null, 0);
}
