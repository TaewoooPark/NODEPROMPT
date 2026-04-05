export type { NodeType, AbstractionLevel, EpistemologicalFacet, RhetoricalFacet, FacetSet, Vec3, SphericalCoord, RadialCoord, NodeData } from './node';
export { NODE_COLORS, DEPTH_COLORS, migrateNodeData } from './node';
export type { EdgeRelation, EdgeData } from './edge';
export { EDGE_COLORS } from './edge';
export type { ExtractionConfig } from './extraction';
export { computeBranchingFactor, allocateBudget, allocateLevelBudget } from './extraction';
