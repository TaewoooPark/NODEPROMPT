import { useMemo, useCallback, type CSSProperties } from 'react';
import type { NodeType } from '../types';
import { useGraphStore } from '../store/useGraphStore';
import { useHistoryStore } from '../store/useHistoryStore';
import { PATTERN_CSS, TYPE_LABELS_KO, ALL_NODE_TYPES } from '../utils/nodePatterns';
import { invalidateHighlightCache } from '../utils/highlightState';

const panelStyle: CSSProperties = {
  position: 'fixed',
  right: 16,
  top: 180,
  width: 220,
  background: 'rgba(255,255,255,0.94)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(0,0,0,0.1)',
  borderRadius: 8,
  padding: '12px 14px',
  zIndex: 90,
  fontFamily: '"DM Sans", "IBM Plex Sans", sans-serif',
  userSelect: 'none',
};

const sectionLabel: CSSProperties = {
  fontSize: 10,
  color: '#999',
  fontWeight: 300,
  marginBottom: 4,
  marginTop: 10,
};

const btnBase: CSSProperties = {
  background: 'none',
  border: '1px solid rgba(0,0,0,0.12)',
  borderRadius: 5,
  padding: '4px 10px',
  cursor: 'pointer',
  fontSize: 11,
  fontFamily: 'inherit',
  fontWeight: 300,
  color: '#333',
  transition: 'background 0.1s ease',
};

/**
 * 노드 선택 시 우측에 표시되는 편집 패널.
 * 가중치 슬라이더, 타입 변경, 삭제/복원, 엣지 연결.
 */
export function NodeEditPanel() {
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const nodes = useGraphStore((s) => s.nodes);
  const updateNode = useGraphStore((s) => s.updateNode);
  const softDeleteNode = useGraphStore((s) => s.softDeleteNode);
  const restoreNode = useGraphStore((s) => s.restoreNode);
  const startEdgeCreation = useGraphStore((s) => s.startEdgeCreation);
  const setSelectedId = useGraphStore((s) => s.setSelectedNodeId);
  const pushAction = useHistoryStore((s) => s.pushAction);

  const node = useMemo(
    () => (selectedNodeId ? nodes.get(selectedNodeId) ?? null : null),
    [selectedNodeId, nodes],
  );

  const handleWeightChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!node) return;
      const newWeight = parseFloat(e.target.value);
      pushAction({
        type: 'updateNode',
        targetId: node.id,
        before: { weight: node.weight },
        after: { weight: newWeight },
      });
      updateNode(node.id, { weight: newWeight });
    },
    [node, updateNode, pushAction],
  );

  const handleTypeChange = useCallback(
    (t: NodeType) => {
      if (!node || node.type === t) return;
      pushAction({
        type: 'updateNode',
        targetId: node.id,
        before: { type: node.type },
        after: { type: t },
      });
      updateNode(node.id, { type: t });
    },
    [node, updateNode, pushAction],
  );

  const handleDelete = useCallback(() => {
    if (!node) return;
    softDeleteNode(node.id);
    pushAction({
      type: 'softDeleteNode',
      targetId: node.id,
      before: { isDeleted: false },
      after: { isDeleted: true },
    });
    setSelectedId(null);
  }, [node, softDeleteNode, pushAction, setSelectedId]);

  const handleRestore = useCallback(() => {
    if (!node) return;
    restoreNode(node.id);
    pushAction({
      type: 'restoreNode',
      targetId: node.id,
      before: { isDeleted: true },
      after: { isDeleted: false },
    });
  }, [node, restoreNode, pushAction]);

  const handleEdgeStart = useCallback(() => {
    if (!node) return;
    startEdgeCreation(node.id);
    invalidateHighlightCache();
  }, [node, startEdgeCreation]);

  if (!node) return null;

  const weightPct = Math.round(node.weight * 100);

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          border: '0.5px solid rgba(0,0,0,0.15)', flexShrink: 0,
          ...PATTERN_CSS[node.type as NodeType],
        }} />
        <span style={{ fontSize: 13, fontWeight: 400, color: '#1a1a1a', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.label}
        </span>
      </div>

      {/* Weight slider */}
      <div style={sectionLabel}>Weight — {weightPct}%</div>
      <input
        type="range"
        min={0.05}
        max={1}
        step={0.01}
        value={node.weight}
        onChange={handleWeightChange}
        style={{
          width: '100%',
          height: 3,
          appearance: 'none',
          WebkitAppearance: 'none',
          background: `linear-gradient(to right, #1a1a1a ${weightPct}%, rgba(0,0,0,0.08) ${weightPct}%)`,
          borderRadius: 2,
          outline: 'none',
          cursor: 'pointer',
        }}
      />

      {/* Type selector */}
      <div style={sectionLabel}>Type</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {ALL_NODE_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => handleTypeChange(t)}
            style={{
              ...btnBase,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: node.type === t ? 'rgba(0,0,0,0.06)' : 'none',
              fontWeight: node.type === t ? 400 : 300,
            }}
          >
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              border: '0.5px solid rgba(0,0,0,0.15)',
              ...PATTERN_CSS[t],
            }} />
            {TYPE_LABELS_KO[t]}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div style={{ ...sectionLabel, marginTop: 12 }}>Actions</div>
      <div style={{ display: 'flex', gap: 6 }}>
        {node.isDeleted ? (
          <button onClick={handleRestore} style={btnBase}>
            복원
          </button>
        ) : (
          <>
            <button onClick={handleDelete} style={btnBase}>
              삭제
            </button>
            <button onClick={handleEdgeStart} style={btnBase}>
              엣지 연결
            </button>
          </>
        )}
      </div>
    </div>
  );
}
