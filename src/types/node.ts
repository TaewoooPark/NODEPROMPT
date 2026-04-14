// ── 6 Transcendentia (Aquinas, De Veritate q.1 a.1) ──
// ens / res / unum / aliquid / verum / bonum
// See HelpOverlay and README for the mapping of each to a metaphysical question.
export type NodeType =
  | 'ens'       // 존재 / Being — id quod est
  | 'res'       // 본질 / Essence — quod habet quidditatem
  | 'unum'      // 통일 / Unity — ens indivisum
  | 'aliquid'   // 차이 / Difference — aliud-quid
  | 'verum'     // 진리 / Truth — ens ut cognoscibile
  | 'bonum';    // 가치 / Value — ens ut appetibile

export type AbstractionLevel =
  | 'superordinate'   // D=0-1: 최고 추상 (Rosch 상위범주)
  | 'basic'           // D=2: 인지적 최적점, 가장 밀집 (Rosch 기본수준)
  | 'subordinate'     // D=3-4: 구체적 세부 (Rosch 하위범주)
  | 'instance';       // D=5: 구체 사례

export type EpistemologicalFacet =
  | 'empirical' | 'theoretical' | 'normative' | 'methodological';

export type RhetoricalFacet =
  | 'thesis' | 'antithesis' | 'evidence' | 'qualifier' | 'warrant';

export interface FacetSet {
  cognitive: NodeType;
  epistemological: EpistemologicalFacet;
  rhetorical: RhetoricalFacet;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface SphericalCoord {
  theta: number;
  phi: number;
}

export interface RadialCoord {
  angle: number;
  depth: number;
}

export interface NodeData {
  id: string;
  label: string;
  type: NodeType;
  weight: number;
  description: string;

  // 계층 구조
  depth: number;                    // 0=루트, 1=테마, 2=기본개념, 3+=세부
  abstractionLevel: AbstractionLevel;
  facets: FacetSet;

  sphereCoord: SphericalCoord;
  radialCoord: RadialCoord;
  position: Vec3;

  parentId: string | null;
  children: string[];
  isUserCreated: boolean;
  isDeleted: boolean;
}

export const NODE_COLORS: Record<NodeType, string> = {
  ens:     '#2c2c2c',
  aliquid: '#6b5344',
  bonum:   '#5a4460',
  verum:   '#3d5167',
  res:     '#6b4040',
  unum:    '#4a6050',
};

export const DEPTH_COLORS: Record<number, string> = {
  0: '#1a1a1a',
  1: '#3d3d3d',
  2: '#5a5a5a',
  3: '#787878',
  4: '#969696',
};

/** 하위 호환 마이그레이션 */
export function migrateNodeData(node: Partial<NodeData> & { id: string; label: string; type: NodeType }): NodeData {
  return {
    weight: 0.5,
    description: '',
    depth: 0,
    abstractionLevel: 'basic',
    facets: {
      cognitive: node.type,
      epistemological: 'theoretical',
      rhetorical: 'thesis',
    },
    sphereCoord: { theta: 0, phi: 0 },
    radialCoord: { angle: 0, depth: 0 },
    position: { x: 0, y: 0, z: 0 },
    parentId: null,
    children: [],
    isUserCreated: false,
    isDeleted: false,
    ...node,
  } as NodeData;
}
