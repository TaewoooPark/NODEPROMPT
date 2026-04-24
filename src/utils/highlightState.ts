import { useGraphStore } from '../store/useGraphStore';

let _prevKey: string | null | undefined = undefined;
let _connected: Set<string> | null = null;
let _focusId: string | null = null;

/** 0 → 1 로 진행하는 전환 진행도 (useFrame에서 lerp) */
let _fadeProgress = 0;

/** 현재 목표 상태: 포커스 있으면 1, 없으면 0 */
let _fadeTarget = 0;

const FADE_SPEED = 0.08;

/**
 * 포커스된 노드와 그에 연결된 노드 셋 반환.
 * useFrame 안에서 호출 — 캐시 키가 같으면 캐시 반환 (프레임당 1회 계산).
 *
 * 우선순위: hoveredProvenance (합성 diff hover) > selectedNodeId (클릭).
 * 엣지 생성 중에는 포커스 일시 해제.
 */
export function getHighlightState(): {
  focusId: string | null;
  connected: Set<string> | null;
  fadeProgress: number;
} {
  const state = useGraphStore.getState();

  const isCreating = state.edgeCreation.isCreatingEdge;
  const prov = state.hoveredProvenance;

  let key: string | null = null;
  let focusId: string | null = null;

  if (!isCreating) {
    if (prov && prov.nodeIds.length > 0) {
      key = `prov:${prov.nodeIds.join(',')}|${prov.edgeIds.join(',')}`;
      focusId = prov.nodeIds[0] ?? null;
    } else if (state.selectedNodeId) {
      key = `sel:${state.selectedNodeId}`;
      focusId = state.selectedNodeId;
    }
  }

  _fadeTarget = focusId ? 1 : 0;

  if (_fadeProgress < _fadeTarget) {
    _fadeProgress = Math.min(_fadeTarget, _fadeProgress + FADE_SPEED);
  } else if (_fadeProgress > _fadeTarget) {
    _fadeProgress = Math.max(_fadeTarget, _fadeProgress - FADE_SPEED);
  }

  if (_fadeProgress < 0.01 && _fadeTarget === 0) {
    _prevKey = undefined;
    _connected = null;
    _focusId = null;
    return { focusId: null, connected: null, fadeProgress: 0 };
  }

  if (key === _prevKey) {
    return { focusId: _focusId, connected: _connected, fadeProgress: _fadeProgress };
  }

  _prevKey = key;
  _focusId = focusId;

  if (!key || !focusId) {
    return { focusId: null, connected: _connected, fadeProgress: _fadeProgress };
  }

  const set = new Set<string>();

  if (prov && prov.nodeIds.length > 0 && !isCreating) {
    // Provenance 경로: 명시된 노드들 + 명시된 엣지들의 양 끝점
    for (const id of prov.nodeIds) set.add(id);
    const edgeIdSet = new Set(prov.edgeIds);
    for (const [eid, edge] of state.edges) {
      if (edge.isDeleted) continue;
      if (edgeIdSet.has(eid)) {
        set.add(edge.sourceId);
        set.add(edge.targetId);
      }
    }
  } else {
    // 선택 경로: 이전과 동일 — 포커스 노드 + 1-hop 이웃
    set.add(focusId);
    for (const edge of state.edges.values()) {
      if (edge.isDeleted) continue;
      if (edge.sourceId === focusId) set.add(edge.targetId);
      if (edge.targetId === focusId) set.add(edge.sourceId);
    }
    for (const te of state.treeEdges) {
      if (te.from === focusId) set.add(te.to);
      if (te.to === focusId) set.add(te.from);
    }
  }

  _connected = set;
  return { focusId, connected: set, fadeProgress: _fadeProgress };
}

/**
 * highlightState 캐시를 강제 무효화.
 * 엣지 추가/삭제 후 connected 셋을 다시 계산하도록 할 때 사용.
 */
export function invalidateHighlightCache(): void {
  _prevKey = undefined;
}
