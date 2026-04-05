import { useRef, useState, useCallback, useMemo } from 'react';

import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { NodeData } from '../types';
import { useGraphStore } from '../store/useGraphStore';
import { getPatternTexture } from '../utils/nodePatterns';

interface NodeMeshProps {
  node: NodeData;
}

export function NodeMesh({ node }: NodeMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const setHoveredId = useGraphStore((s) => s.setHoveredNodeId);
  const setSelectedId = useGraphStore((s) => s.setSelectedNodeId);
  const selectedId = useGraphStore((s) => s.selectedNodeId);

  const isSelected = selectedId === node.id;
  const patternTexture = useMemo(() => getPatternTexture(node.type), [node.type]);
  const baseScale = 0.07 + node.weight * 0.43;
  const scale = hovered ? baseScale * 1.2 : baseScale;

  const pos = useMemo<[number, number, number]>(
    () => [node.position.x, node.position.y, node.position.z],
    [node.position.x, node.position.y, node.position.z],
  );

  const handlePointerOver = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      setHovered(true);
      setHoveredId(node.id);
      document.body.style.cursor = 'pointer';
    },
    [node.id, setHoveredId],
  );

  const handlePointerOut = useCallback(() => {
    setHovered(false);
    setHoveredId(null);
    document.body.style.cursor = 'auto';
  }, [setHoveredId]);

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      setSelectedId(node.id);
    },
    [node.id, setSelectedId],
  );

  return (
    <group position={pos}>
      <mesh
        ref={meshRef}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
        scale={scale}
      >
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial
          map={patternTexture}
          transparent
          opacity={0.85}
        />
      </mesh>

      {(hovered || isSelected) && (
        <Text
          position={[0, scale + 0.15, 0]}
          fontSize={0.12}
          color="#e0e0e0"
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.005}
          outlineColor="#000000"
        >
          {node.label}
        </Text>
      )}
    </group>
  );
}
