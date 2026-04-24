import { useGraphStore } from '../store/useGraphStore';
import type { EdgeData } from '../types';

let _prevKey: string | null = null;
let _connected: Set<string> | null = null;
let _focusId: string | null = null;

/** 0 → 1 로 진행하는 전환 진행도 (useFrame에서 lerp) */
let _fadeProgress = 0;

/** 현재 목표 상태: 포커스 있으면 1, 없으면 0 */
let _fadeTarget = 0;

/** 전환 중 대기 중인 다음 하이라이트 — dip 끝에 커밋됨 */
let _pendingKey: string | null = null;
let _pendingFocusId: string | null = null;
let _pendingConnected: Set<string> | null = null;

const FADE_SPEED = 0.08;
const DIP_THRESHOLD = 0.05;

type StoreSnapshot = ReturnType<typeof useGraphStore.getState>;

/**
 * 포커스된 노드와 그에 연결된 노드 셋 반환.
 * useFrame 안에서 호출 — 캐시 키가 같으면 캐시 반환 (프레임당 1회 계산).
 *
 * 우선순위: hoveredProvenance (diff / 문장 클릭) > selectedNodeId (클릭).
 * 두 non-null 대상 간 전환 시에는 dip-through-zero: fadeProgress 가 0 근처까지
 * 감쇠한 뒤 새 connected 셋으로 스왑 후 다시 상승.
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

  // 요청된 대상이 바뀐 경우: dip 시작 또는 즉시 커밋 분기
  if (key !== _prevKey && !(key === _pendingKey && _pendingKey !== null)) {
    if (_prevKey && key && _fadeProgress > DIP_THRESHOLD) {
      // A→B 전환: 기존을 페이드 아웃하면서 pending 에 새 타겟 보관
      _pendingKey = key;
      _pendingFocusId = focusId;
      _pendingConnected = computeConnected(state, focusId, prov, isCreating);
      _fadeTarget = 0;
    } else {
      // null→X, X→null, 또는 이미 dip 바닥: 즉시 스왑
      _prevKey = key;
      _focusId = focusId;
      _connected = key ? computeConnected(state, focusId, prov, isCreating) : null;
      _pendingKey = null;
      _pendingFocusId = null;
      _pendingConnected = null;
      _fadeTarget = key ? 1 : 0;
    }
  }

  // fadeProgress 진행
  if (_fadeProgress < _fadeTarget) {
    _fadeProgress = Math.min(_fadeTarget, _fadeProgress + FADE_SPEED);
  } else if (_fadeProgress > _fadeTarget) {
    _fadeProgress = Math.max(_fadeTarget, _fadeProgress - FADE_SPEED);
  }

  // dip 바닥 도달 → pending 커밋 후 재상승
  if (_pendingKey && _fadeProgress <= DIP_THRESHOLD) {
    _prevKey = _pendingKey;
    _focusId = _pendingFocusId;
    _connected = _pendingConnected;
    _pendingKey = null;
    _pendingFocusId = null;
    _pendingConnected = null;
    _fadeTarget = 1;
  }

  // 완전 페이드 아웃 완료
  if (_fadeProgress < 0.01 && _fadeTarget === 0 && !_pendingKey) {
    _prevKey = null;
    _connected = null;
    _focusId = null;
    return { focusId: null, connected: null, fadeProgress: 0 };
  }

  return { focusId: _focusId, connected: _connected, fadeProgress: _fadeProgress };
}

function computeConnected(
  state: StoreSnapshot,
  focusId: string | null,
  prov: StoreSnapshot['hoveredProvenance'],
  isCreating: boolean,
): Set<string> {
  const set = new Set<string>();

  if (prov && prov.nodeIds.length > 0 && !isCreating) {
    for (const id of prov.nodeIds) set.add(id);
    const edgeIdSet = new Set(prov.edgeIds);
    for (const [eid, edge] of state.edges as Map<string, EdgeData>) {
      if (edge.isDeleted) continue;
      if (edgeIdSet.has(eid)) {
        set.add(edge.sourceId);
        set.add(edge.targetId);
      }
    }
    return set;
  }

  if (!focusId) return set;

  set.add(focusId);
  for (const edge of (state.edges as Map<string, EdgeData>).values()) {
    if (edge.isDeleted) continue;
    if (edge.sourceId === focusId) set.add(edge.targetId);
    if (edge.targetId === focusId) set.add(edge.sourceId);
  }
  for (const te of state.treeEdges as { from: string; to: string }[]) {
    if (te.from === focusId) set.add(te.to);
    if (te.to === focusId) set.add(te.from);
  }
  return set;
}

/**
 * highlightState 캐시를 강제 무효화.
 * 엣지 추가/삭제 후 connected 셋을 다시 계산하도록 할 때 사용.
 */
export function invalidateHighlightCache(): void {
  _prevKey = null;
  _pendingKey = null;
  _pendingFocusId = null;
  _pendingConnected = null;
}

