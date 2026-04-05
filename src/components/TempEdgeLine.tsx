import { useRef } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import { useGraphStore } from '../store/useGraphStore';

const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const hitPoint = new THREE.Vector3();

/**
 * 엣지 생성 중 소스 노드에서 마우스까지 임시 점선 표시.
 */
export function TempEdgeLine() {
  const { camera, raycaster, pointer } = useThree();
  const endRef = useRef(new THREE.Vector3());
  const edgeCreation = useGraphStore((s) => s.edgeCreation);
  const nodes = useGraphStore((s) => s.nodes);

  useFrame(() => {
    if (!edgeCreation.isCreatingEdge) return;
    raycaster.setFromCamera(pointer, camera);
    raycaster.ray.intersectPlane(plane, hitPoint);
    endRef.current.copy(hitPoint);
  });

  if (!edgeCreation.isCreatingEdge || !edgeCreation.sourceNodeId) return null;

  const sourceNode = nodes.get(edgeCreation.sourceNodeId);
  if (!sourceNode) return null;

  const sp = sourceNode.position;

  return (
    <Line
      points={[
        new THREE.Vector3(sp.x, sp.y, sp.z),
        endRef.current,
      ]}
      color="#000000"
      lineWidth={0.5}
      transparent
      opacity={0.35}
      dashed
      dashSize={0.1}
      gapSize={0.05}
    />
  );
}
