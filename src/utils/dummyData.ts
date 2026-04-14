import type { NodeData, NodeType, EdgeData, EdgeRelation } from '../types';
import { fibonacciSphere } from './fibonacciSphere';
import { cartesianToSpherical } from './coordinates';
import type { Lang } from '../i18n/translations';

const NODE_TYPES: NodeType[] = [
  'ens', 'res', 'unum', 'aliquid', 'verum', 'bonum',
];

// ens = 존재(Being) — 프롬프트가 '있다'고 정립하는 지시체
// res = 본질(Essence) — 그것이 '무엇'인지 (quidditas)
// unum = 통일(Unity) — 하나로 묶이는 근거
// aliquid = 차이(Difference) — 구별짓는 것
// verum = 진리(Truth) — 지성에 대해 참인 방식
// bonum = 가치(Value) — 의지에 대해 욕구될 방식
const LABELS_KO: Record<NodeType, string[]> = {
  ens:     ['인공지능', '딥러닝', '자연어 처리', '자율 에이전트', '학습 시스템', '추론 엔진', '데이터셋', '모델'],
  res:     ['블랙박스', '창발성', '특이점', '피드백 루프', '메타인지', '튜링 테스트', '중국어 방', '프레임 문제'],
  unum:    ['기업 환경', '학술 연구', '일상 활용', '규제 정책', '교육 현장', '의료 분야', '군사 응용', '예술 창작'],
  aliquid: ['편향 우려', '과잉 의존', '인간 대체', '창의성 한계', '해석 불가', '맥락 손실', '감정 부재', '신뢰 문제'],
  verum:   ['공리주의', '의무론', '덕 윤리', '실존주의', '실용주의', '구조주의', '포스트모던', '자유의지'],
  bonum:   ['경이', '불안', '기대', '회의', '흥분', '두려움', '호기심', '경계'],
};

const LABELS_EN: Record<NodeType, string[]> = {
  ens:     ['Artificial Intelligence', 'Deep Learning', 'NLP', 'Autonomous Agent', 'Learning System', 'Reasoning Engine', 'Dataset', 'Model'],
  res:     ['Black Box', 'Emergence', 'Singularity', 'Feedback Loop', 'Metacognition', 'Turing Test', 'Chinese Room', 'Frame Problem'],
  unum:    ['Corporate', 'Academic Research', 'Everyday Use', 'Regulation', 'Education', 'Healthcare', 'Military', 'Art Creation'],
  aliquid: ['Bias Concern', 'Over-reliance', 'Human Replacement', 'Creativity Limits', 'Unexplainability', 'Context Loss', 'Lack of Emotion', 'Trust Issues'],
  verum:   ['Utilitarianism', 'Deontology', 'Virtue Ethics', 'Existentialism', 'Pragmatism', 'Structuralism', 'Postmodernism', 'Free Will'],
  bonum:   ['Wonder', 'Anxiety', 'Anticipation', 'Skepticism', 'Excitement', 'Fear', 'Curiosity', 'Vigilance'],
};

const DESC_KO = (label: string) => `${label}에 대한 개념`;
const DESC_EN = (label: string) => `Concept of ${label}`;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function generateDummyNodes(count: number, radius: number, lang: Lang = 'ko'): NodeData[] {
  const positions = fibonacciSphere(count, radius);
  const nodes: NodeData[] = [];
  const labels = lang === 'en' ? LABELS_EN : LABELS_KO;
  const desc = lang === 'en' ? DESC_EN : DESC_KO;

  for (let i = 0; i < count; i++) {
    const type = NODE_TYPES[i % NODE_TYPES.length]!;
    const typeLabels = labels[type];
    const label = typeLabels[i % typeLabels.length]!;
    const pos = positions[i]!;
    const { theta, phi } = cartesianToSpherical(pos.x, pos.y, pos.z);
    const raw = Math.random();
    const weight = 0.15 + Math.pow(raw, 1.5) * 0.85;

    nodes.push({
      id: `node-${i}`,
      label,
      type,
      weight: Math.round(weight * 100) / 100,
      description: desc(label),
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
