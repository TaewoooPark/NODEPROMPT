import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import type { EdgeData } from '../types';
import { useGraphStore } from '../store/useGraphStore';
import { greatCircleArc } from '../utils/slerp';

interface EdgeLineProps {
  edge: EdgeData;
  index?: number;
}

export function EdgeLine({ edge, index = 0 }: EdgeLineProps) {
  const nodes = useGraphStore((s) => s.nodes);
  const mode = useGraphStore((s) => s.mode);
  const isTransitioning = useGraphStore((s) => s.isTransitioning);

  const source = nodes.get(edge.sourceId);
  const target = nodes.get(edge.targetId);

  const sx = source?.position.x ?? 0, sy = source?.position.y ?? 0, sz = source?.position.z ?? 0;
  const tx = target?.position.x ?? 0, ty = target?.position.y ?? 0, tz = target?.position.z ?? 0;

  const points = useMemo(() => {
    if (!source || !target || isTransitioning) return null;

    if (mode === 'sphere') {
      return greatCircleArc(source.position, target.position, 32, 0.05).map(
        (p) => new THREE.Vector3(p.x, p.y, p.z),
      );
    }

    if (mode === 'interior') {
      const midPoint = new THREE.Vector3(
        (sx + tx) / 2, (sy + ty) / 2, (sz + tz) / 2,
      ).multiplyScalar(0.85);
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(sx, sy, sz), midPoint, new THREE.Vector3(tx, ty, tz),
      ]);
      return curve.getPoints(20);
    }

    // Radial: Lombardi arc
    const dx = tx - sx, dy = ty - sy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const curveFactor = Math.max(0.3, Math.min(1.2, 2.5 / (dist + 0.5)));
    const sweepSign = index % 2 === 0 ? 1 : -1;
    const nx = -dy / (dist + 0.001), ny = dx / (dist + 0.001);
    const offset = dist * curveFactor * 0.35 * sweepSign;

    const ctrl = new THREE.Vector3((sx + tx) / 2 + nx * offset, (sy + ty) / 2 + ny * offset, 0);
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(sx, sy, 0), ctrl, new THREE.Vector3(tx, ty, 0),
    );
    return curve.getPoints(24);
  }, [source, target, sx, sy, sz, tx, ty, tz, mode, isTransitioning, index]);

  if (!points) return null;

  const baseWidth = 0.6 + (index % 5) * 0.1;
  const width = baseWidth + edge.strength * 0.4;

  return (
    <Line
      points={points}
      color="#2c2c2c"
      lineWidth={width}
      transparent
      opacity={0.55}
      depthWrite={false}
    />
  );
}
