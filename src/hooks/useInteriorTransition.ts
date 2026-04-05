import { useThree, useFrame } from '@react-three/fiber';
import { useGraphStore } from '../store/useGraphStore';

const SPHERE_RADIUS = 3;
const ENTER_THRESHOLD = SPHERE_RADIUS * 1.1; // 3.3
const EXIT_THRESHOLD = SPHERE_RADIUS * 1.3;  // 3.9

/**
 * 카메라 거리 기반 Sphere ↔ Interior 자동 전환.
 * 히스테리시스로 경계 플리커링 방지.
 * P4-PATCH-4: Radial/전환 중 완전 비활성.
 *
 * Ref: 03_FUNCTION_REFERENCES.md §6
 */
export function useInteriorTransition() {
  const { camera } = useThree();

  useFrame(() => {
    const { mode, isTransitioning, setMode } = useGraphStore.getState();

    // Radial 모드 + 전환 중: 비활성
    if (mode === 'radial' || isTransitioning) return;

    const distance = camera.position.length();

    if (mode === 'sphere' && distance < ENTER_THRESHOLD) {
      setMode('interior');
    } else if (mode === 'interior' && distance > EXIT_THRESHOLD) {
      setMode('sphere');
    }
  });
}
