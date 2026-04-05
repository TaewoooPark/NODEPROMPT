import type { NodeData, NodeType, EdgeData, EdgeRelation } from '../types';
import { fibonacciSphere } from './fibonacciSphere';
import { cartesianToSpherical } from './coordinates';

const NODE_TYPES: NodeType[] = [
  'concept', 'nuance', 'mood', 'philosophy', 'abstraction', 'context',
];

const LABELS: Record<NodeType, string[]> = {
  concept:     ['인공지능', '딥러닝', '자연어 처리', '윤리', '자율성', '학습', '추론', '데이터'],
  nuance:      ['편향 우려', '과잉 의존', '인간 대체', '창의성 한계', '해석 불가', '맥락 손실', '감정 부재', '신뢰 문제'],
  mood:        ['경이', '불안', '기대', '회의', '흥분', '두려움', '호기심', '경계'],
  philosophy:  ['공리주의', '의무론', '덕 윤리', '실존주의', '실용주의', '구조주의', '포스트모던', '자유의지'],
  abstraction: ['블랙박스', '창발성', '특이점', '피드백 루프', '메타인지', '튜링 테스트', '중국어 방', '프레임 문제'],
  context:     ['기업 환경', '학술 연구', '일상 활용', '규제 정책', '교육 현장', '의료 분야', '군사 응용', '예술 창작'],
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function generateDummyNodes(count: number, radius: number): NodeData[] {
  const positions = fibonacciSphere(count, radius);
  const nodes: NodeData[] = [];

  for (let i = 0; i < count; i++) {
    const type = NODE_TYPES[i % NODE_TYPES.length]!;
    const labels = LABELS[type];
    const label = labels[i % labels.length]!;
    const pos = positions[i]!;
    const { theta, phi } = cartesianToSpherical(pos.x, pos.y, pos.z);
    // 전체 범위 0.15–1.0 활용, 계층적 분포 (소수만 높고 다수가 낮은 쪽으로)
    const raw = Math.random();
    const weight = 0.15 + Math.pow(raw, 1.5) * 0.85;

    nodes.push({
      id: `node-${i}`,
      label,
      type,
      weight: Math.round(weight * 100) / 100,
      description: `${label}에 대한 개념`,
      depth: 0,
      abstractionLevel: 'basic' as const,
      facets: { cognitive: type, epistemological: 'theoretical' as const, rhetorical: 'thesis' as const },
      sphereCoord: { theta, phi },
      radialCoord: { angle: phi, depth: theta },
      position: pos,
      parentId: null,
      children: [],
      isUserCreated: false,
      isDeleted: false,
    });
  }

  return nodes;
}

const EDGE_RELATIONS: EdgeRelation[] = [
  'causal', 'contrast', 'amplify', 'suppress', 'parallel', 'dependency',
];

export function generateDummyEdges(nodes: NodeData[], edgeCount: number): EdgeData[] {
  const edges: EdgeData[] = [];
  const ids = nodes.map((n) => n.id);

  for (let i = 0; i < edgeCount; i++) {
    const srcIdx = Math.floor(Math.random() * ids.length);
    let tgtIdx = Math.floor(Math.random() * ids.length);
    if (tgtIdx === srcIdx) tgtIdx = (tgtIdx + 1) % ids.length;

    edges.push({
      id: `edge-${i}`,
      sourceId: ids[srcIdx]!,
      targetId: ids[tgtIdx]!,
      relation: pick(EDGE_RELATIONS),
      strength: Math.round((0.3 + Math.random() * 0.7) * 100) / 100,
      isHierarchical: false,
      extractionPass: 0,
      isUserCreated: false,
      isDeleted: false,
    });
  }

  return edges;
}
