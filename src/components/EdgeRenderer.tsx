import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGraphStore } from '../store/useGraphStore';
import { getHighlightState } from '../utils/highlightState';

const CURVE_SAMPLES = 12;
const SEGS = CURVE_SAMPLES - 1;
const VERTS_PER_EDGE = SEGS * 2;
const MAX_EDGES = 200;
const BUFFER_SIZE = MAX_EDGES * VERTS_PER_EDGE * 3;

const _s = new THREE.Vector3();
const _t = new THREE.Vector3();
const _ctrl = new THREE.Vector3();
const _p0 = new THREE.Vector3();
const _p1 = new THREE.Vector3();

function bezierPoint(s: THREE.Vector3, c: THREE.Vector3, t_: THREE.Vector3, u: number, out: THREE.Vector3) {
  const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, d = u * u;
  out.set(a * s.x + b * c.x + d * t_.x, a * s.y + b * c.y + d * t_.y, a * s.z + b * c.z + d * t_.z);
}

function writeBezier(
  buf: Float32Array, startIdx: number,
  src: THREE.Vector3, ctrl: THREE.Vector3, tgt: THREE.Vector3,
): number {
  let idx = startIdx;
  for (let j = 0; j < SEGS; j++) {
    bezierPoint(src, ctrl, tgt, j / SEGS, _p0);
    bezierPoint(src, ctrl, tgt, (j + 1) / SEGS, _p1);
    buf[idx++] = _p0.x; buf[idx++] = _p0.y; buf[idx++] = _p0.z;
    buf[idx++] = _p1.x; buf[idx++] = _p1.y; buf[idx++] = _p1.z;
  }
  return idx;
}

/**
 * 통합 엣지 렌더러 — active/faded 분리로 하이라이트 지원.
 * useFrame 기반 — React re-render 0회.
 */
export function EdgeRenderer() {
  const activeRef = useRef<THREE.LineSegments>(null);
  const fadedRef = useRef<THREE.LineSegments>(null);
  const edges = useGraphStore((s) => s.edges);

  const edgeList = useMemo(
    () => Array.from(edges.values()).filter((e) => !e.isDeleted),
    [edges],
  );

  const activePos = useMemo(() => new Float32Array(BUFFER_SIZE), []);
  const fadedPos = useMemo(() => new Float32Array(BUFFER_SIZE), []);

  const activeGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(activePos, 3));
    g.setDrawRange(0, 0);
    return g;
  }, [activePos]);

  const fadedGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(fadedPos, 3));
    g.setDrawRange(0, 0);
    return g;
  }, [fadedPos]);

  // lerp용 현재 opacity 추적
  const activeOpacityRef = useRef(0.55);
  const fadedOpacityRef = useRef(0.04);

  useFrame(() => {
    if (!activeRef.current || !fadedRef.current) return;
    const nodes = useGraphStore.getState().nodes;
    const { focusId, fadeProgress } = getHighlightState();

    let aIdx = 0;
    let fIdx = 0;

    for (let ei = 0; ei < edgeList.length; ei++) {
      const edge = edgeList[ei]!;
      const sn = nodes.get(edge.sourceId);
      const tn = nodes.get(edge.targetId);
      if (!sn || !tn) continue;

      _s.set(sn.position.x, sn.position.y, sn.position.z);
      _t.set(tn.position.x, tn.position.y, tn.position.z);

      const dx = _t.x - _s.x, dy = _t.y - _s.y, dz = _t.z - _s.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < 0.001) continue;

      const curveFactor = Math.max(0.2, Math.min(0.8, 1.5 / (dist + 0.5)));
      const sweepSign = ei % 2 === 0 ? 1 : -1;
      const nx = -dy / dist, ny = dx / dist;
      const offset = dist * curveFactor * 0.3 * sweepSign;

      _ctrl.set(
        (_s.x + _t.x) / 2 + nx * offset,
        (_s.y + _t.y) / 2 + ny * offset,
        (_s.z + _t.z) / 2,
      );

      const isActive = !focusId || edge.sourceId === focusId || edge.targetId === focusId;
      if (isActive) {
        aIdx = writeBezier(activePos, aIdx, _s, _ctrl, _t);
      } else {
        fIdx = writeBezier(fadedPos, fIdx, _s, _ctrl, _t);
      }
    }

    // Active edges: fadeProgress로 부드러운 opacity 전환
    const targetActiveOp = focusId ? 0.55 + 0.25 * fadeProgress : 0.55;
    activeOpacityRef.current += (targetActiveOp - activeOpacityRef.current) * 0.12;
    const aMat = activeRef.current.material as THREE.LineBasicMaterial;
    aMat.opacity = activeOpacityRef.current;
    (activeGeom.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    activeGeom.setDrawRange(0, aIdx / 3);
    activeRef.current.visible = aIdx > 0;

    // Faded edges: fadeProgress로 부드럽게 나타남/사라짐
    const targetFadedOp = fadeProgress > 0.01 ? 0.04 : 0.55;
    fadedOpacityRef.current += (targetFadedOp - fadedOpacityRef.current) * 0.12;
    const fMat = fadedRef.current.material as THREE.LineBasicMaterial;
    fMat.opacity = fadedOpacityRef.current;
    (fadedGeom.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    fadedGeom.setDrawRange(0, fIdx / 3);
    fadedRef.current.visible = fIdx > 0;
  });

  return (
    <group>
      <lineSegments ref={activeRef} geometry={activeGeom} frustumCulled={false}>
        <lineBasicMaterial color="#2c2c2c" transparent opacity={0.55} depthWrite={false} />
      </lineSegments>
      <lineSegments ref={fadedRef} geometry={fadedGeom} frustumCulled={false}>
        <lineBasicMaterial color="#2c2c2c" transparent opacity={0.04} depthWrite={false} />
      </lineSegments>
    </group>
  );
}
