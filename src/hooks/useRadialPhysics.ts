import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGraphStore } from '../store/useGraphStore';

/**
 * 단순 스프링 물리 — d3-force 대신 직접 구현.
 *
 * 원칙:
 * 1. 평소: 완전 정지. 레이아웃 건드리지 않음.
 * 2. 드래그 중: 드래그 노드 근처 노드만 살짝 밀림.
 * 3. 놓으면: 드래그 노드에 관성(velocity) → 미끄러지다 원래 위치로 복원.
 * 4. 밀린 노드도 원래 위치로 부드럽게 복귀.
 */

interface NodeVel {
  vx: number;
  vy: number;
  restX: number;
  restY: number;
}

const PUSH_RADIUS = 0.6;       // 밀림 반경
const PUSH_STRENGTH = 0.15;    // 밀림 강도
const PULL_STRENGTH = 0.06;    // 연결된 노드 끌어당김 강도
const PULL_REST_LEN = 1.0;     // 엣지 자연 길이 (이보다 멀면 당김)
const RESTORE_STRENGTH = 0.08; // 원래 위치 복원 강도
const FRICTION = 0.85;         // 속도 감쇠
const MIN_SPEED = 0.0003;

export const radialPhysicsApi = {
  pinNode: (_nodeId: string) => {},
  moveNode: (_nodeId: string, _x: number, _y: number) => {},
  releaseNode: (_nodeId: string, _vx?: number, _vy?: number) => {},
};

export function useRadialPhysics() {
  const vels = useRef(new Map<string, NodeVel>());
  const activeRef = useRef(false);  // 물리가 작동 중인지
  const pinnedRef = useRef<string | null>(null);

  const mode = useGraphStore((s) => s.mode);

  // 드래그 시작: 주변 노드의 rest position 기록
  radialPhysicsApi.pinNode = (nodeId: string) => {
    pinnedRef.current = nodeId;
    const nodes = useGraphStore.getState().nodes;
    // 모든 노드의 현재 위치를 rest position으로 기록
    for (const [id, node] of nodes) {
      if (node.isDeleted) continue;
      if (!vels.current.has(id)) {
        vels.current.set(id, { vx: 0, vy: 0, restX: node.position.x, restY: node.position.y });
      } else {
        const v = vels.current.get(id)!;
        v.restX = node.position.x;
        v.restY = node.position.y;
      }
    }
    activeRef.current = true;
  };

  // 드래그 중: 가까운 노드 밀기 + 연결된 노드 당기기
  radialPhysicsApi.moveNode = (nodeId: string, x: number, y: number) => {
    const state = useGraphStore.getState();
    const ns = new Map(state.nodes);
    let changed = false;

    // 1. 가까운 노드 밀기 (반발)
    for (const [id, node] of ns) {
      if (id === nodeId || node.isDeleted) continue;
      const dx = node.position.x - x;
      const dy = node.position.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < PUSH_RADIUS && dist > 0.001) {
        const push = PUSH_STRENGTH * (1 - dist / PUSH_RADIUS);
        const nx = dx / dist, ny = dy / dist;
        ns.set(id, { ...node, position: { x: node.position.x + nx * push, y: node.position.y + ny * push, z: 0 } });
        const v = vels.current.get(id);
        if (v) { v.vx += nx * push * 0.3; v.vy += ny * push * 0.3; }
        changed = true;
      }
    }

    // 2. 연결된 노드 당기기 (엣지 장력)
    for (const edge of state.edges.values()) {
      if (edge.isDeleted) continue;
      let linkedId: string | null = null;
      if (edge.sourceId === nodeId) linkedId = edge.targetId;
      else if (edge.targetId === nodeId) linkedId = edge.sourceId;
      if (!linkedId) continue;

      const linked = ns.get(linkedId);
      if (!linked || linked.isDeleted) continue;

      const dx = x - linked.position.x;
      const dy = y - linked.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // 자연 길이보다 멀면 드래그 방향으로 당김
      if (dist > PULL_REST_LEN && dist > 0.001) {
        const pull = PULL_STRENGTH * (dist - PULL_REST_LEN) / dist;
        const pullX = dx * pull;
        const pullY = dy * pull;
        ns.set(linkedId, { ...linked, position: { x: linked.position.x + pullX, y: linked.position.y + pullY, z: 0 } });
        const v = vels.current.get(linkedId);
        if (v) { v.vx += pullX * 0.3; v.vy += pullY * 0.3; }
        changed = true;
      }
    }

    if (changed) useGraphStore.setState({ nodes: ns });
  };

  // 놓기: 관성 부여
  radialPhysicsApi.releaseNode = (nodeId: string, vx?: number, vy?: number) => {
    pinnedRef.current = null;
    const v = vels.current.get(nodeId);
    if (v && vx != null && vy != null) {
      v.vx = vx;
      v.vy = vy;
      // 놓은 위치를 새 rest로
      const node = useGraphStore.getState().nodes.get(nodeId);
      if (node) { v.restX = node.position.x; v.restY = node.position.y; }
    }
    activeRef.current = true;
  };

  // 매 프레임: 밀린 노드 + 놓인 노드의 복원 + 감속
  useFrame(() => {
    if (mode !== 'radial' || !activeRef.current) return;

    const nodes = useGraphStore.getState().nodes;
    const ns = new Map(nodes);
    let anyMoving = false;
    const pinned = pinnedRef.current;

    for (const [id, vel] of vels.current) {
      if (id === pinned) continue; // 드래그 중인 노드는 스킵
      const node = ns.get(id);
      if (!node || node.isDeleted) continue;

      // 원래 위치로 복원 스프링
      const dx = vel.restX - node.position.x;
      const dy = vel.restY - node.position.y;
      vel.vx += dx * RESTORE_STRENGTH;
      vel.vy += dy * RESTORE_STRENGTH;

      // 감쇠
      vel.vx *= FRICTION;
      vel.vy *= FRICTION;

      const speed = Math.abs(vel.vx) + Math.abs(vel.vy);
      if (speed > MIN_SPEED) {
        const newX = node.position.x + vel.vx;
        const newY = node.position.y + vel.vy;
        ns.set(id, { ...node, position: { x: newX, y: newY, z: 0 } });
        anyMoving = true;
      } else {
        vel.vx = 0;
        vel.vy = 0;
      }
    }

    if (anyMoving) {
      useGraphStore.setState({ nodes: ns });
    } else if (!pinned) {
      // 모든 노드 정지 → 물리 비활성
      activeRef.current = false;
    }
  });
}
