import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGraphStore } from '../store/useGraphStore';

const CURVE_SAMPLES = 8;           // 곡선 당 샘플 수
const SEGMENTS_PER_EDGE = CURVE_SAMPLES - 1;  // 7 세그먼트
const VERTS_PER_EDGE = SEGMENTS_PER_EDGE * 2; // lineSegments용: 14 vertices
const MAX_EDGES = 200;
const BUFFER_SIZE = MAX_EDGES * VERTS_PER_EDGE * 3;

// 재사용 벡터
const _s = new THREE.Vector3();
const _t = new THREE.Vector3();
const _ctrl = new THREE.Vector3();
const _p0 = new THREE.Vector3();
const _p1 = new THREE.Vector3();

/**
 * 전환 중 엣지를 곡선으로 렌더링 (노드와 함께 애니메이션).
 * useFrame 기반 — React re-render 0회.
 * QuadraticBezier 곡선으로 원래 EdgeLine과 유사한 형태.
 */
export function TransitionEdges() {
  const lineRef = useRef<THREE.LineSegments>(null);
  const edges = useGraphStore((s) => s.edges);

  const edgeList = useMemo(
    () => Array.from(edges.values()).filter((e) => !e.isDeleted),
    [edges],
  );

  const positions = useMemo(() => new Float32Array(BUFFER_SIZE), []);
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setDrawRange(0, 0);
    return g;
  }, [positions]);

  useFrame(() => {
    const transitioning = useGraphStore.getState().isTransitioning;
    if (!transitioning || !lineRef.current) {
      if (lineRef.current) lineRef.current.visible = false;
      return;
    }

    lineRef.current.visible = true;
    const nodes = useGraphStore.getState().nodes;
    let idx = 0;

    for (let ei = 0; ei < edgeList.length; ei++) {
      const edge = edgeList[ei]!;
      const sn = nodes.get(edge.sourceId);
      const tn = nodes.get(edge.targetId);
      if (!sn || !tn) continue;

      _s.set(sn.position.x, sn.position.y, sn.position.z);
      _t.set(tn.position.x, tn.position.y, tn.position.z);

      // Lombardi 스타일 곡선 제어점 (sweep 번갈아)
      const dx = _t.x - _s.x, dy = _t.y - _s.y, dz = _t.z - _s.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < 0.001) continue;

      const curveFactor = Math.max(0.2, Math.min(0.8, 1.5 / (dist + 0.5)));
      const sweepSign = ei % 2 === 0 ? 1 : -1;

      // 3D 법선 (up 방향과 외적)
      const nx = -dy / dist, ny = dx / dist;
      const offset = dist * curveFactor * 0.3 * sweepSign;
      _ctrl.set(
        (_s.x + _t.x) / 2 + nx * offset,
        (_s.y + _t.y) / 2 + ny * offset,
        (_s.z + _t.z) / 2,
      );

      // QuadraticBezier 샘플링 → lineSegments 쌍
      for (let j = 0; j < SEGMENTS_PER_EDGE; j++) {
        const t0 = j / (CURVE_SAMPLES - 1);
        const t1 = (j + 1) / (CURVE_SAMPLES - 1);

        // B(t) = (1-t)²·S + 2(1-t)t·C + t²·T
        const a0 = (1 - t0) * (1 - t0), b0 = 2 * (1 - t0) * t0, c0 = t0 * t0;
        _p0.set(
          a0 * _s.x + b0 * _ctrl.x + c0 * _t.x,
          a0 * _s.y + b0 * _ctrl.y + c0 * _t.y,
          a0 * _s.z + b0 * _ctrl.z + c0 * _t.z,
        );
        const a1 = (1 - t1) * (1 - t1), b1 = 2 * (1 - t1) * t1, c1 = t1 * t1;
        _p1.set(
          a1 * _s.x + b1 * _ctrl.x + c1 * _t.x,
          a1 * _s.y + b1 * _ctrl.y + c1 * _t.y,
          a1 * _s.z + b1 * _ctrl.z + c1 * _t.z,
        );

        positions[idx++] = _p0.x; positions[idx++] = _p0.y; positions[idx++] = _p0.z;
        positions[idx++] = _p1.x; positions[idx++] = _p1.y; positions[idx++] = _p1.z;
      }
    }

    const attr = geom.getAttribute('position') as THREE.BufferAttribute;
    attr.needsUpdate = true;
    geom.setDrawRange(0, idx / 3);
  });

  return (
    <lineSegments ref={lineRef} geometry={geom} visible={false}>
      <lineBasicMaterial color="#2c2c2c" transparent opacity={0.55} depthWrite={false} />
    </lineSegments>
  );
}
