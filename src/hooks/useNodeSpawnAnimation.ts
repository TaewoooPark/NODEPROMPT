import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGraphStore } from '../store/useGraphStore';

/**
 * 노드 등장 시 스케일 0→1 스태거 애니메이션.
 * useFrame 기반 — setState 호출 0회, GC 부담 0.
 * SphereInstancedView의 useFrame에서 spawnScale을 읽어 적용.
 */

/** 노드별 스폰 스케일 (0~1). 전역 Map으로 공유. */
export const spawnScaleMap = new Map<string, number>();

export function useNodeSpawnAnimation() {
  const nodeArray = useGraphStore((s) => s.nodeArray);
  const prevCountRef = useRef(0);
  const spawnStartRef = useRef(0);
  const spawnIdsRef = useRef<string[]>([]);

  // 새 노드 감지
  const count = nodeArray.length;
  if (count > 0 && prevCountRef.current === 0 && spawnStartRef.current === 0) {
    spawnStartRef.current = performance.now();
    spawnIdsRef.current = nodeArray.map((n) => n.id);
    // 초기 스케일 0
    for (const id of spawnIdsRef.current) {
      spawnScaleMap.set(id, 0);
    }
  }
  prevCountRef.current = count;

  // 매 프레임: 스케일 보간 (back-out ease)
  useFrame(() => {
    if (spawnStartRef.current === 0) return;

    const elapsed = (performance.now() - spawnStartRef.current) / 1000;
    const ids = spawnIdsRef.current;
    let allDone = true;

    for (let i = 0; i < ids.length; i++) {
      const nodeElapsed = elapsed - i * 0.04; // 스태거 딜레이
      if (nodeElapsed < 0) {
        spawnScaleMap.set(ids[i]!, 0);
        allDone = false;
        continue;
      }
      const t = Math.min(1, nodeElapsed / 0.5); // 0.5초 동안 0→1
      // back-out ease: overshoots then settles
      const c1 = 1.70158;
      const scale = 1 + (c1 + 1) * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
      spawnScaleMap.set(ids[i]!, Math.max(0, scale));
      if (t < 1) allDone = false;
    }

    if (allDone) {
      // 애니메이션 완료 — cleanup
      spawnStartRef.current = 0;
      spawnIdsRef.current = [];
      spawnScaleMap.clear();
    }
  });
}
