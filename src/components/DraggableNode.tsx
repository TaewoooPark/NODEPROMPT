import { useRef, useState, useCallback, useMemo, useEffect, memo } from 'react';
import { useThree, useFrame, type ThreeEvent } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import type { NodeData } from '../types';
import { useGraphStore } from '../store/useGraphStore';
import { getPatternTexture } from '../utils/nodePatterns';
import { useHistoryStore } from '../store/useHistoryStore';
import { radialToSpherical } from '../utils/coordinates';
import { radialPhysicsApi } from '../hooks/useRadialPhysics';
import { getHighlightState, invalidateHighlightCache } from '../utils/highlightState';

const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const intersection = new THREE.Vector3();

const MAX_DEPTH = 4;

interface DraggableNodeProps {
  node: NodeData;
}

/**
 * Radial 모드 전용 드래그 가능 노드.
 * P3-PATCH-1: 드래그 중 ref 기반 로컬 업데이트, pointerUp 시 스토어 커밋.
 */
export const DraggableNode = memo(function DraggableNode({ node }: DraggableNodeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera, gl } = useThree();
  const raycasterRef = useRef(new THREE.Raycaster());

  const [hovered, setHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showWeight, setShowWeight] = useState(false);
  const weightTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const isDraggingRef = useRef(false);
  const cleanupDragRef = useRef<(() => void) | null>(null);

  const dragStartPos = useRef({ x: 0, y: 0, z: 0 });

  // 언마운트 시 드래그 리스너 해제 (메모리 누수 방지)
  useEffect(() => {
    return () => { cleanupDragRef.current?.(); };
  }, []);

  const setHoveredId = useGraphStore((s) => s.setHoveredNodeId);
  const setSelectedId = useGraphStore((s) => s.setSelectedNodeId);
  const updateNode = useGraphStore((s) => s.updateNode);
  const edgeCreation = useGraphStore((s) => s.edgeCreation);
  const startEdgeCreation = useGraphStore((s) => s.startEdgeCreation);
  const completeEdge = useGraphStore((s) => s.completeEdge);
  const pushAction = useHistoryStore((s) => s.pushAction);
  const labelFontSize = useGraphStore((s) => s.labelFontSize);
  const showLabels = useGraphStore((s) => s.showLabels);

  const patternTexture = useMemo(() => getPatternTexture(node.type), [node.type]);
  // 2D radial: 3D 대비 카메라 거리(10 vs 8)와 배치 반경(6 vs 3)을 보상하여 동일 비율 유지
  const baseScale = (0.015 + node.weight * 0.065) * 3;
  const scale = hovered || isDragging ? baseScale * 1.3 : baseScale;

  const pos = useMemo<[number, number, number]>(
    () => [node.position.x, node.position.y, node.position.z],
    [node.position.x, node.position.y, node.position.z],
  );

  const labelGroupRef = useRef<THREE.Group>(null);
  const opacity = node.isDeleted ? 0.15 : 0.9;

  // 물리 시뮬레이션 위치 반영 + 하이라이트 fade (lerp)
  const currentOpacity = useRef(opacity);

  useFrame(() => {
    if (isDraggingRef.current || !groupRef.current) return;
    const live = useGraphStore.getState().nodes.get(node.id);
    if (!live) return;
    groupRef.current.position.set(live.position.x, live.position.y, live.position.z);

    // 하이라이트: fadeProgress로 부드러운 전환
    const { connected, fadeProgress } = getHighlightState();
    const mat = meshRef.current?.material as THREE.MeshStandardMaterial | undefined;

    let targetOpacity = opacity;
    let targetLabelVisible = true;

    if (connected && fadeProgress > 0.01) {
      const isConn = connected.has(node.id);
      const fadedOpacity = isConn ? opacity : 0.06;
      // lerp between normal and faded based on fadeProgress
      targetOpacity = opacity + (fadedOpacity - opacity) * fadeProgress;
      targetLabelVisible = isConn || fadeProgress < 0.5;
    }

    // smooth lerp for opacity
    currentOpacity.current += (targetOpacity - currentOpacity.current) * 0.12;
    if (mat) mat.opacity = currentOpacity.current;
    if (labelGroupRef.current) labelGroupRef.current.visible = targetLabelVisible;
  });

  // --- DOM 포인터 → z=0 평면 교차 ---
  const pointerToPlane = useCallback((ev: PointerEvent) => {
    const rect = gl.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((ev.clientX - rect.left) / rect.width) * 2 - 1,
      -((ev.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycasterRef.current.setFromCamera(ndc, camera);
    raycasterRef.current.ray.intersectPlane(dragPlane, intersection);
    return intersection;
  }, [camera, gl]);

  // --- 드래그 (DOM 이벤트 기반 — 작은 메시에서 포인터 이탈해도 추적 유지) ---
  const handlePointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();

      // Shift+클릭: 엣지 생성
      if (e.nativeEvent.shiftKey) {
        if (edgeCreation.isCreatingEdge) {
          completeEdge(node.id);
          invalidateHighlightCache();
        } else {
          startEdgeCreation(node.id);
        }
        return;
      }

      // 엣지 생성 중이면 타겟 노드로 완성
      if (edgeCreation.isCreatingEdge) {
        completeEdge(node.id);
        invalidateHighlightCache();
        return;
      }

      isDraggingRef.current = true;
      setIsDragging(true);
      dragStartPos.current = { ...node.position };

      // 재클릭 시 포커싱 해제
      const currentSelected = useGraphStore.getState().selectedNodeId;
      if (currentSelected === node.id) {
        setSelectedId(null);
      } else {
        setSelectedId(node.id);
      }
      document.body.style.cursor = 'grabbing';
      radialPhysicsApi.pinNode(node.id);

      // DOM 레벨 pointermove/pointerup — 메시 밖에서도 드래그 추적
      // 관성 계산용 이전 위치/시간 추적
      let prevHit = { x: node.position.x, y: node.position.y };
      let prevTime = performance.now();

      const onMove = (ev: PointerEvent) => {
        if (!isDraggingRef.current) return;
        const hit = pointerToPlane(ev);
        if (groupRef.current) {
          groupRef.current.position.set(hit.x, hit.y, 0);
        }
        // 관성 추적
        prevHit = { x: hit.x, y: hit.y };
        prevTime = performance.now();

        // 물리 + Store 동시 반영 (throttle 제거 — 노드-엣지 동기화)
        radialPhysicsApi.moveNode(node.id, hit.x, hit.y);
        const ns = new Map(useGraphStore.getState().nodes);
        const prev = ns.get(node.id);
        if (prev) {
          ns.set(node.id, { ...prev, position: { x: hit.x, y: hit.y, z: 0 } });
          useGraphStore.setState({ nodes: ns });
        }
      };

      const cleanup = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        cleanupDragRef.current = null;
      };
      cleanupDragRef.current = cleanup;

      const onUp = (_ev: PointerEvent) => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;
        setIsDragging(false);
        document.body.style.cursor = 'pointer';
        cleanup();

        const g = groupRef.current;
        if (!g) return;

        const x = g.position.x;
        const y = g.position.y;

        // 관성(velocity) 계산 → 물리에 전달
        const vx = (x - prevHit.x) * 0.5;
        const vy = (y - prevHit.y) * 0.5;
        radialPhysicsApi.releaseNode(node.id, vx, vy);

        const angle = Math.atan2(y, x);
        const depth = Math.sqrt(x * x + y * y);
        const sc = radialToSpherical(angle, depth, MAX_DEPTH);

        pushAction({
          type: 'updateNode',
          targetId: node.id,
          before: {
            position: { ...dragStartPos.current },
            radialCoord: { ...node.radialCoord },
            sphereCoord: { ...node.sphereCoord },
          },
          after: {
            position: { x, y, z: 0 },
            radialCoord: { angle, depth },
            sphereCoord: sc,
          },
        });

        updateNode(node.id, {
          position: { x, y, z: 0 },
          radialCoord: { angle, depth },
          sphereCoord: sc,
        });
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [node.id, node.position, node.radialCoord, node.sphereCoord, edgeCreation.isCreatingEdge, setSelectedId, startEdgeCreation, completeEdge, pointerToPlane, updateNode, pushAction],
  );

  // --- 가중치 휠 ---
  const handleWheel = useCallback(
    (e: ThreeEvent<WheelEvent>) => {
      e.stopPropagation();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      const oldWeight = node.weight;
      const newWeight = Math.max(0.05, Math.min(1, oldWeight + delta));
      if (newWeight === oldWeight) return;

      pushAction({
        type: 'updateNode',
        targetId: node.id,
        before: { weight: oldWeight },
        after: { weight: newWeight },
      });
      updateNode(node.id, { weight: newWeight });

      setShowWeight(true);
      clearTimeout(weightTimerRef.current);
      weightTimerRef.current = setTimeout(() => setShowWeight(false), 600);
    },
    [node.id, node.weight, updateNode, pushAction],
  );

  // --- 호버 ---
  const handlePointerOver = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      setHovered(true);
      setHoveredId(node.id);
      if (!isDragging) document.body.style.cursor = 'pointer';
    },
    [node.id, isDragging, setHoveredId],
  );

  const handlePointerOut = useCallback(() => {
    setHovered(false);
    setHoveredId(null);
    if (!isDragging) document.body.style.cursor = 'auto';
  }, [isDragging, setHoveredId]);

  // Radial 모드 라벨: 카메라 거리가 멀어 3배 크게
  const radialFontSize = labelFontSize * 3;

  return (
    <group ref={groupRef} position={pos}>
      {/* 투명 히트 영역 — 시각 메시보다 2.5배 넓어 드래그/클릭 용이 */}
      <mesh
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onPointerDown={handlePointerDown}
        onWheel={handleWheel}
        scale={scale * 2.5}
      >
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* 시각 메시 */}
      <mesh
        ref={meshRef}
        scale={scale}
      >
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial
          map={patternTexture}
          transparent
          opacity={opacity}
        />
      </mesh>

      {/* 라벨 */}
      {showLabels && (
        <Billboard ref={labelGroupRef} position={[0, scale + 0.08, 0]}>
          <Text
            fontSize={radialFontSize}
            color="#1a1a1a"
            anchorX="center"
            anchorY="bottom"
          >
            {node.label}
          </Text>
        </Billboard>
      )}

      {/* 가중치 표시 (휠 조절 시) */}
      {showWeight && (
        <Billboard position={[scale + 0.15, 0, 0]}>
          <Text
            fontSize={radialFontSize * 0.85}
            color="#1a1a1a"
            anchorX="left"
            anchorY="middle"
          >
            {node.weight.toFixed(2)}
          </Text>
        </Billboard>
      )}
    </group>
  );
});
