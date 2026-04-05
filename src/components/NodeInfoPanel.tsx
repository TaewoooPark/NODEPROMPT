import { useMemo, useCallback, type CSSProperties } from 'react';
import { useGraphStore } from '../store/useGraphStore';
import { PATTERN_CSS, TYPE_LABELS_KO } from '../utils/nodePatterns';
import type { NodeType } from '../types';

const panelStyle: CSSProperties = {
  position: 'fixed',
  left: 16,
  top: 80,
  maxWidth: 260,
  background: 'rgba(255,255,255,0.92)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(0,0,0,0.1)',
  borderRadius: 8,
  padding: '10px 14px',
  zIndex: 90,
  fontFamily: '"DM Sans", "IBM Plex Sans", sans-serif',
  userSelect: 'none',
  transition: 'opacity 0.2s ease',
};

/**
 * 노드 선택 시 왼쪽에 표시되는 상세 패널.
 * 연결 노드 목록 + 가중치 바 + 클릭 내비게이션.
 */
export function NodeInfoPanel() {
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const treeEdges = useGraphStore((s) => s.treeEdges);
  const setSelectedId = useGraphStore((s) => s.setSelectedNodeId);

  const node = useMemo(
    () => (selectedNodeId ? nodes.get(selectedNodeId) ?? null : null),
    [selectedNodeId, nodes],
  );

  // 연결된 노드 목록
  const connectedNodes = useMemo(() => {
    if (!selectedNodeId) return [];
    const ids = new Set<string>();

    for (const edge of edges.values()) {
      if (edge.isDeleted) continue;
      if (edge.sourceId === selectedNodeId) ids.add(edge.targetId);
      if (edge.targetId === selectedNodeId) ids.add(edge.sourceId);
    }
    for (const te of treeEdges) {
      if (te.from === selectedNodeId) ids.add(te.to);
      if (te.to === selectedNodeId) ids.add(te.from);
    }

    const result: { id: string; label: string; type: NodeType }[] = [];
    for (const id of ids) {
      const n = nodes.get(id);
      if (n && !n.isDeleted) result.push({ id: n.id, label: n.label, type: n.type });
    }
    return result.sort((a, b) => a.label.localeCompare(b.label));
  }, [selectedNodeId, edges, treeEdges, nodes]);

  const handleNodeClick = useCallback(
    (id: string) => setSelectedId(id),
    [setSelectedId],
  );

  if (!node) return null;

  const typeLabel = TYPE_LABELS_KO[node.type as NodeType] ?? node.type;
  const weightPct = Math.round(node.weight * 100);

  return (
    <div style={panelStyle}>
      {/* Header: label + type */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          border: '0.5px solid rgba(0,0,0,0.15)',
          flexShrink: 0,
          ...PATTERN_CSS[node.type as NodeType],
        }} />
        <span style={{ fontSize: 13, fontWeight: 400, color: '#1a1a1a' }}>
          {node.label}
        </span>
        <span style={{ fontSize: 10, color: '#999', marginLeft: 2 }}>
          {typeLabel}
        </span>
      </div>

      {/* Description */}
      {node.description && (
        <div style={{ fontSize: 11, fontWeight: 300, color: '#555', lineHeight: 1.5, marginBottom: 8 }}>
          {node.description}
        </div>
      )}

      {/* Weight bar */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
          <span style={{ fontSize: 10, color: '#999', fontWeight: 300 }}>Weight</span>
          <span style={{ fontSize: 10, color: '#666', fontWeight: 400 }}>{weightPct}%</span>
        </div>
        <div style={{
          width: '100%',
          height: 3,
          background: 'rgba(0,0,0,0.06)',
          borderRadius: 2,
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${weightPct}%`,
            height: '100%',
            background: '#1a1a1a',
            borderRadius: 2,
            transition: 'width 0.2s ease',
          }} />
        </div>
      </div>

      {/* Connected nodes */}
      {connectedNodes.length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: '#999', fontWeight: 300, marginBottom: 4 }}>
            Connected ({connectedNodes.length})
          </div>
          <div style={{ maxHeight: 120, overflowY: 'auto' }}>
            {connectedNodes.map((cn) => (
              <div
                key={cn.id}
                onClick={() => handleNodeClick(cn.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '2px 4px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 300,
                  color: '#333',
                  transition: 'background 0.1s ease',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,0,0,0.04)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                }}
              >
                <span style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  border: '0.5px solid rgba(0,0,0,0.12)',
                  flexShrink: 0,
                  ...PATTERN_CSS[cn.type],
                }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {cn.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
