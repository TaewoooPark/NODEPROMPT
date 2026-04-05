import { useRef, useMemo, useCallback } from 'react';
import { useThree, useFrame, type ThreeEvent } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import type { NodeType, NodeData, Vec3 } from '../types';
import { useGraphStore } from '../store/useGraphStore';
import { hyperbolicScale } from '../utils/hyperbolicScale';
import { getPatternTexture, ALL_NODE_TYPES } from '../utils/nodePatterns';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

const SPHERE_RADIUS = 3;
const LABEL_DISTANCE_THRESHOLD = 4;
const tempObj = new THREE.Object3D();

interface InteriorViewProps {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}

/**
 * Interior 모드 전용 렌더링 — 타입별 패턴 텍스처.
 */
export function InteriorView({ controlsRef }: InteriorViewProps) {
  const meshRefsMap = useRef(new Map<NodeType, THREE.InstancedMesh | null>());
  const { camera } = useThree();

  const nodeArray = useGraphStore((s) => s.nodeArray);
  const nodes = useGraphStore((s) => s.nodes);
  const setSelectedId = useGraphStore((s) => s.setSelectedNodeId);
  const selectedId = useGraphStore((s) => s.selectedNodeId);
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

  // 패턴 텍스처
  const textures = useMemo(() => {
    const map = new Map<NodeType, THREE.CanvasTexture>();
    for (const type of ALL_NODE_TYPES) map.set(type, getPatternTexture(type));
    return map;
  }, []);

  // 매 프레임: 어안 렌즈 스케일 적용
  useFrame(() => {
    const currentNodes = useGraphStore.getState().nodes;
    const camPos: Vec3 = { x: camera.position.x, y: camera.position.y, z: camera.position.z };

    for (const [type, nodesOfType] of typeGroups) {
      const mesh = meshRefsMap.current.get(type);
      if (!mesh || nodesOfType.length === 0) continue;

      nodesOfType.forEach((node, i) => {
        const live = currentNodes.get(node.id);
        const pos = live?.position ?? node.position;
        const weight = live?.weight ?? node.weight;
        const scale = hyperbolicScale(pos, camPos, SPHERE_RADIUS);
        const baseScale = 0.015 + weight * 0.065;

        tempObj.position.set(pos.x, pos.y, pos.z);
        tempObj.scale.setScalar(baseScale * scale);
        tempObj.updateMatrix();
        mesh.setMatrixAt(i, tempObj.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  // 클릭: 노드 선택
  const makeClickHandler = useCallback(
    (nodesOfType: NodeData[]) => (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (e.instanceId != null && e.instanceId < nodesOfType.length) {
        setSelectedId(nodesOfType[e.instanceId]!.id);
      }
    },
    [setSelectedId],
  );

  // 우클릭: 카메라를 노드 방향으로 이동
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

  // LOD 라벨: 카메라에 가까운 노드만 표시
  const nearbyNodes = useMemo(() => {
    const camPos = camera.position;
    return visibleNodes
      .map((n) => ({
        node: n,
        dist: Math.sqrt(
          (n.position.x - camPos.x) ** 2 +
          (n.position.y - camPos.y) ** 2 +
          (n.position.z - camPos.z) ** 2,
        ),
      }))
      .filter((d) => d.dist < LABEL_DISTANCE_THRESHOLD)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 10);
  }, [visibleNodes, camera.position.x, camera.position.y, camera.position.z]);

  const selectedNode = selectedId ? nodes.get(selectedId) : null;

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
          >
            <sphereGeometry args={[1, 16, 16]} />
            <meshStandardMaterial map={textures.get(type)!} transparent opacity={0.9} />
          </instancedMesh>
        );
      })}

      {/* LOD 라벨 */}
      {showLabels && nearbyNodes.map(({ node }) => (
        <Billboard key={node.id} position={[node.position.x, node.position.y + 0.15, node.position.z]}>
          <Text
            fontSize={labelFontSize}
            color="#1a1a1a"
            anchorX="center"
            anchorY="bottom"
          >
            {node.label}
          </Text>
        </Billboard>
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
