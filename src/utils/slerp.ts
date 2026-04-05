import type { Vec3 } from '../types';

/**
 * Spherical Linear Interpolation — 구면 등속 보간.
 * Ref: 02_LOGIC_REFERENCES.md §6
 *
 * 단순 lerp+normalize 대비 세그먼트 간격이 균일하여 엣지 품질 향상.
 */
export function slerp(v0: Vec3, v1: Vec3, t: number): Vec3 {
  // 정규화
  const len0 = Math.sqrt(v0.x * v0.x + v0.y * v0.y + v0.z * v0.z);
  const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
  if (len0 === 0 || len1 === 0) {
    return {
      x: v0.x + (v1.x - v0.x) * t,
      y: v0.y + (v1.y - v0.y) * t,
      z: v0.z + (v1.z - v0.z) * t,
    };
  }

  const n0x = v0.x / len0, n0y = v0.y / len0, n0z = v0.z / len0;
  const n1x = v1.x / len1, n1y = v1.y / len1, n1z = v1.z / len1;

  let dot = n0x * n1x + n0y * n1y + n0z * n1z;
  dot = Math.max(-1, Math.min(1, dot));

  const theta = Math.acos(dot);
  const sinTheta = Math.sin(theta);

  // 거의 같은 방향 → 선형 보간 폴백
  if (sinTheta < 0.001) {
    return {
      x: v0.x + (v1.x - v0.x) * t,
      y: v0.y + (v1.y - v0.y) * t,
      z: v0.z + (v1.z - v0.z) * t,
    };
  }

  const a = Math.sin((1 - t) * theta) / sinTheta;
  const b = Math.sin(t * theta) / sinTheta;

  // 원래 반지름 보간
  const r = len0 + (len1 - len0) * t;

  return {
    x: (a * n0x + b * n1x) * r,
    y: (a * n0y + b * n1y) * r,
    z: (a * n0z + b * n1z) * r,
  };
}

/** SLERP로 대원호 포인트 배열 생성 (구 표면 엣지용) */
export function greatCircleArc(
  v0: Vec3,
  v1: Vec3,
  segments: number,
  radiusOffset: number = 0,
): Vec3[] {
  const points: Vec3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = slerp(v0, v1, t);
    // 구 표면 약간 위로 오프셋 (관통 방지)
    if (radiusOffset !== 0) {
      const len = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
      if (len > 0) {
        const scale = (len + radiusOffset) / len;
        p.x *= scale;
        p.y *= scale;
        p.z *= scale;
      }
    }
    points.push(p);
  }
  return points;
}
