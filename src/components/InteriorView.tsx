import { useRef, useMemo, useCallback } from 'react';
import { useThree, useFrame, type ThreeEvent } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import type { NodeType, NodeData, Vec3 } from '../types';
import { useGraphStore } from '../store/useGraphStore';
import { hyperbolicScale } from '../utils/hyperbolicScale';
import { spawnScaleMap } from '../hooks/useNodeSpawnAnimation';
import { getPatternTexture, ALL_NODE_TYPES } from '../utils/nodePatterns';
import { getHighlightState } from '../utils/highlightState';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

const SPHERE_RADIUS = 3;
const tempObj = new THREE.Object3D();

interface InteriorViewProps {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}

/**
 * Interior 모드 라벨 — 매 프레임 nodes Map에서 위치/스케일을 읽어
 * 노드 실제 크기 위에 배치. Sphere 모드와 동일한 hover/highlight 반응.
 */
function InteriorLiveLabel({
  nodeId,
  label,
  fontSize,
  sphereRadius,
}: {
  nodeId: string;
  label: string;
  fontSize: number;
  sphereRadius: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const textRef = useRef<any>(null);
  const { camera } = useThree();

  useFrame(() => {
    if (!groupRef.current) return;
    const state = useGraphStore.getState();
    const node = state.nodes.get(nodeId);
    if (!node) return;

    const pos = node.position;
    const camPos: Vec3 = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
    const hScale = hyperbolicScale(pos, camPos, sphereRadius);
    const tempered = 0.55 + 0.45 * hScale;
    const baseScale = 0.015 + node.weight * 0.065;
    const spawnScale = spawnScaleMap.get(nodeId) ?? 1;
    const currentScale = baseScale * tempered * spawnScale;
    const offset = currentScale + 0.04;

    groupRef.current.position.set(pos.x, pos.y + offset, pos.z);

    if (textRef.current) {
      textRef.current.fontSize = fontSize * tempered;
    }

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
 * Interior 모드 전용 렌더링 — 타입별 패턴 텍스처.
 * Sphere 모드와 동일한 hover/click/highlight 반응을 유지하면서
 * hyperbolic fish-eye 보정만 추가 적용.
 */
export function InteriorView({ controlsRef }: InteriorViewProps) {
  const meshRefsMap = useRef(new Map<NodeType, THREE.InstancedMesh | null>());
  const { camera } = useThree();

  const nodeArray = useGraphStore((s) => s.nodeArray);
  const nodes = useGraphStore((s) => s.nodes);
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

  const typeGroups = useMemo(() => {
    const groups = new Map<NodeType, NodeData[]>();
    for (const type of ALL_NODE_TYPES) groups.set(type, []);
    for (const node of visibleNodes) groups.get(node.type)!.push(node);
    return groups;
  }, [visibleNodes]);

  const textures = useMemo(() => {
    const map = new Map<NodeType, THREE.CanvasTexture>();
    for (const type of ALL_NODE_TYPES) map.set(type, getPatternTexture(type));
    return map;
  }, []);

  // 매 프레임: hyperbolic + weight + hover/select + highlight 통합 스케일
  useFrame(() => {
    const state = useGraphStore.getState();
    const currentNodes = state.nodes;
    const camPos: Vec3 = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
    const { connected, fadeProgress } = getHighlightState();

    for (const [type, nodesOfType] of typeGroups) {
      const mesh = meshRefsMap.current.get(type);
      if (!mesh || nodesOfType.length === 0) continue;

      nodesOfType.forEach((node, i) => {
        const live = currentNodes.get(node.id);
        const pos = live?.position ?? node.position;
        const weight = live?.weight ?? node.weight;
        const hScale = hyperbolicScale(pos, camPos, SPHERE_RADIUS);
        // hyperbolic 영향을 완화 (0.55~1.0) → weight 차이가 지배적으로 남게
        const tempered = 0.55 + 0.45 * hScale;
        const baseScale = 0.015 + weight * 0.065;
        const isHovered = node.id === hoveredId;
        const isSelected = node.id === selectedId;
        const spawnScale = spawnScaleMap.get(node.id) ?? 1;
        const normalScale =
          (isHovered || isSelected ? baseScale * 1.3 : baseScale) * tempered * spawnScale;

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

  // 클릭: 선택 토글 (재클릭 시 해제)
  const makeClickHandler = useCallback(
    (nodesOfType: NodeData[]) => (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (e.instanceId == null || e.instanceId >= nodesOfType.length) return;
      const clickedId = nodesOfType[e.instanceId]!.id;
      const currentSelected = useGraphStore.getState().selectedNodeId;
      setSelectedId(currentSelected === clickedId ? null : clickedId);
    },
    [setSelectedId],
  );

  // 우클릭: 카메라를 노드 방향으로 이동 + 선택
  const makeContextMenuHandler = useCallback(
    (nodesOfType: NodeData[]) => (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      e.nativeEvent.preventDefault();
      if (e.instanceId == null || e.instanceId >= nodesOfType.length) return;

      const node = nodesOfType[e.instanceId]!;
      const controls = controlsRef.current;

      gsap.to(camera.position, {
        x: node.position.x * 0.3,
        y: node.position.y * 0.3,
        z: node.position.z * 0.3,
        duration: 0.8,
        ease: 'power2.inOut',
      });

      if (controls) {
        gsap.to(controls.target, {
          x: node.position.x,
          y: node.position.y,
          z: node.position.z,
          duration: 0.8,
          ease: 'power2.inOut',
        });
      }

      setSelectedId(node.id);
    },
    [camera, controlsRef, setSelectedId],
  );

  const makePointerOverHandler = useCallback(
    (nodesOfType: NodeData[]) => (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      if (e.instanceId != null && e.instanceId < nodesOfType.length) {
        setHoveredId(nodesOfType[e.instanceId]!.id);
        document.body.style.cursor = 'pointer';
      }
    },
    [setHoveredId],
  );

  const handlePointerOut = useCallback(() => {
    setHoveredId(null);
    document.body.style.cursor = 'auto';
  }, [setHoveredId]);

  const selectedNode = selectedId ? nodes.get(selectedId) : null;
  const labelNodes = showLabels ? visibleNodes : [];

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
            onClick={makeClickHandler(nodesOfType)}
            onContextMenu={makeContextMenuHandler(nodesOfType)}
            onPointerOver={makePointerOverHandler(nodesOfType)}
            onPointerOut={handlePointerOut}
          >
            <sphereGeometry args={[1, 16, 16]} />
            <meshStandardMaterial map={textures.get(type)!} transparent opacity={0.9} />
          </instancedMesh>
        );
      })}

      {labelNodes.map((node) => (
        <InteriorLiveLabel
          key={node.id}
          nodeId={node.id}
          label={node.label}
          fontSize={labelFontSize}
          sphereRadius={SPHERE_RADIUS}
        />
      ))}

      {/* 선택된 노드 description 툴팁 */}
      {selectedNode && !selectedNode.isDeleted && (
        <Billboard position={[selectedNode.position.x, selectedNode.position.y - 0.2, selectedNode.position.z]}>
          <Text
            fontSize={labelFontSize * 0.85}
            color="#666666"
            anchorX="center"
            anchorY="top"
            maxWidth={2}
          >
            {selectedNode.description}
          </Text>
        </Billboard>
      )}
    </group>
  );
}
