import { memo, useMemo } from 'react';
import { useGraphStore } from '../store/useGraphStore';
import { SphereInstancedView } from './SphereInstancedView';
import { DraggableNode } from './DraggableNode';

/**
 * 모드별 노드 렌더링 분기.
 * 전환 중에는 항상 SphereInstancedView (nodes Map에서 실시간 위치 읽기 → 연속 애니메이션).
 */
export const SphereView = memo(function SphereView() {
  const nodeArray = useGraphStore((s) => s.nodeArray);
  const mode = useGraphStore((s) => s.mode);
  const isTransitioning = useGraphStore((s) => s.isTransitioning);

  const radialNodes = useMemo(
    () => (mode === 'radial' && !isTransitioning ? nodeArray.filter((n) => !n.isDeleted) : []),
    [nodeArray, mode, isTransitioning],
  );

  // 전환 중: SphereInstancedView가 Map에서 보간된 위치를 실시간 렌더
  if (isTransitioning) {
    return <SphereInstancedView />;
  }

  if (mode === 'radial') {
    return (
      <group>
        {radialNodes.map((node) => (
          <DraggableNode key={node.id} node={node} />
        ))}
      </group>
    );
  }

  if (mode === 'sphere') {
    return <SphereInstancedView />;
  }

  return null;
});
