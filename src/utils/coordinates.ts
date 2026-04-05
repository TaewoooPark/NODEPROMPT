import type { Vec3, SphericalCoord } from '../types';

/** 구면 좌표 → 카르테시안 */
export function sphericalToCartesian(
  theta: number,
  phi: number,
  radius: number,
): Vec3 {
  return {
    x: radius * Math.sin(theta) * Math.cos(phi),
    y: radius * Math.cos(theta),
    z: radius * Math.sin(theta) * Math.sin(phi),
  };
}

/** 카르테시안 → 구면 좌표 (P1-PATCH-2) */
export function cartesianToSpherical(
  x: number,
  y: number,
  z: number,
): SphericalCoord & { r: number } {
  const r = Math.sqrt(x * x + y * y + z * z);
  if (r === 0) return { theta: 0, phi: 0, r: 0 };
  const theta = Math.acos(Math.max(-1, Math.min(1, y / r)));
  let phi = Math.atan2(z, x);
  if (phi < 0) phi += 2 * Math.PI;
  return { theta, phi, r };
}

/** 방사형 좌표 → 카르테시안 2D (z=0) */
export function radialToCartesian(
  angle: number,
  depth: number,
  maxRadius: number,
): Vec3 {
  const r = (depth / 10) * maxRadius;
  return {
    x: r * Math.cos(angle),
    y: r * Math.sin(angle),
    z: 0,
  };
}

/** 방사형 좌표 → 구면 좌표 (depth 클램핑 — P2-PATCH-3) */
export function radialToSpherical(
  angle: number,
  depth: number,
  maxDepth: number,
): SphericalCoord {
  const clamped = Math.max(0, Math.min(depth, maxDepth));
  const theta = (clamped / maxDepth) * Math.PI;
  const phi = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return { theta, phi };
}

/** 구면 좌표에서 θ,φ 추출 (카르테시안 Vec3 입력) */
export function vec3ToSpherical(v: Vec3): SphericalCoord & { r: number } {
  return cartesianToSpherical(v.x, v.y, v.z);
}
