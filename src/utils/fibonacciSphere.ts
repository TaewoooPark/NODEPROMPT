import type { Vec3 } from '../types';

/**
 * 피보나치 격자로 구 표면에 n개 점을 균일 분포.
 * Roberts(2020) ε 오프셋 적용으로 극점 클러스터링 방지.
 *
 * Ref: 02_LOGIC_REFERENCES.md §5
 */
export function fibonacciSphere(n: number, radius: number): Vec3[] {
  const points: Vec3[] = [];
  const goldenRatio = (1 + Math.sqrt(5)) / 2;
  const angleIncrement = Math.PI * 2 * goldenRatio;
  const epsilon = 0.36; // Roberts 최적값

  for (let i = 0; i < n; i++) {
    const t = (i + epsilon) / (n - 1 + 2 * epsilon);
    const inclination = Math.acos(1 - 2 * t);
    const azimuth = angleIncrement * i;

    points.push({
      x: Math.sin(inclination) * Math.cos(azimuth) * radius,
      y: Math.sin(inclination) * Math.sin(azimuth) * radius,
      z: Math.cos(inclination) * radius,
    });
  }
  return points;
}
