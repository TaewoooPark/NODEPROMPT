import { useRef, forwardRef, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGraphStore } from '../store/useGraphStore';

export interface SphereSurfaceHandle {
  getMaterial: () => THREE.MeshBasicMaterial | null;
}

/**
 * 구 와이어프레임.
 * visible 토글 대신 opacity로 부드럽게 전환.
 * sphere 모드: 0.15, radial/전환 중: 0, interior: backside 0.08
 */
export const SphereSurface = forwardRef<SphereSurfaceHandle>(
  function SphereSurface(_props, ref) {
    const radius = useGraphStore((s) => s.sphereRadius);
    const outerMatRef = useRef<THREE.MeshBasicMaterial>(null);
    const innerMatRef = useRef<THREE.MeshBasicMaterial>(null);

    useImperativeHandle(ref, () => ({
      getMaterial: () => outerMatRef.current,
    }));

    // 부드러운 opacity 전환 (lerp)
    useFrame(() => {
      const mode = useGraphStore.getState().mode;
      const transitioning = useGraphStore.getState().isTransitioning;

      if (outerMatRef.current) {
        const targetOpacity = (!transitioning && mode === 'sphere') ? 0.15 : 0;
        let o = outerMatRef.current.opacity + (targetOpacity - outerMatRef.current.opacity) * 0.08;
        if (o < 0.002) o = 0;
        outerMatRef.current.opacity = o;
      }
      if (innerMatRef.current) {
        const targetOpacity = (!transitioning && mode === 'interior') ? 0.08 : 0;
        let o = innerMatRef.current.opacity + (targetOpacity - innerMatRef.current.opacity) * 0.08;
        if (o < 0.002) o = 0;
        innerMatRef.current.opacity = o;
      }
    });

    return (
      <group>
        <mesh>
          <sphereGeometry args={[radius, 64, 64]} />
          <meshBasicMaterial
            ref={outerMatRef}
            wireframe
            color="#888888"
            transparent
            opacity={0}
            depthWrite={false}
            side={THREE.FrontSide}
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[radius, 64, 64]} />
          <meshBasicMaterial
            ref={innerMatRef}
            wireframe
            color="#888888"
            transparent
            opacity={0}
            depthWrite={false}
            side={THREE.BackSide}
          />
        </mesh>
      </group>
    );
  },
);
