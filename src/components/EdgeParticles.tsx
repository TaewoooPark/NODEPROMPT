import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { EdgeData, Vec3 } from '../types';
import { useGraphStore } from '../store/useGraphStore';
import { greatCircleArc } from '../utils/slerp';

function buildEdgeCurve(
  sp: Vec3, tp: Vec3, mode: string, index: number,
): THREE.Curve<THREE.Vector3> | null {
  if (mode === 'sphere') {
    const arcPts = greatCircleArc(sp, tp, 16, 0.05);
    if (arcPts.length < 2) return null;
    return new THREE.CatmullRomCurve3(
      arcPts.map((p) => new THREE.Vector3(p.x, p.y, p.z)),
    );
  }
  if (mode === 'interior') {
    const mid = new THREE.Vector3(
      (sp.x + tp.x) / 2, (sp.y + tp.y) / 2, (sp.z + tp.z) / 2,
    ).multiplyScalar(0.85);
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(sp.x, sp.y, sp.z), mid,
      new THREE.Vector3(tp.x, tp.y, tp.z),
    ]);
  }
  const dx = tp.x - sp.x, dy = tp.y - sp.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.001) return null;
  const curveFactor = Math.max(0.3, Math.min(1.2, 2.5 / (dist + 0.5)));
  const sweepSign = index % 2 === 0 ? 1 : -1;
  const nx = -dy / dist, ny = dx / dist;
  const offset = dist * curveFactor * 0.35 * sweepSign;
  const ctrl = new THREE.Vector3(
    (sp.x + tp.x) / 2 + nx * offset,
    (sp.y + tp.y) / 2 + ny * offset, 0,
  );
  return new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(sp.x, sp.y, 0), ctrl,
    new THREE.Vector3(tp.x, tp.y, 0),
  );
}

interface EdgeDotProps {
  edge: EdgeData;
  index: number;
}

function EdgeDot({ edge, index }: EdgeDotProps) {
  const dotRef = useRef<THREE.Mesh>(null);
  const progressRef = useRef(Math.random());

  const nodes = useGraphStore((s) => s.nodes);
  const mode = useGraphStore((s) => s.mode);
  const isTransitioning = useGraphStore((s) => s.isTransitioning);

  const source = nodes.get(edge.sourceId);
  const target = nodes.get(edge.targetId);

  const curve = useMemo(() => {
    if (!source || !target || isTransitioning) return null;
    return buildEdgeCurve(source.position, target.position, mode, index);
  }, [
    source?.position.x, source?.position.y, source?.position.z,
    target?.position.x, target?.position.y, target?.position.z,
    mode, isTransitioning, index,
  ]);

  useFrame((_, delta) => {
    if (!curve || !dotRef.current || isTransitioning) return;
    progressRef.current = (progressRef.current + delta * 0.2) % 1;
    const point = curve.getPoint(progressRef.current);
    dotRef.current.position.copy(point);
  });

  if (!curve || isTransitioning) return null;

  return (
    <mesh ref={dotRef}>
      <sphereGeometry args={[0.015, 6, 6]} />
      <meshBasicMaterial color="#000000" transparent opacity={0.6} />
    </mesh>
  );
}

export function AllEdgeParticles() {
  const edges = useGraphStore((s) => s.edges);
  const isTransitioning = useGraphStore((s) => s.isTransitioning);

  const visibleEdges = useMemo(
    () => Array.from(edges.values()).filter((e) => !e.isDeleted),
    [edges],
  );

  // 전환 중에는 EdgeDot 언마운트 — nodes 구독 re-render 폭주 방지
  if (isTransitioning) return null;

  return (
    <group>
      {visibleEdges.map((e, i) => (
        <EdgeDot key={e.id} edge={e} index={i} />
      ))}
    </group>
  );
}
