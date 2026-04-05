import type { ReactNode } from 'react';
import type { NodeData } from '../types';

/**
 * 응답 텍스트에서 노드 라벨과 일치하는 부분을 강조.
 * 흑백 Lombardi 스타일: 볼드 + 언더라인으로 시각 구분.
 */
export function highlightConcepts(
  text: string,
  nodes: NodeData[],
): ReactNode {
  if (!text || nodes.length === 0) return text;

  const active = nodes.filter((n) => !n.isDeleted && n.label.length >= 2);
  if (active.length === 0) return text;

  // 긴 라벨 우선 (부분 매칭 방지)
  const sorted = [...active].sort((a, b) => b.label.length - a.label.length);

  // 정규식 생성: 모든 라벨을 OR로 결합
  const escapedLabels = sorted.map((n) =>
    n.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  );
  const regex = new RegExp(`(${escapedLabels.join('|')})`, 'gi');

  const labelSet = new Set(sorted.map((n) => n.label.toLowerCase()));

  const parts = text.split(regex);

  return parts.map((part, i) => {
    if (labelSet.has(part.toLowerCase())) {
      return (
        <span key={i} style={{ color: '#1a1a1a', fontWeight: 600, textDecoration: 'underline', textDecorationThickness: '1px', textUnderlineOffset: '2px' }}>
          {part}
        </span>
      );
    }
    return part;
  });
}
