import type { Vec3 } from '../types';

/**
 * Poincaré 볼 메트릭 근사 기반 어안 렌즈 스케일링.
 * 구 중심에 가까운 노드는 크게, 경계에 가까운 노드는 작게.
 *
 * Ref: 02_LOGIC_REFERENCES.md §2
 * ds² = 4(dx²+dy²+dz²) / (1-r²)²
 * → 화면 스케일 ≈ (1-r²)×0.5 + 0.5
 */
export function hyperbolicScale(
  nodePos: Vec3,
  cameraPos: Vec3,
  sphereRadius: number,
): number {
  const distFromCenter = Math.sqrt(
    nodePos.x * nodePos.x + nodePos.y * nodePos.y + nodePos.z * nodePos.z,
  );
  const r = Math.min(distFromCenter / sphereRadius, 1); // clamp 0~1

  // Poincaré 볼 근사
  const pScale = (1 - r * r) * 0.5 + 0.5;

  // 카메라 근접도 보정
  const dx = nodePos.x - cameraPos.x;
  const dy = nodePos.y - cameraPos.y;
  const dz = nodePos.z - cameraPos.z;
  const distToCamera = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const proximityBoost = Math.max(0.5, 1 - distToCamera / (sphereRadius * 2));

  return pScale * proximityBoost;
}

/**
 * 정확한 Poincaré 볼 스케일 (필요 시).
 * @param r - 0 (중심) ~ 1 (경계)
 */
export function poincareBallScale(r: number): number {
  return 2.0 / (1.0 + r * r);
}
