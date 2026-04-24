import { create } from 'zustand';
import type { NodeData, EdgeData, Vec3, SynthesisSegment } from '../types';

export interface HoveredProvenance {
  nodeIds: string[];
  edgeIds: string[];
  kind: 'text' | 'scene';
}

export type ViewMode = 'sphere' | 'radial' | 'interior';

// --- 엣지 생성 상태 ---
interface EdgeCreationState {
  isCreatingEdge: boolean;
  sourceNodeId: string | null;
  tempEndpoint: Vec3 | null;
}

const EDGE_CREATION_INITIAL: EdgeCreationState = {
  isCreatingEdge: false,
  sourceNodeId: null,
  tempEndpoint: null,
};

interface GraphState {
  // --- 모드 ---
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
  isTransitioning: boolean;
  setTransitioning: (v: boolean) => void;
  transitionProgress: number;
  transitionTarget: ViewMode | null;

  // --- 데이터 (이중 구조: Map + Array — P1-PATCH-4) ---
  nodes: Map<string, NodeData>;
  nodeArray: NodeData[];
  nodeIndexMap: Map<string, number>;
  edges: Map<string, EdgeData>;

  // --- 선택 ---
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  setHoveredNodeId: (id: string | null) => void;

  // --- 엣지 생성 ---
  edgeCreation: EdgeCreationState;
  startEdgeCreation: (sourceId: string) => void;
  updateTempEndpoint: (point: Vec3) => void;
  completeEdge: (targetId: string) => void;
  cancelEdgeCreation: () => void;

  // --- 프롬프트 ---
  originalPrompt: string;
  setOriginalPrompt: (p: string) => void;
  synthesizedPrompt: string;
  setSynthesizedPrompt: (p: string) => void;
  synthesisSegments: SynthesisSegment[];
  setSynthesisSegments: (segs: SynthesisSegment[]) => void;
  hoveredProvenance: HoveredProvenance | null;
  setHoveredProvenance: (p: HoveredProvenance | null) => void;
  response: string;
  setResponse: (r: string) => void;
  isProcessing: boolean;
  setProcessing: (v: boolean) => void;

  // --- 씬 ---
  sphereRadius: number;
  labelFontSize: number;
  setLabelFontSize: (size: number) => void;
  showLabels: boolean;
  toggleLabels: () => void;

  // --- 트리 구조 엣지 (Radial 모드 전용) ---
  treeEdges: { from: string; to: string }[];

  // --- 제스처 ---
  gestureEnabled: boolean;
  setGestureEnabled: (v: boolean) => void;

  // --- 추출 설정 ---
  extractionConfig: { maxDepth: number; maxNodes: number; branchingFactor: number };
  setExtractionConfig: (config: Partial<{ maxDepth: number; maxNodes: number; branchingFactor: number }>) => void;
  extractionProgress: { pass: number; total: number; nodesSoFar: number } | null;
  setExtractionProgress: (p: { pass: number; total: number; nodesSoFar: number } | null) => void;

  // --- CRUD ---
  addNode: (node: NodeData) => void;
  updateNode: (id: string, partial: Partial<NodeData>) => void;
  removeNode: (id: string) => void;
  softDeleteNode: (id: string) => void;
  restoreNode: (id: string) => void;
  addEdge: (edge: EdgeData) => void;
  removeEdge: (id: string) => void;
  appendNodes: (nodes: NodeData[], edges: EdgeData[]) => void;
  replaceGraph: (nodes: NodeData[], edges: EdgeData[]) => void;
}

export function rebuildArrays(nodes: Map<string, NodeData>) {
  const nodeArray: NodeData[] = [];
  const nodeIndexMap = new Map<string, number>();
  let i = 0;
  for (const [id, node] of nodes) {
    nodeArray.push(node);
    nodeIndexMap.set(id, i++);
  }
  return { nodeArray, nodeIndexMap };
}

export const useGraphStore = create<GraphState>((set, get) => ({
  mode: 'sphere',
  // P3-PATCH-6: 모드 전환 시 미완료 작업 정리
  setMode: (mode) =>
    set({
      mode,
      edgeCreation: { ...EDGE_CREATION_INITIAL },
    }),
  isTransitioning: false,
  setTransitioning: (v) => set({ isTransitioning: v }),
  transitionProgress: 0,
  transitionTarget: null,

  nodes: new Map(),
  nodeArray: [],
  nodeIndexMap: new Map(),
  edges: new Map(),

  selectedNodeId: null,
  hoveredNodeId: null,
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setHoveredNodeId: (id) => set({ hoveredNodeId: id }),

  // --- 엣지 생성 ---
  edgeCreation: { ...EDGE_CREATION_INITIAL },
  startEdgeCreation: (sourceId) =>
    set({
      edgeCreation: { isCreatingEdge: true, sourceNodeId: sourceId, tempEndpoint: null },
    }),
  updateTempEndpoint: (point) =>
    set((s) => ({
      edgeCreation: { ...s.edgeCreation, tempEndpoint: point },
    })),
  completeEdge: (targetId) => {
    const s = get();
    const { sourceNodeId } = s.edgeCreation;
    if (!sourceNodeId || sourceNodeId === targetId) {
      set({ edgeCreation: { ...EDGE_CREATION_INITIAL } });
      return;
    }
    // 중복 엣지 방지
    for (const edge of s.edges.values()) {
      if (
        (edge.sourceId === sourceNodeId && edge.targetId === targetId) ||
        (edge.sourceId === targetId && edge.targetId === sourceNodeId)
      ) {
        set({ edgeCreation: { ...EDGE_CREATION_INITIAL } });
        return;
      }
    }
    const newEdge: EdgeData = {
      id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sourceId: sourceNodeId,
      targetId,
      relation: 'parallel',
      strength: 0.5,
      isUserCreated: true,
      isDeleted: false,
      isHierarchical: false,
      extractionPass: 0,
    };
    const edges = new Map(s.edges);
    edges.set(newEdge.id, newEdge);
    set({ edges, edgeCreation: { ...EDGE_CREATION_INITIAL } });
  },
  cancelEdgeCreation: () => set({ edgeCreation: { ...EDGE_CREATION_INITIAL } }),

  // --- 프롬프트 ---
  originalPrompt: '',
  setOriginalPrompt: (p) => set({ originalPrompt: p }),
  synthesizedPrompt: '',
  setSynthesizedPrompt: (p) => set({ synthesizedPrompt: p }),
  synthesisSegments: [],
  setSynthesisSegments: (segs) => set({ synthesisSegments: segs }),
  hoveredProvenance: null,
  setHoveredProvenance: (p) => set({ hoveredProvenance: p }),
  response: '',
  setResponse: (r) => set({ response: r }),
  isProcessing: false,
  setProcessing: (v) => set({ isProcessing: v }),

  sphereRadius: 3,
  labelFontSize: 0.07,
  setLabelFontSize: (size) => set({ labelFontSize: size }),
  showLabels: true,
  toggleLabels: () => set((s) => ({ showLabels: !s.showLabels })),
  treeEdges: [],

  gestureEnabled: false,
  setGestureEnabled: (v) => set({ gestureEnabled: v }),

  extractionConfig: { maxDepth: 3, maxNodes: 15, branchingFactor: 3 },
  setExtractionConfig: (config) =>
    set((s) => ({ extractionConfig: { ...s.extractionConfig, ...config } })),
  extractionProgress: null,
  setExtractionProgress: (p) => set({ extractionProgress: p }),

  // --- CRUD ---
  addNode: (node) =>
    set((state) => {
      const nodes = new Map(state.nodes);
      nodes.set(node.id, node);
      return { nodes, ...rebuildArrays(nodes) };
    }),

  updateNode: (id, partial) =>
    set((state) => {
      const prev = state.nodes.get(id);
      if (!prev) return state;
      // 변경 없으면 Map 복사 생략
      const keys = Object.keys(partial);
      const hasChange = keys.some((k) => (partial as never)[k] !== (prev as never)[k]);
      if (!hasChange) return state;
      const updated = { ...prev, ...partial };
      const nodes = new Map(state.nodes);
      nodes.set(id, updated);
      return { nodes, ...rebuildArrays(nodes) };
    }),

  removeNode: (id) =>
    set((state) => {
      const nodes = new Map(state.nodes);
      nodes.delete(id);
      const edges = new Map(state.edges);
      for (const [eid, edge] of edges) {
        if (edge.sourceId === id || edge.targetId === id) edges.delete(eid);
      }
      return { nodes, edges, ...rebuildArrays(nodes) };
    }),

  // P3-PATCH-2: 소프트 삭제 + 연쇄 엣지 소프트 삭제
  softDeleteNode: (id) =>
    set((state) => {
      const nodes = new Map(state.nodes);
      const node = nodes.get(id);
      if (!node) return state;
      nodes.set(id, { ...node, isDeleted: true });

      const edges = new Map(state.edges);
      for (const [eid, edge] of edges) {
        if (edge.sourceId === id || edge.targetId === id) {
          edges.set(eid, { ...edge, isDeleted: true });
        }
      }
      return {
        nodes,
        edges,
        ...rebuildArrays(nodes),
        selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
      };
    }),

  restoreNode: (id) =>
    set((state) => {
      const nodes = new Map(state.nodes);
      const node = nodes.get(id);
      if (!node) return state;
      nodes.set(id, { ...node, isDeleted: false });

      const edges = new Map(state.edges);
      for (const [eid, edge] of edges) {
        if (edge.sourceId === id || edge.targetId === id) {
          edges.set(eid, { ...edge, isDeleted: false });
        }
      }
      return { nodes, edges, ...rebuildArrays(nodes) };
    }),

  addEdge: (edge) =>
    set((state) => {
      const edges = new Map(state.edges);
      edges.set(edge.id, edge);
      return { edges };
    }),

  removeEdge: (id) =>
    set((state) => {
      const edges = new Map(state.edges);
      edges.delete(id);
      return { edges };
    }),

  replaceGraph: (nodes, edges) =>
    set(() => {
      const nodeMap = new Map<string, NodeData>();
      nodes.forEach((n) => nodeMap.set(n.id, n));
      const edgeMap = new Map<string, EdgeData>();
      edges.forEach((e) => edgeMap.set(e.id, e));
      return {
        nodes: nodeMap,
        edges: edgeMap,
        ...rebuildArrays(nodeMap),
        selectedNodeId: null,
        hoveredNodeId: null,
        edgeCreation: { ...EDGE_CREATION_INITIAL },
      };
    }),

  appendNodes: (newNodes, newEdges) =>
    set((state) => {
      const nodes = new Map(state.nodes);
      newNodes.forEach((n) => nodes.set(n.id, n));
      const edges = new Map(state.edges);
      newEdges.forEach((e) => edges.set(e.id, e));
      return { nodes, edges, ...rebuildArrays(nodes) };
    }),
}));
