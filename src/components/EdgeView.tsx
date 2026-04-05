import { useMemo } from 'react';
import { useGraphStore } from '../store/useGraphStore';
import { EdgeLine } from './EdgeLine';

export function EdgeView() {
  const edges = useGraphStore((s) => s.edges);
  const isTransitioning = useGraphStore((s) => s.isTransitioning);

  const visibleEdges = useMemo(
    () => Array.from(edges.values()).filter((e) => !e.isDeleted),
    [edges],
  );

  // 전환 중에는 EdgeLine 컴포넌트 언마운트 — nodes 구독으로 인한 re-render 폭주 방지
  if (isTransitioning) return null;

  return (
    <group>
      {visibleEdges.map((edge, i) => (
        <EdgeLine key={edge.id} edge={edge} index={i} />
      ))}
    </group>
  );
}
