import type { NodeData, EdgeData } from '../types';
import { migrateNodeData } from '../types';
import type { ExtractionResult } from './schemas';
import { fibonacciSphere } from '../utils/fibonacciSphere';
import { cartesianToSpherical } from '../utils/coordinates';

/**
 * 기존 단일 패스 결과 → 구 표면 매핑 (하위 호환).
 */
export function mapNodesToSphere(
  result: ExtractionResult,
  sphereRadius: number,
): { nodes: NodeData[]; edges: EdgeData[] } {
  const n = result.nodes.length;
  const positions = fibonacciSphere(n, sphereRadius);

  const nodes: NodeData[] = result.nodes.map((raw, i) => {
    const pos = positions[i]!;
    const { theta, phi } = cartesianToSpherical(pos.x, pos.y, pos.z);

    return migrateNodeData({
      id: raw.id,
      label: raw.label,
      type: raw.type,
      weight: raw.weight,
      description: raw.description,
      sphereCoord: { theta, phi },
      radialCoord: { angle: phi, depth: theta },
      position: pos,
      parentId: raw.parentId ?? null,
      children: [],
      isUserCreated: false,
      isDeleted: false,
    });
  });

  const nodeIds = new Set(nodes.map((nd) => nd.id));
  const edges: EdgeData[] = result.edges
    .filter((e) => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId))
    .map((raw, i) => ({
      id: `edge-${i}-${raw.sourceId}-${raw.targetId}`,
      sourceId: raw.sourceId,
      targetId: raw.targetId,
      relation: raw.relation,
      strength: raw.strength,
      isUserCreated: false,
      isDeleted: false,
      isHierarchical: false,
      extractionPass: 1,
    }));

  return { nodes, edges };
}

/**
 * 계층적 추출 결과 → 동심쉘 구 배치.
 * depth=0: 중심, depth=1: 내부쉘, depth=2: 중간(Fibonacci), depth=3+: 외부쉘
 */
export function mapHierarchicalToSphere(
  rawNodes: { id: string; label: string; type: string; weight: number; description: string; parentId: string | null; abstractionLevel: string; facets?: { cognitive: string; epistemological: string; rhetorical: string } }[],
  rawEdges: { sourceId: string; targetId: string; relation: string; strength: number }[],
  sphereRadius: number,
  maxDepth: number,
): { nodes: NodeData[]; edges: EdgeData[] } {
  // parentId → children 맵 + BFS 깊이
  const childMap = new Map<string, string[]>();
  for (const n of rawNodes) {
    if (n.parentId) {
      const children = childMap.get(n.parentId) ?? [];
      children.push(n.id);
      childMap.set(n.parentId, children);
    }
  }
  const depthMap = new Map<string, number>();
  const roots = rawNodes.filter((n) => !n.parentId);
  for (const r of roots) depthMap.set(r.id, 0);
  const queue = [...roots.map((r) => r.id)];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const d = depthMap.get(id) ?? 0;
    for (const childId of childMap.get(id) ?? []) {
      depthMap.set(childId, d + 1);
      queue.push(childId);
    }
  }
  for (const n of rawNodes) {
    if (!depthMap.has(n.id)) depthMap.set(n.id, 1);
  }

  // Fibonacci lattice — 구 표면에 균일 초기 분포
  const allPositions = new Map<string, { x: number; y: number; z: number }>();
  const fiboPositions = fibonacciSphere(rawNodes.length, sphereRadius);

  // 깊이별로 그룹화 후, 부모-자식이 인접하도록 배치
  const byDepth = new Map<number, string[]>();
  for (const n of rawNodes) {
    const d = depthMap.get(n.id) ?? 0;
    const list = byDepth.get(d) ?? [];
    list.push(n.id);
    byDepth.set(d, list);
  }
  const depthLevels = [...byDepth.keys()].sort();

  // 교차 배치 — 같은 깊이 노드가 인접하지 않게
  const interleaved: string[] = [];
  const maxLevelLen = Math.max(...depthLevels.map((d) => byDepth.get(d)!.length), 0);
  for (let i = 0; i < maxLevelLen; i++) {
    for (const d of depthLevels) {
      const nodes = byDepth.get(d)!;
      if (i < nodes.length) interleaved.push(nodes[i]!);
    }
  }
  interleaved.forEach((id, i) => {
    allPositions.set(id, { ...fiboPositions[i]! });
  });

  // 반발력 시뮬레이션 — 구 표면 위에서 노드 간 균일 분포 강제
  // 이상적 거리: 구 표면을 N등분한 Tammes 문제의 근사
  const ids = rawNodes.map((n) => n.id);
  const N = ids.length;
  const idealDist = sphereRadius * 2 * Math.sqrt(Math.PI / N);
  const iterations = Math.max(300, N * 15);

  for (let iter = 0; iter < iterations; iter++) {
    // 점진적 감쇠 — 초기에 강하게, 수렴하면서 약하게
    const alpha = 0.3 * (1 - iter / iterations);

    for (let i = 0; i < N; i++) {
      const a = allPositions.get(ids[i]!)!;
      let fx = 0, fy = 0, fz = 0;

      for (let j = 0; j < N; j++) {
        if (i === j) continue;
        const b = allPositions.get(ids[j]!)!;
        const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < 0.001) continue;

        // 모든 쌍에 Coulomb 반발력 (거리의 역제곱)
        const repulsion = (idealDist * idealDist) / (dist * dist);
        const force = Math.min(repulsion * alpha, sphereRadius * 0.3);
        fx += (dx / dist) * force;
        fy += (dy / dist) * force;
        fz += (dz / dist) * force;
      }

      a.x += fx;
      a.y += fy;
      a.z += fz;

      // 구 표면으로 재투영
      const ra = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
      if (ra > 0.001) {
        a.x = (a.x / ra) * sphereRadius;
        a.y = (a.y / ra) * sphereRadius;
        a.z = (a.z / ra) * sphereRadius;
      }
    }
  }

  // NodeData 생성
  const nodes: NodeData[] = rawNodes.map((raw) => {
    const pos = allPositions.get(raw.id) ?? { x: 0, y: 0, z: 0 };
    const { theta, phi } = cartesianToSpherical(pos.x, pos.y, pos.z);
    const d = depthMap.get(raw.id) ?? 0;
    const validType = ['concept', 'nuance', 'mood', 'philosophy', 'abstraction', 'context'].includes(raw.type)
      ? raw.type as NodeData['type']
      : 'concept';

    return migrateNodeData({
      id: raw.id,
      label: raw.label,
      type: validType,
      weight: raw.weight,
      description: raw.description,
      depth: d,
      abstractionLevel: (raw.abstractionLevel as NodeData['abstractionLevel']) ?? 'basic',
      facets: raw.facets ? {
        cognitive: (raw.facets.cognitive as NodeData['type']) ?? validType,
        epistemological: (raw.facets.epistemological as NodeData['facets']['epistemological']) ?? 'theoretical',
        rhetorical: (raw.facets.rhetorical as NodeData['facets']['rhetorical']) ?? 'thesis',
      } : undefined,
      sphereCoord: { theta, phi },
      radialCoord: { angle: phi, depth: d },
      position: pos,
      parentId: raw.parentId ?? null,
      children: childMap.get(raw.id) ?? [],
      isUserCreated: false,
      isDeleted: false,
    });
  });

  // EdgeData 생성
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges: EdgeData[] = rawEdges
    .filter((e) => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId))
    .map((raw, i) => ({
      id: `edge-${i}-${raw.sourceId}-${raw.targetId}`,
      sourceId: raw.sourceId,
      targetId: raw.targetId,
      relation: raw.relation as EdgeData['relation'],
      strength: raw.strength,
      isUserCreated: false,
      isDeleted: false,
      isHierarchical: raw.relation === 'parent-child',
      extractionPass: raw.relation === 'parent-child' ? 2 : 4,
    }));

  return { nodes, edges };
}
