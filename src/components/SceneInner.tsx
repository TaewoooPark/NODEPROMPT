import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import gsap from 'gsap';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useGraphStore } from '../store/useGraphStore';
import { useMorphTransition } from '../hooks/useMorphTransition';
import { useInteriorTransition } from '../hooks/useInteriorTransition';
import { useGestureControl } from '../hooks/useGestureControl';
import { setThreeRefs } from '../utils/threeRef';
import type { SphereSurfaceHandle } from './SphereSurface';

interface SceneInnerProps {
  controlsRef: RefObject<OrbitControlsImpl | null>;
  sphereRef: RefObject<SphereSurfaceHandle | null>;
}

/**
 * Canvas 내부 로직:
 * - 더블클릭 Sphere ↔ Radial 전환
 * - 히스테리시스 Sphere ↔ Interior 전환
 * - 모드별 OrbitControls 설정 (P4-PATCH-4 가드 포함)
 */
export function SceneInner({ controlsRef, sphereRef }: SceneInnerProps) {
  const { camera, gl } = useThree();
  const { morphToRadial, morphToSphere } = useMorphTransition();

  // Canvas 외부(ContextMenu 등)에서 camera/gl 접근 가능하도록 등록
  useEffect(() => {
    setThreeRefs(camera, gl);
  }, [camera, gl]);

  // Sphere ↔ Interior 자동 전환
  useInteriorTransition();

  // Hand gesture → OrbitControls 구동
  useGestureControl(controlsRef);

  const mode = useGraphStore((s) => s.mode);
  const isTransitioning = useGraphStore((s) => s.isTransitioning);

  // morph 트리거 (더블클릭 + Space 키 공용)
  const triggerMorph = useCallback(() => {
    if (isTransitioning) return;
    const controls = controlsRef.current;
    const wireframeMat = sphereRef.current?.getMaterial() ?? null;
    const target = controls?.target ?? null;
    if (!target) return;
    if (controls) controls.enabled = false;

    if (mode === 'sphere') {
      morphToRadial(camera, target, wireframeMat);
    } else if (mode === 'radial') {
      morphToSphere(camera, target, wireframeMat);
    }
  }, [mode, isTransitioning, camera, morphToRadial, morphToSphere, controlsRef, sphereRef]);

  // 더블클릭: Canvas DOM 이벤트로 Sphere ↔ Radial 전환
  useEffect(() => {
    const canvas = gl.domElement;
    const handler = () => {
      if (!useGraphStore.getState().isTransitioning) triggerMorph();
    };
    canvas.addEventListener('dblclick', handler);
    return () => canvas.removeEventListener('dblclick', handler);
  }, [gl, triggerMorph]);

  // Space 키 이벤트 수신 (P6-PATCH-2)
  useEffect(() => {
    const handler = () => triggerMorph();
    window.addEventListener('nodeprompt:toggle-mode', handler);
    return () => window.removeEventListener('nodeprompt:toggle-mode', handler);
  }, [triggerMorph]);

  // Home: 카메라를 현재 모드의 기본 위치로 부드럽게 복귀
  useEffect(() => {
    const handler = () => {
      const currentMode = useGraphStore.getState().mode;
      if (useGraphStore.getState().isTransitioning) return;
      const controls = controlsRef.current;
      const target = controls?.target;
      if (!target) return;

      const homePos = currentMode === 'radial'
        ? { x: 0, y: 0, z: 10 }
        : { x: 0, y: 0, z: 8 };

      gsap.to(camera.position, {
        ...homePos,
        duration: 0.8,
        ease: 'power2.inOut',
      });
      gsap.to(target, {
        x: 0, y: 0, z: 0,
        duration: 0.8,
        ease: 'power2.inOut',
      });
    };
    window.addEventListener('nodeprompt:go-home', handler);
    return () => window.removeEventListener('nodeprompt:go-home', handler);
  }, [camera, controlsRef]);

  // 전환 종료 감지용 ref
  const wasTransitioningRef = useRef(false);

  // 매 프레임: OrbitControls 모드별 설정
  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const currentMode = useGraphStore.getState().mode;
    const transitioning = useGraphStore.getState().isTransitioning;

    if (transitioning) {
      controls.enabled = false;
      wasTransitioningRef.current = true;
      return;
    }

    controls.enabled = true;

    // 전환 직후: damping 없이 즉시 동기화 → 바운스 방지
    if (wasTransitioningRef.current) {
      wasTransitioningRef.current = false;
      controls.enableDamping = false;
      controls.update();
      controls.enableDamping = true;
    }

    switch (currentMode) {
      case 'sphere':
        controls.enableRotate = true;
        controls.enablePan = true;
        controls.enableZoom = true;
        controls.minDistance = 1.5;
        controls.rotateSpeed = 0.5;
        controls.panSpeed = 0.5;
        break;

      case 'radial':
        controls.enableRotate = false;
        controls.enablePan = true;
        controls.enableZoom = true;
        // P4-PATCH-4: Radial에서 구 내부 진입 차단
        controls.minDistance = 2;
        break;

      case 'interior':
        controls.enableRotate = true;
        controls.enablePan = true;
        controls.enableZoom = true;
        controls.minDistance = 0.1;
        controls.rotateSpeed = 0.3;
        break;
    }
  });

  return null;
}
