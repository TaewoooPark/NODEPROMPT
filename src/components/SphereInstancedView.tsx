import { useRef, useMemo, useCallback } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import type { NodeType, NodeData } from '../types';
import { useGraphStore } from '../store/useGraphStore';
import { spawnScaleMap } from '../hooks/useNodeSpawnAnimation';
import { getPatternTexture, ALL_NODE_TYPES } from '../utils/nodePatterns';
import { getHighlightState } from '../utils/highlightState';

const tempObj = new THREE.Object3D();

/** 2D radial 모드의 스케일 배율 (카메라 거리·배치 반경 보상) */
const RADIAL_SCALE_FACTOR = 3;

/** 라벨 — useFrame에서 nodes Map으로부터 위치·크기를 실시간 갱신 (전환 중 동기화) */
function LiveLabel({ nodeId, label, fontSize }: { nodeId: string; label: string; fontSize: number }) {
  const groupRef = useRef<THREE.Group>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const textRef = useRef<any>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    const state = useGraphStore.getState();
    const node = state.nodes.get(nodeId);
    if (!node) return;

    const { transitionTarget, transitionProgress } = state;
    let scaleMul = 1;
    if (transitionTarget === 'radial') {
      scaleMul = 1 + (RADIAL_SCALE_FACTOR - 1) * transitionProgress;
    } else if (transitionTarget === 'sphere') {
      scaleMul = RADIAL_SCALE_FACTOR - (RADIAL_SCALE_FACTOR - 1) * transitionProgress;
    }

    const baseScale = 0.015 + node.weight * 0.065;
    const spawnScale = spawnScaleMap.get(nodeId) ?? 1;
    const currentScale = baseScale * spawnScale * scaleMul;
    const offset = currentScale + 0.04;

    groupRef.current.position.set(node.position.x, node.position.y + offset, node.position.z);

    // 폰트 크기도 전환에 맞춰 보간 (sphere 0.07 → radial 0.21)
    if (textRef.current) {
      textRef.current.fontSize = fontSize * scaleMul;
    }

    // 하이라이트: 포커스 시 연결되지 않은 라벨 숨김 (fade 전환)
    const { connected, fadeProgress } = getHighlightState();
    if (connected && fadeProgress > 0.5) {
      groupRef.current.visible = connected.has(nodeId);
    } else {
      groupRef.current.visible = true;
    }
  });

  return (
    <group ref={groupRef}>
      <Billboard>
        <Text ref={textRef} fontSize={fontSize} color="#1a1a1a" anchorX="center" anchorY="bottom">
          {label}
        </Text>
      </Billboard>
    </group>
  );
}

/**
 * Sphere 모드 InstancedMesh 렌더링 — 타입별 패턴 텍스처.
 * 6개 NodeType 각각에 대해 별도 InstancedMesh를 생성하여 고유 패턴 적용.
 */
export function SphereInstancedView() {
  const meshRefsMap = useRef(new Map<NodeType, THREE.InstancedMesh | null>());

  const nodeArray = useGraphStore((s) => s.nodeArray);
  const setSelectedId = useGraphStore((s) => s.setSelectedNodeId);
  const setHoveredId = useGraphStore((s) => s.setHoveredNodeId);
  const selectedId = useGraphStore((s) => s.selectedNodeId);
  const hoveredId = useGraphStore((s) => s.hoveredNodeId);
  const labelFontSize = useGraphStore((s) => s.labelFontSize);
  const showLabels = useGraphStore((s) => s.showLabels);

  const visibleNodes = useMemo(
    () => nodeArray.filter((n) => !n.isDeleted),
    [nodeArray],
  );

  // 타입별 노드 그룹
  const typeGroups = useMemo(() => {
    const groups = new Map<NodeType, NodeData[]>();
    for (const type of ALL_NODE_TYPES) groups.set(type, []);
    for (const node of visibleNodes) groups.get(node.type)!.push(node);
    return groups;
  }, [visibleNodes]);

  // 패턴 텍스처 (타입당 1개, 캐시됨)
  const textures = useMemo(() => {
    const map = new Map<NodeType, THREE.CanvasTexture>();
    for (const type of ALL_NODE_TYPES) map.set(type, getPatternTexture(type));
    return map;
  }, []);

  // 매 프레임: 모든 타입 그룹의 위치/크기 업데이트
  useFrame(() => {
    const state = useGraphStore.getState();
    const currentNodes = state.nodes;
    const { transitionTarget, transitionProgress } = state;

    let scaleMul = 1;
    if (transitionTarget === 'radial') {
      scaleMul = 1 + (RADIAL_SCALE_FACTOR - 1) * transitionProgress;
    } else if (transitionTarget === 'sphere') {
      scaleMul = RADIAL_SCALE_FACTOR - (RADIAL_SCALE_FACTOR - 1) * transitionProgress;
    }

    for (const [type, nodesOfType] of typeGroups) {
      const mesh = meshRefsMap.current.get(type);
      if (!mesh || nodesOfType.length === 0) continue;

      const { connected, fadeProgress } = getHighlightState();

      nodesOfType.forEach((node, i) => {
        const live = currentNodes.get(node.id);
        const pos = live?.position ?? node.position;
        const weight = live?.weight ?? node.weight;
        const baseScale = 0.015 + weight * 0.065;
        const isHovered = node.id === hoveredId;
        const isSelected = node.id === selectedId;
        const spawnScale = spawnScaleMap.get(node.id) ?? 1;
        const normalScale = (isHovered || isSelected ? baseScale * 1.3 : baseScale) * spawnScale * scaleMul;

        // 하이라이트: fadeProgress로 부드러운 전환
        let scale = normalScale;
        if (connected && fadeProgress > 0.01) {
          const isConn = connected.has(node.id);
          const targetScale = isConn ? normalScale * 1.15 : normalScale * 0.2;
          scale = normalScale + (targetScale - normalScale) * fadeProgress;
        }

        tempObj.position.set(pos.x, pos.y, pos.z);
        tempObj.scale.setScalar(scale);
        tempObj.updateMatrix();
        mesh.setMatrixAt(i, tempObj.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  const labelNodes = showLabels ? visibleNodes : [];

  const handlePointerOut = useCallback(() => {
    setHoveredId(null);
    document.body.style.cursor = 'auto';
  }, [setHoveredId]);

  if (visibleNodes.length === 0) return null;

  return (
    <group>
      {ALL_NODE_TYPES.map((type) => {
        const nodesOfType = typeGroups.get(type)!;
        if (nodesOfType.length === 0) return null;
        return (
          <instancedMesh
            key={`${type}-${nodesOfType.length}`}
            ref={(mesh: THREE.InstancedMesh | null) => {
              if (mesh) meshRefsMap.current.set(type, mesh);
              else meshRefsMap.current.delete(type);
            }}
            args={[undefined, undefined, nodesOfType.length]}
            frustumCulled={false}
            onClick={(e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation();
              if (e.instanceId != null && e.instanceId < nodesOfType.length) {
                const clickedId = nodesOfType[e.instanceId]!.id;
                // 재클릭 시 포커싱 해제
                const currentSelected = useGraphStore.getState().selectedNodeId;
                setSelectedId(currentSelected === clickedId ? null : clickedId);
              }
            }}
            onPointerOver={(e: ThreeEvent<PointerEvent>) => {
              e.stopPropagation();
              if (e.instanceId != null && e.instanceId < nodesOfType.length) {
                setHoveredId(nodesOfType[e.instanceId]!.id);
                document.body.style.cursor = 'pointer';
              }
            }}
            onPointerOut={handlePointerOut}
          >
            <sphereGeometry args={[1, 16, 16]} />
            <meshStandardMaterial map={textures.get(type)!} transparent opacity={0.9} />
          </instancedMesh>
        );
      })}

      {labelNodes.map((node) => (
        <LiveLabel key={node.id} nodeId={node.id} label={node.label} fontSize={labelFontSize} />
      ))}
    </group>
  );
}
