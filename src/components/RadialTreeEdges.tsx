import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { useGraphStore } from '../store/useGraphStore';

/**
 * Radial 모드에서 D3 트리 구조의 부모-자식 연결선 (Lombardi 스타일).
 * nodes Map 직접 구독 대신 nodeArray에서 위치 스냅샷 → treeEdges 변경 시에만 재계산.
 */
export function RadialTreeEdges() {
  const treeEdges = useGraphStore((s) => s.treeEdges);
  const nodeArray = useGraphStore((s) => s.nodeArray);
  const mode = useGraphStore((s) => s.mode);
  const isTransitioning = useGraphStore((s) => s.isTransitioning);

  // 위치 룩업을 nodeArray에서 구축 — treeEdges/nodeArray 변경 시에만
  const lines = useMemo(() => {
    if (mode !== 'radial' || isTransitioning || treeEdges.length === 0) return [];

    const posMap = new Map<string, { x: number; y: number }>();
    for (const n of nodeArray) {
      posMap.set(n.id, { x: n.position.x, y: n.position.y });
    }

    return treeEdges
      .map((te, i) => {
        const fp = posMap.get(te.from);
        const tp = posMap.get(te.to);
        if (!fp || !tp) return null;

        const dx = tp.x - fp.x;
        const dy = tp.y - fp.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.001) return null;

        const curveFactor = Math.max(0.2, Math.min(0.8, 1.5 / (dist + 0.5)));
        const sweepSign = i % 2 === 0 ? 1 : -1;
        const nx = -dy / dist;
        const ny = dx / dist;
        const offset = dist * curveFactor * 0.25 * sweepSign;

        const ctrl = new THREE.Vector3(
          (fp.x + tp.x) / 2 + nx * offset,
          (fp.y + tp.y) / 2 + ny * offset,
          0,
        );
        const curve = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(fp.x, fp.y, 0),
          ctrl,
          new THREE.Vector3(tp.x, tp.y, 0),
        );
        return curve.getPoints(20);
      })
      .filter(Boolean) as THREE.Vector3[][];
  }, [treeEdges, nodeArray, mode, isTransitioning]);

  if (lines.length === 0) return null;

  return (
    <group>
      {lines.map((points, i) => (
        <Line
          key={i}
          points={points}
          color="#000000"
          lineWidth={0.5 + (i % 3) * 0.1}
          transparent
          opacity={0.3}
        />
      ))}
    </group>
  );
}
