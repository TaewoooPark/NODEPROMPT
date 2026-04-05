import { hierarchy, type HierarchyNode } from 'd3-hierarchy';
import type { NodeData } from '../types';

interface TreeInput {
  id: string;
  label: string;
  children?: TreeInput[];
}

/**
 * 실제 parentId 트리에서 D3 계층 구조 구축 (계층적 추출 결과용).
 * 가상 __root__ 아래에 모든 최상위 노드를 균등 배치 → 원형 분포.
 */
export function buildHierarchyFromTree(nodes: NodeData[]): TreeInput {
  const active = nodes.filter((n) => !n.isDeleted);
  if (active.length === 0) return { id: '__root__', label: 'Root', children: [] };

  const childMap = new Map<string, NodeData[]>();
  for (const n of active) {
    if (n.parentId) {
      const list = childMap.get(n.parentId) ?? [];
      list.push(n);
      childMap.set(n.parentId, list);
    }
  }

  function buildSubtree(node: NodeData): TreeInput {
    const children = (childMap.get(node.id) ?? [])
      .sort((a, b) => b.weight - a.weight)
      .map(buildSubtree);
    return { id: node.id, label: node.label, children: children.length > 0 ? children : undefined };
  }

  // 모든 최상위 노드 (parentId가 없거나 depth=0)
  const topLevel = active.filter((n) => !n.parentId || n.depth === 0);

  // 최상위 노드에서 도달 가능한 모든 노드 추적
  const assignedIds = new Set<string>();
  const collectAssigned = (parentId: string) => {
    assignedIds.add(parentId);
    for (const child of childMap.get(parentId) ?? []) {
      collectAssigned(child.id);
    }
  };
  for (const t of topLevel) collectAssigned(t.id);

  // 고아 노드도 최상위로 승격
  const orphans = active.filter((n) => !assignedIds.has(n.id));

  // 가상 루트 아래에 모든 최상위+고아 배치 → 균형잡힌 원형 분포
  const topChildren = [
    ...topLevel.sort((a, b) => b.weight - a.weight).map(buildSubtree),
    ...orphans.map((n) => buildSubtree(n)),
  ];

  return { id: '__root__', label: 'Root', children: topChildren };
}

/**
 * NodeData[] → D3 계층 트리 구조 변환 (기존 타입 그룹핑 방식).
 * 루트: weight가 가장 높은 concept 노드.
 * 나머지: parentId 기반 트리 구성, 없으면 type별 그룹핑.
 */
export function buildHierarchy(nodes: NodeData[]): TreeInput {
  const active = nodes.filter((n) => !n.isDeleted);

  // 루트 선정: weight 최대 concept 노드
  const root = active
    .filter((n) => n.type === 'concept')
    .sort((a, b) => b.weight - a.weight)[0];

  if (!root) {
    return { id: '__root__', label: 'Root', children: [] };
  }

  // parentId 기반으로 자식 관계가 있는 노드들
  const childMap = new Map<string, TreeInput[]>();
  const assigned = new Set<string>([root.id]);

  for (const n of active) {
    if (n.id === root.id) continue;
    if (n.parentId && n.parentId !== root.id) {
      const siblings = childMap.get(n.parentId) ?? [];
      siblings.push({ id: n.id, label: n.label });
      childMap.set(n.parentId, siblings);
      assigned.add(n.id);
    }
  }

  // 남은 노드 → type별 그룹핑
  const typeGroups = new Map<string, TreeInput[]>();
  for (const n of active) {
    if (assigned.has(n.id)) continue;
    const group = typeGroups.get(n.type) ?? [];
    group.push({ id: n.id, label: n.label, children: childMap.get(n.id) });
    typeGroups.set(n.type, group);
  }

  const children: TreeInput[] = [];

  // root의 직계 자식
  const rootDirectChildren = childMap.get(root.id);
  if (rootDirectChildren) children.push(...rootDirectChildren);

  // type 그룹 노드
  for (const [type, group] of typeGroups) {
    children.push({
      id: `__group-${type}__`,
      label: type,
      children: group,
    });
  }

  return { id: root.id, label: root.label, children };
}

/**
 * 동심원 링 기반 방사형 레이아웃.
 * 계층 깊이별로 최대 5개 링에 배치. 자식은 부모의 각도 근처에 군집.
 *
 * @returns layout — nodeId → { angle, depth(=반경) } 매핑
 */
export function computeRadialLayout(
  hier: TreeInput,
  _maxRadius: number = 4,
): { layout: Map<string, { angle: number; depth: number }>; root: HierarchyNode<TreeInput>; treeEdges: { from: string; to: string }[]; effectiveRadius: number } {
  const root = hierarchy(hier);

  // 가상 노드를 건너뛴 실제 부모를 찾는 헬퍼
  function realParent(node: HierarchyNode<TreeInput>): HierarchyNode<TreeInput> | null {
    let p: HierarchyNode<TreeInput> | null = node.parent;
    while (p && p.data.id.startsWith('__')) p = p.parent;
    return p;
  }

  // 실제 노드의 유효 깊이 (가상 조상 제외)
  function effectiveDepth(node: HierarchyNode<TreeInput>): number {
    let d = 0;
    let cur = node.parent;
    while (cur) {
      if (!cur.data.id.startsWith('__')) d++;
      cur = cur.parent;
    }
    return d;
  }

  // 실제 노드(비가상) 후손 수 — 섹터 크기 결정용
  function countReal(node: HierarchyNode<TreeInput>): number {
    const self = node.data.id.startsWith('__') ? 0 : 1;
    if (!node.children) return self;
    return self + node.children.reduce((s, c) => s + countReal(c), 0);
  }

  const realDescendants = root.descendants().filter((d) => !d.data.id.startsWith('__'));
  const realCount = realDescendants.length;
  const maxDepth = Math.max(...realDescendants.map(effectiveDepth), 0);
  const maxRing = Math.min(maxDepth, 4); // 최대 5개 링 (0-4)

  // 링 반경 — 카메라 FOV 60°에서 화면 안에 들어오도록
  const effectiveRadius = 3 + Math.sqrt(realCount) * 0.5;
  const ringRadii: number[] = [];
  for (let d = 0; d <= maxRing; d++) {
    ringRadii.push(effectiveRadius * (d + 1) / (maxRing + 1));
  }

  // 링별 최대 수용 노드 수 — 안쪽 링일수록 둘레가 짧으므로 적게
  // 노드 크기(~0.3) + 라벨 여백 고려, 최소 간격 0.8
  const MIN_GAP = 0.8;
  const ringCapacity: number[] = ringRadii.map((r) => Math.max(2, Math.floor(2 * Math.PI * r / MIN_GAP)));
  const ringCount: number[] = new Array(maxRing + 1).fill(0);

  const layout = new Map<string, { angle: number; depth: number }>();

  // 1차: 섹터 배분으로 링과 각도 결정 (초과 시 외부 링으로 밀어냄)
  function assignSector(
    node: HierarchyNode<TreeInput>,
    sectorStart: number,
    sectorEnd: number,
  ) {
    const isVirtual = node.data.id.startsWith('__');

    if (!isVirtual) {
      const depth = effectiveDepth(node);
      let ring = Math.min(depth, maxRing);

      // 링 용량 초과 시 다음 링으로 밀어냄
      while (ring < maxRing && ringCount[ring]! >= ringCapacity[ring]!) {
        ring++;
      }
      ringCount[ring]!++;

      const midAngle = (sectorStart + sectorEnd) / 2;
      layout.set(node.data.id, { angle: midAngle, depth: ringRadii[ring]! });
    }

    const children = node.children;
    if (!children || children.length === 0) return;

    // 자식들에게 섹터를 서브트리 크기에 비례해 배분
    const weights = children.map((c) => Math.max(countReal(c), 1));
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    let currentAngle = sectorStart;
    for (let i = 0; i < children.length; i++) {
      const share = (sectorEnd - sectorStart) * weights[i]! / totalWeight;
      assignSector(children[i]!, currentAngle, currentAngle + share);
      currentAngle += share;
    }
  }

  assignSector(root, 0, 2 * Math.PI);

  // 트리 엣지 (가상 노드 건너뜀)
  const treeEdges: { from: string; to: string }[] = [];
  for (const d of root.descendants()) {
    if (d.data.id.startsWith('__') || !d.parent) continue;
    const rp = realParent(d);
    if (rp) treeEdges.push({ from: rp.data.id, to: d.data.id });
  }

  return { layout, root, treeEdges, effectiveRadius };
}
