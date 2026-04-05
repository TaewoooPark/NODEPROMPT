import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { gestureState } from '../gesture/gestureEngine';
import { useGraphStore } from '../store/useGraphStore';

const SPHERE_RADIUS = 3;
const INFERENCE_DT = 67;

// 임시 벡터 (GC 방지)
const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _center = new THREE.Vector3(0, 0, 0);
const _L = new THREE.Vector3();
const _hit = new THREE.Vector3();

function raySphereHit(ray: THREE.Ray, out: THREE.Vector3): boolean {
  _L.copy(ray.origin).sub(_center);
  const a = ray.direction.dot(ray.direction);
  const b = 2 * ray.direction.dot(_L);
  const c = _L.dot(_L) - SPHERE_RADIUS * SPHERE_RADIUS;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return false;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  if (t < 0) return false;
  out.copy(ray.origin).addScaledVector(ray.direction, t);
  return true;
}

/**
 * 검지 끝 위치를 구 표면에 투영하는 3D 커서.
 * Lombardi 미학: 검은 고리, 반투명, 최소한.
 */
export function HandCursor() {
  const { camera } = useThree();
  const ringRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(() => {
    const ring = ringRef.current;
    const mat = matRef.current;
    if (!ring || !mat) return;

    const gestureEnabled = useGraphStore.getState().gestureEnabled;
    if (
      !gestureEnabled ||
      !gestureState.active ||
      !gestureState.handDetected
    ) {
      mat.opacity = 0;
      return;
    }

    // 프레임 보간
    const now = performance.now();
    const t = Math.min((now - gestureState.lastUpdateMs) / INFERENCE_DT, 1);
    const ndcX = THREE.MathUtils.lerp(gestureState.prevIndexTipNdcX, gestureState.indexTipNdcX, t);
    const ndcY = THREE.MathUtils.lerp(gestureState.prevIndexTipNdcY, gestureState.indexTipNdcY, t);

    _ndc.set(ndcX, ndcY);
    _ray.setFromCamera(_ndc, camera);

    const onSphere = raySphereHit(_ray.ray, _hit);

    if (onSphere) {
      ring.position.copy(_hit);
      // 고리가 구 표면에 눕도록: 법선 방향 바라보기
      ring.lookAt(_center);

      // Open_Palm이면 진하게 (터치 중 피드백)
      const isOpen = gestureState.gestureName === 'Open_Palm';
      ring.scale.setScalar(isOpen ? 1 : 0.7);
      mat.opacity = isOpen ? 0.4 : 0.15;
    } else {
      mat.opacity = 0;
    }
  });

  return (
    <mesh ref={ringRef}>
      <ringGeometry args={[0.08, 0.13, 32]} />
      <meshBasicMaterial
        ref={matRef}
        color="#000"
        transparent
        opacity={0}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}
