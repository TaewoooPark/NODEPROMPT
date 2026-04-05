import { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { SphereSurface, type SphereSurfaceHandle } from './SphereSurface';
import { SphereView } from './SphereView';
import { InteriorView } from './InteriorView';
import { EdgeRenderer } from './EdgeRenderer';
import { TempEdgeLine } from './TempEdgeLine';
import { PostProcessing } from './PostProcessing';
import { HandCursor } from './HandCursor';
import { SceneInner } from './SceneInner';
import { useGraphStore } from '../store/useGraphStore';
import { useNodeSpawnAnimation } from '../hooks/useNodeSpawnAnimation';
import { useRadialPhysics } from '../hooks/useRadialPhysics';

export function Scene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 8], fov: 60 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
      style={{ width: '100vw', height: '100vh', background: '#ffffff' }}
      aria-label="NodePrompt 3D Visualization"
    >
      <SceneContent />
    </Canvas>
  );
}

function SceneContent() {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const sphereRef = useRef<SphereSurfaceHandle>(null);
  const mode = useGraphStore((s) => s.mode);

  useNodeSpawnAnimation();
  useRadialPhysics();

  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[10, 10, 5]} intensity={0.3} />

      <SphereSurface ref={sphereRef} />
      <EdgeRenderer />
      <TempEdgeLine />

      {mode === 'interior' ? (
        <InteriorView controlsRef={controlsRef} />
      ) : (
        <SphereView />
      )}

      <HandCursor />
      <SceneInner controlsRef={controlsRef} sphereRef={sphereRef} />
      <PostProcessing />

      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.05}
        minDistance={0.1}
        maxDistance={20}
      />
    </>
  );
}
