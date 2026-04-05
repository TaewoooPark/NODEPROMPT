import { useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { gestureState } from '../gesture/gestureEngine';
import { useGraphStore } from '../store/useGraphStore';

// ── 상수 ──
const STALE_MS = 500;
const SPHERE_RADIUS = 3;
const ZOOM_SPEED = 4.0;
const DEAD_ZONE_RATIO = 0.08;
const INFERENCE_DT = 67;

// 회전
const ROTATION_DEAD_ZONE = 0.008;
const ROTATION_DAMPING = 0.12;
const MAX_ROTATION_PER_FRAME = 0.04;

// 관성
const MOMENTUM_FRICTION = 0.988;
const MOMENTUM_MIN_SPEED = 0.0002;
const VELOCITY_SMOOTH = 0.3;

// 임시 벡터
const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _center = new THREE.Vector3(0, 0, 0);
const _hit = new THREE.Vector3();
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();

function raySphereIntersect(
  ray: THREE.Ray, center: THREE.Vector3, radius: number, out: THREE.Vector3,
): boolean {
  const L = _v1.copy(ray.origin).sub(center);
  const a = ray.direction.dot(ray.direction);
  const b = 2 * ray.direction.dot(L);
  const c = L.dot(L) - radius * radius;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return false;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  if (t < 0) return false;
  out.copy(ray.origin).addScaledVector(ray.direction, t);
  return true;
}

/**
 * 지구본 모드:
 * - 손바닥 펴고 쓸면 → 그 방향으로 구 회전
 * - 손 치우면 → 관성으로 계속 회전
 * - 주먹 쥐면 → 즉시 정지
 */
export function useGestureControl(
  controlsRef: RefObject<OrbitControlsImpl | null>,
): void {
  const { camera } = useThree();

  // 추적 상태
  const isTouchingRef = useRef(false);
  const anchorRef = useRef(new THREE.Vector3());
  const grabPalmSizeRef = useRef(0);

  // 관성
  const mAxis = useRef(new THREE.Vector3(0, 1, 0));
  const mSpeed = useRef(0);
  const smoothSpeed = useRef(0);
  const smoothAxis = useRef(new THREE.Vector3(0, 1, 0));

  const lastInferenceRef = useRef(0);
  const rotQ = useRef(new THREE.Quaternion());

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const { isTransitioning, gestureEnabled } = useGraphStore.getState();
    if (!gestureEnabled || isTransitioning) {
      isTouchingRef.current = false;
      mSpeed.current = 0;
      return;
    }

    const now = performance.now();
    const active = gestureState.active && gestureState.handDetected;
    const stale = now - gestureState.lastUpdateMs > STALE_MS;
    const target = controls.target;

    // ── 주먹 → 즉시 정지 ──
    if (active && !stale && gestureState.gestureName === 'Closed_Fist') {
      isTouchingRef.current = false;
      mSpeed.current = 0;
      smoothSpeed.current = 0;
      return;
    }

    // ── 손바닥이 아닌 상태 → 관성 회전 ──
    const isOpenPalm = active && !stale && gestureState.gestureName === 'Open_Palm';

    if (!isOpenPalm) {
      // 추적 중이었으면 관성 시작
      if (isTouchingRef.current) {
        isTouchingRef.current = false;
        mAxis.current.copy(smoothAxis.current);
        mSpeed.current = smoothSpeed.current;
      }

      // 관성 적용
      if (mSpeed.current > MOMENTUM_MIN_SPEED && controls.enableRotate) {
        rotQ.current.setFromAxisAngle(mAxis.current, mSpeed.current);
        const offset = _v1.copy(camera.position).sub(target);
        offset.applyQuaternion(rotQ.current);
        camera.position.copy(target).add(offset);
        camera.lookAt(target);
        controls.update();
        mSpeed.current *= MOMENTUM_FRICTION;
      } else {
        mSpeed.current = 0;
      }
      return;
    }

    // ── 손바닥 펴진 상태: 프레임 보간 ──
    const inferenceChanged = gestureState.lastUpdateMs !== lastInferenceRef.current;
    if (inferenceChanged) lastInferenceRef.current = gestureState.lastUpdateMs;

    const t = Math.min((now - gestureState.lastUpdateMs) / INFERENCE_DT, 1);
    const ndcX = THREE.MathUtils.lerp(gestureState.prevIndexTipNdcX, gestureState.indexTipNdcX, t);
    const ndcY = THREE.MathUtils.lerp(gestureState.prevIndexTipNdcY, gestureState.indexTipNdcY, t);
    const palmSmoothed = THREE.MathUtils.lerp(
      gestureState.prevPalmSizeSmoothed, gestureState.palmSizeSmoothed, t,
    );

    // 레이캐스트
    _ndc.set(ndcX, ndcY);
    _ray.setFromCamera(_ndc, camera);
    const onSphere = raySphereIntersect(_ray.ray, _center, SPHERE_RADIUS, _hit);

    if (!onSphere) {
      // 구 밖 → 관성 시작
      if (isTouchingRef.current) {
        isTouchingRef.current = false;
        mAxis.current.copy(smoothAxis.current);
        mSpeed.current = smoothSpeed.current;
      }
      // 관성 적용
      if (mSpeed.current > MOMENTUM_MIN_SPEED && controls.enableRotate) {
        rotQ.current.setFromAxisAngle(mAxis.current, mSpeed.current);
        const offset = _v1.copy(camera.position).sub(target);
        offset.applyQuaternion(rotQ.current);
        camera.position.copy(target).add(offset);
        camera.lookAt(target);
        controls.update();
        mSpeed.current *= MOMENTUM_FRICTION;
      }
      return;
    }

    // ── 구 위에 손바닥: 터치 시작 ──
    if (!isTouchingRef.current) {
      isTouchingRef.current = true;
      anchorRef.current.copy(_hit);
      grabPalmSizeRef.current = palmSmoothed;
      mSpeed.current = 0;
      smoothSpeed.current = 0;
      return;
    }

    // ── 터치 유지: 회전 (지구본 쓸기) ──
    if (controls.enableRotate) {
      _v1.copy(anchorRef.current).sub(_center).normalize();
      _v2.copy(_hit).sub(_center).normalize();
      const dot = THREE.MathUtils.clamp(_v1.dot(_v2), -1, 1);
      const angle = Math.acos(dot);

      if (angle > ROTATION_DEAD_ZONE) {
        const dampedAngle = Math.min(angle * ROTATION_DAMPING, MAX_ROTATION_PER_FRAME);
        const axis = _v1.clone().cross(_v2);
        const axisLen = axis.length();

        if (axisLen > 0.0001) {
          axis.divideScalar(axisLen);
          rotQ.current.setFromAxisAngle(axis, dampedAngle);

          const offset = _v1.copy(camera.position).sub(target);
          offset.applyQuaternion(rotQ.current);
          camera.position.copy(target).add(offset);
          camera.lookAt(target);
          controls.update();

          // 관성용 속도 추적
          smoothSpeed.current =
            smoothSpeed.current * (1 - VELOCITY_SMOOTH) +
            dampedAngle * VELOCITY_SMOOTH;
          smoothAxis.current.lerp(axis, VELOCITY_SMOOTH).normalize();
        }
      } else {
        smoothSpeed.current *= 0.85;
      }

      anchorRef.current.lerp(_hit, 0.7);
    }

    // ── 줌: 팜 사이즈 변화 ──
    if (gestureState.palmSizeBaseline > 0 && controls.enableZoom) {
      const palmDelta = palmSmoothed - grabPalmSizeRef.current;
      const deadZone = gestureState.palmSizeBaseline * DEAD_ZONE_RATIO;

      if (Math.abs(palmDelta) > deadZone) {
        const dir = _v2.copy(target).sub(camera.position).normalize();
        const dist = camera.position.distanceTo(target);
        const move = palmDelta * ZOOM_SPEED;
        const newDist = Math.max(controls.minDistance, Math.min(controls.maxDistance, dist - move));
        const actual = dist - newDist;

        if (Math.abs(actual) > 0.001) {
          camera.position.addScaledVector(dir, actual);
          controls.update();
        }
        grabPalmSizeRef.current += palmDelta * 0.1;
      }
    }
  });
}
