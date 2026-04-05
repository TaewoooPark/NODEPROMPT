/**
 * 노드 크기 계산 — 깊이 + 가중치 기반 지수 스케일.
 *
 * 깊이: 얕을수록 크다 (depth 0 = 루트 = 가장 큼)
 * 가중치: 지수 함수로 차이를 크게
 *
 * 결과 범위: ~0.01 (깊고 가벼운 노드) ~ ~0.12 (루트 + 최대 가중치)
 */
export function computeNodeScale(weight: number, depth: number): number {
  // 깊이 배수: depth 0→1.0, 1→0.6, 2→0.36, 3→0.22, 4→0.13
  const depthFactor = Math.pow(0.6, depth);

  // 가중치 지수: w=0→0.15, w=0.5→0.42, w=1→1.0 (지수 2)
  const weightFactor = Math.pow(weight, 2);

  // 최종 스케일: 기본 크기 + 깊이×가중치 보너스
  return 0.01 + 0.11 * depthFactor * (0.15 + 0.85 * weightFactor);
}
