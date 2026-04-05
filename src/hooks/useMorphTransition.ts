import { useRef, useEffect, useCallback } from 'react';
import gsap from 'gsap';
import type * as THREE from 'three';
import type { Vec3 } from '../types';
import { useGraphStore, rebuildArrays, type ViewMode } from '../store/useGraphStore';
import { buildHierarchy, buildHierarchyFromTree, computeRadialLayout } from '../utils/radialLayout';
import { sphericalToCartesian } from '../utils/coordinates';

/** 선형 보간 */
function lerpScalar(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Sphere ↔ Radial morph 전환 훅 (P2-PATCH-1: 클래스→훅).
 * 단일 GSAP tween + onUpdate 패턴으로 성능 최적화.
 */
export function useMorphTransition() {
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const sourceRef = useRef<Vec3[]>([]);
  const targetRef = useRef<Vec3[]>([]);
  const snapshotModeRef = useRef<ViewMode>('sphere');

  // cleanup on unmount
  useEffect(() => {
    return () => { timelineRef.current?.kill(); };
  }, []);

  /** Sphere → Radial */
  const morphToRadial = useCallback((
    camera: THREE.Camera,
    controlsTarget: THREE.Vector3,
    wireframeMat: THREE.Material | null,
  ) => {
    const store = useGraphStore.getState();
    if (store.isTransitioning) return;

    const { nodeArray, sphereRadius } = store;
    if (nodeArray.length === 0) return;

    // 스냅샷 저장 — nodes Map에서 최신 위치 (nodeArray는 stale일 수 있음)
    snapshotModeRef.current = store.mode;
    sourceRef.current = nodeArray.map((n) => {
      const live = store.nodes.get(n.id);
      return live ? { ...live.position } : { ...n.position };
    });

    // D3 방사형 레이아웃 계산 (parentId 트리가 있으면 실제 트리 사용)
    const hasRealTree = nodeArray.some((n) => n.parentId != null);
    const hier = hasRealTree ? buildHierarchyFromTree(nodeArray) : buildHierarchy(nodeArray);
    const { layout, treeEdges, effectiveRadius } = computeRadialLayout(hier, sphereRadius + 3);

    // 타겟 위치 계산
    targetRef.current = nodeArray.map((node) => {
      const radial = layout.get(node.id);
      if (!radial) return { ...node.position };
      const r = radial.depth;
      return {
        x: r * Math.cos(radial.angle),
        y: r * Math.sin(radial.angle),
        z: 0,
      };
    });

    // 카메라 거리: FOV 60°에서 전체 레이아웃이 화면 안에 들어오도록
    // 가시 반경 = Z * tan(30°) ≈ Z * 0.577 → Z = effectiveRadius / 0.577 * 1.15 (여유)
    const cameraZ = Math.max(10, effectiveRadius * 2.2);

    // 기존 전환 중단
    timelineRef.current?.kill();
    store.setTransitioning(true);
    useGraphStore.setState({ transitionTarget: 'radial', transitionProgress: 0 });

    const morphState = { progress: 0 };
    const src = sourceRef.current;
    const tgt = targetRef.current;

    const tl = gsap.timeline({
      onUpdate: () => {
        // 전환 중 카메라 시선을 target에 맞춤 (OrbitControls disabled 동안)
        camera.lookAt(controlsTarget.x, controlsTarget.y, controlsTarget.z);
      },
      onComplete: () => {
        // 노드 위치를 스토어에 최종 커밋
        const s = useGraphStore.getState();
        const nodes = new Map(s.nodes);
        s.nodeArray.forEach((n, i) => {
          const t = tgt[i];
          if (!t) return;
          const prev = nodes.get(n.id);
          if (!prev) return;
          const radial = layout.get(n.id);
          nodes.set(n.id, {
            ...prev,
            position: { ...t },
            radialCoord: radial
              ? { angle: radial.angle, depth: radial.depth }
              : prev.radialCoord,
          });
        });
        useGraphStore.setState({
          nodes,
          ...rebuildArrays(nodes),
          treeEdges,
          mode: 'radial',
          isTransitioning: false,
          transitionProgress: 1,
          transitionTarget: null,
        });
      },
    });

    // 노드 위치 보간 (단일 tween)
    tl.to(morphState, {
      progress: 1,
      duration: 1.2,
      ease: 'power3.inOut',
      onUpdate: () => {
        const t = morphState.progress;
        const s = useGraphStore.getState();
        const nodes = new Map(s.nodes);
        s.nodeArray.forEach((n, i) => {
          const s0 = src[i];
          const t0 = tgt[i];
          if (!s0 || !t0) return;
          const prev = nodes.get(n.id);
          if (!prev) return;
          nodes.set(n.id, {
            ...prev,
            position: {
              x: lerpScalar(s0.x, t0.x, t),
              y: lerpScalar(s0.y, t0.y, t),
              z: lerpScalar(s0.z, t0.z, t),
            },
          });
        });
        // Map만 업데이트 — rebuildArrays는 onComplete에서만 (GC 72회 → 0회)
        useGraphStore.setState({ nodes, transitionProgress: t });
      },
    }, 0);

    // 카메라 전환 — 노드 수에 비례한 거리
    tl.to(camera.position, {
      x: 0, y: 0, z: cameraZ,
      duration: 1.2,
      ease: 'power3.inOut',
    }, 0);

    tl.to(controlsTarget, {
      x: 0, y: 0, z: 0,
      duration: 1.2,
      ease: 'power3.inOut',
    }, 0);

    // 와이어프레임 fade out
    if (wireframeMat && 'opacity' in wireframeMat) {
      tl.to(wireframeMat, {
        opacity: 0,
        duration: 0.6,
        ease: 'power2.out',
      }, 0);
    }

    timelineRef.current = tl;
  }, []);

  /** Radial → Sphere */
  const morphToSphere = useCallback((
    camera: THREE.Camera,
    controlsTarget: THREE.Vector3,
    wireframeMat: THREE.Material | null,
  ) => {
    const store = useGraphStore.getState();
    if (store.isTransitioning) return;

    const { nodeArray, sphereRadius } = store;
    if (nodeArray.length === 0) return;

    snapshotModeRef.current = store.mode;

    // nodes Map에서 최신 위치 읽기 (nodeArray는 stale일 수 있음)
    sourceRef.current = nodeArray.map((n) => {
      const live = store.nodes.get(n.id);
      return live ? { ...live.position } : { ...n.position };
    });

    // 편집된 sphereCoord → 구면 3D 좌표로 타겟 계산
    targetRef.current = nodeArray.map((n) => {
      const live = store.nodes.get(n.id);
      const sc = live?.sphereCoord ?? n.sphereCoord;
      return sphericalToCartesian(sc.theta, sc.phi, sphereRadius);
    });

    timelineRef.current?.kill();
    store.setTransitioning(true);
    useGraphStore.setState({ transitionTarget: 'sphere', transitionProgress: 0 });

    const morphState = { progress: 0 };
    const src = sourceRef.current;
    const tgt = targetRef.current;

    const tl = gsap.timeline({
      onUpdate: () => {
        camera.lookAt(controlsTarget.x, controlsTarget.y, controlsTarget.z);
      },
      onComplete: () => {
        const s = useGraphStore.getState();
        const nodes = new Map(s.nodes);
        s.nodeArray.forEach((n, i) => {
          const t = tgt[i];
          if (!t) return;
          const prev = nodes.get(n.id);
          if (!prev) return;
          nodes.set(n.id, { ...prev, position: { ...t } });
        });
        useGraphStore.setState({
          nodes,
          ...rebuildArrays(nodes),
          treeEdges: [],
          mode: 'sphere',
          isTransitioning: false,
          transitionProgress: 1,
          transitionTarget: null,
        });
      },
    });

    tl.to(morphState, {
      progress: 1,
      duration: 1.2,
      ease: 'power3.inOut',
      onUpdate: () => {
        const t = morphState.progress;
        const s = useGraphStore.getState();
        const nodes = new Map(s.nodes);
        s.nodeArray.forEach((n, i) => {
          const s0 = src[i];
          const t0 = tgt[i];
          if (!s0 || !t0) return;
          const prev = nodes.get(n.id);
          if (!prev) return;
          nodes.set(n.id, {
            ...prev,
            position: {
              x: lerpScalar(s0.x, t0.x, t),
              y: lerpScalar(s0.y, t0.y, t),
              z: lerpScalar(s0.z, t0.z, t),
            },
          });
        });
        useGraphStore.setState({ nodes, transitionProgress: t });
      },
    }, 0);

    // 카메라 복귀
    tl.to(camera.position, {
      x: 0, y: 0, z: 8,
      duration: 1.2,
      ease: 'power3.inOut',
    }, 0);

    tl.to(controlsTarget, {
      x: 0, y: 0, z: 0,
      duration: 1.2,
      ease: 'power3.inOut',
    }, 0);

    // 와이어프레임 fade in
    if (wireframeMat && 'opacity' in wireframeMat) {
      tl.to(wireframeMat, {
        opacity: 0.1,
        duration: 0.6,
        ease: 'power2.in',
      }, 0.6);
    }

    timelineRef.current = tl;
  }, []);

  /** 전환 취소 + 롤백 (P2-PATCH-4) */
  const cancel = useCallback(() => {
    timelineRef.current?.kill();

    const positions = sourceRef.current;
    if (positions.length > 0) {
      const s = useGraphStore.getState();
      const nodes = new Map(s.nodes);
      s.nodeArray.forEach((n, i) => {
        const pos = positions[i];
        if (!pos) return;
        const prev = nodes.get(n.id);
        if (!prev) return;
        nodes.set(n.id, { ...prev, position: { ...pos } });
      });
      useGraphStore.setState({
        nodes,
        mode: snapshotModeRef.current,
        isTransitioning: false,
        transitionProgress: 0,
      });
    } else {
      useGraphStore.setState({ isTransitioning: false });
    }
  }, []);

  return { morphToRadial, morphToSphere, cancel };
}
