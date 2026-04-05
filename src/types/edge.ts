export type EdgeRelation =
  | 'causal'
  | 'contrast'
  | 'amplify'
  | 'suppress'
  | 'parallel'
  | 'dependency'
  | 'parent-child'
  | 'cross-link'
  | 'custom';

export interface EdgeData {
  id: string;
  sourceId: string;
  targetId: string;
  relation: EdgeRelation;
  strength: number;
  isUserCreated: boolean;
  isDeleted: boolean;
  isHierarchical: boolean;
  extractionPass: number;
  label?: string;
}

export const EDGE_COLORS: Record<EdgeRelation, string> = {
  causal:       '#2c2c2c',
  contrast:     '#6b4040',
  amplify:      '#4a6050',
  suppress:     '#5a4460',
  parallel:     '#3d5167',
  dependency:   '#6b5344',
  'parent-child': '#888888',
  'cross-link':   '#555555',
  custom:       '#3d3d3d',
};
