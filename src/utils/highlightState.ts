import { useGraphStore } from '../store/useGraphStore';

let _prevFocusId: string | null | undefined = undefined;
let _connected: Set<string> | null = null;

/** 0 → 1 로 진행하는 전환 진행도 (useFrame에서 lerp) */
let _fadeProgress = 0;

/** 현재 목표 상태: 포커스 있으면 1, 없으면 0 */
let _fadeTarget = 0;

const FADE_SPEED = 0.08;

/**
 * 포커스된 노드와 그에 연결된 노드 셋 반환.
 * useFrame 안에서 호출 — focusId가 같으면 캐시 반환 (프레임당 1회 계산).
 *
 * 클릭 전용: hoveredNodeId는 무시하고 selectedNodeId만 사용.
 * 엣지 생성 중에는 포커스 일시 해제 (모든 노드 보여야 함).
 */
export function getHighlightState(): {
  focusId: string | null;
  connected: Set<string> | null;
  fadeProgress: number;
} {
  const state = useGraphStore.getState();

  // 엣지 생성 중에는 포커스 해제 (fade out)
  const isCreating = state.edgeCreation.isCreatingEdge;

  // 클릭 전용: hoveredNodeId 제외
  const rawFocusId = state.selectedNodeId ?? null;
  const focusId = isCreating ? null : rawFocusId;

  // fade 목표 업데이트
  _fadeTarget = focusId ? 1 : 0;

  // lerp
  if (_fadeProgress < _fadeTarget) {
    _fadeProgress = Math.min(_fadeTarget, _fadeProgress + FADE_SPEED);
  } else if (_fadeProgress > _fadeTarget) {
    _fadeProgress = Math.max(_fadeTarget, _fadeProgress - FADE_SPEED);
  }

  // 전환 완료 시 connected 정리
  if (_fadeProgress < 0.01 && _fadeTarget === 0) {
    _prevFocusId = undefined;
    _connected = null;
    return { focusId: null, connected: null, fadeProgress: 0 };
  }

  if (focusId === _prevFocusId) {
    return { focusId, connected: _connected, fadeProgress: _fadeProgress };
  }

  _prevFocusId = focusId;
  if (!focusId) {
    // fade out 중 — 이전 connected 유지
    return { focusId: null, connected: _connected, fadeProgress: _fadeProgress };
  }

  const set = new Set<string>([focusId]);
  for (const edge of state.edges.values()) {
    if (edge.isDeleted) continue;
    if (edge.sourceId === focusId) set.add(edge.targetId);
    if (edge.targetId === focusId) set.add(edge.sourceId);
  }
  for (const te of state.treeEdges) {
    if (te.from === focusId) set.add(te.to);
    if (te.to === focusId) set.add(te.from);
  }
  _connected = set;
  return { focusId, connected: set, fadeProgress: _fadeProgress };
}

/**
 * highlightState 캐시를 강제 무효화.
 * 엣지 추가/삭제 후 connected 셋을 다시 계산하도록 할 때 사용.
 */
export function invalidateHighlightCache(): void {
  _prevFocusId = undefined;
}
