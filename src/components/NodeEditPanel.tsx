import { useMemo, useCallback, useState, useRef, useEffect, type CSSProperties } from 'react';
import type { NodeType } from '../types';
import { useGraphStore } from '../store/useGraphStore';
import { useHistoryStore } from '../store/useHistoryStore';
import { PATTERN_CSS, ALL_NODE_TYPES } from '../utils/nodePatterns';
import { invalidateHighlightCache } from '../utils/highlightState';
import { generateNodeDescription } from '../services/claude';
import { useT, useTypeLabels } from '../i18n/useLanguage';

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

const inputStyle: CSSProperties = {
  width: '100%',
  border: '1px solid rgba(0,0,0,0.15)',
  borderRadius: 4,
  padding: '3px 6px',
  fontSize: 13,
  fontFamily: 'inherit',
  fontWeight: 400,
  color: '#1a1a1a',
  outline: 'none',
  background: '#fff',
  boxSizing: 'border-box',
};

const textareaStyle: CSSProperties = {
  width: '100%',
  border: '1px solid rgba(0,0,0,0.12)',
  borderRadius: 4,
  padding: '4px 6px',
  fontSize: 11,
  fontFamily: 'inherit',
  fontWeight: 300,
  color: '#555',
  outline: 'none',
  background: '#fff',
  resize: 'vertical',
  minHeight: 44,
  lineHeight: 1.5,
  boxSizing: 'border-box',
};

export function NodeEditPanel() {
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const nodes = useGraphStore((s) => s.nodes);
  const originalPrompt = useGraphStore((s) => s.originalPrompt);
  const updateNode = useGraphStore((s) => s.updateNode);
  const softDeleteNode = useGraphStore((s) => s.softDeleteNode);
  const restoreNode = useGraphStore((s) => s.restoreNode);
  const startEdgeCreation = useGraphStore((s) => s.startEdgeCreation);
  const setSelectedId = useGraphStore((s) => s.setSelectedNodeId);
  const pushAction = useHistoryStore((s) => s.pushAction);
  const t = useT();
  const typeLabels = useTypeLabels();

  const node = useMemo(
    () => (selectedNodeId ? nodes.get(selectedNodeId) ?? null : null),
    [selectedNodeId, nodes],
  );

  // ── Label editing ──
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState('');
  const labelInputRef = useRef<HTMLInputElement>(null);

  // ── Description editing ──
  const [descDraft, setDescDraft] = useState('');
  const [descFocused, setDescFocused] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Sync drafts when node changes
  useEffect(() => {
    if (node) {
      setLabelDraft(node.label);
      setDescDraft(node.description);
    }
    setEditingLabel(false);
  }, [node?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-focus label input
  useEffect(() => {
    if (editingLabel) labelInputRef.current?.select();
  }, [editingLabel]);

  const commitLabel = useCallback(() => {
    if (!node) return;
    const trimmed = labelDraft.trim();
    if (trimmed && trimmed !== node.label) {
      pushAction({ type: 'updateNode', targetId: node.id, before: { label: node.label }, after: { label: trimmed } });
      updateNode(node.id, { label: trimmed });
    } else {
      setLabelDraft(node.label);
    }
    setEditingLabel(false);
  }, [node, labelDraft, updateNode, pushAction]);

  const commitDesc = useCallback(() => {
    if (!node) return;
    const trimmed = descDraft.trim();
    if (trimmed !== node.description) {
      pushAction({ type: 'updateNode', targetId: node.id, before: { description: node.description }, after: { description: trimmed } });
      updateNode(node.id, { description: trimmed });
    }
    setDescFocused(false);
  }, [node, descDraft, updateNode, pushAction]);

  const handleAutoGenerate = useCallback(async () => {
    if (!node || generating) return;
    setGenerating(true);
    try {
      const desc = await generateNodeDescription(node.label, node.type, originalPrompt);
      setDescDraft(desc);
      pushAction({ type: 'updateNode', targetId: node.id, before: { description: node.description }, after: { description: desc } });
      updateNode(node.id, { description: desc });
    } catch {
      // silently fail
    } finally {
      setGenerating(false);
    }
  }, [node, generating, originalPrompt, updateNode, pushAction]);

  const handleWeightChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!node) return;
      const newWeight = parseFloat(e.target.value);
      pushAction({ type: 'updateNode', targetId: node.id, before: { weight: node.weight }, after: { weight: newWeight } });
      updateNode(node.id, { weight: newWeight });
    },
    [node, updateNode, pushAction],
  );

  const handleTypeChange = useCallback(
    (t: NodeType) => {
      if (!node || node.type === t) return;
      pushAction({ type: 'updateNode', targetId: node.id, before: { type: node.type }, after: { type: t } });
      updateNode(node.id, { type: t });
    },
    [node, updateNode, pushAction],
  );

  const handleDelete = useCallback(() => {
    if (!node) return;
    softDeleteNode(node.id);
    pushAction({ type: 'softDeleteNode', targetId: node.id, before: { isDeleted: false }, after: { isDeleted: true } });
    setSelectedId(null);
  }, [node, softDeleteNode, pushAction, setSelectedId]);

  const handleRestore = useCallback(() => {
    if (!node) return;
    restoreNode(node.id);
    pushAction({ type: 'restoreNode', targetId: node.id, before: { isDeleted: true }, after: { isDeleted: false } });
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
      {/* Header — label (double-click to edit) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          border: '0.5px solid rgba(0,0,0,0.15)', flexShrink: 0,
          ...PATTERN_CSS[node.type as NodeType],
        }} />
        {editingLabel ? (
          <input
            ref={labelInputRef}
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={(e) => { if (e.key === 'Enter') commitLabel(); if (e.key === 'Escape') { setLabelDraft(node.label); setEditingLabel(false); } }}
            style={{ ...inputStyle, flex: 1 }}
          />
        ) : (
          <span
            onDoubleClick={() => setEditingLabel(true)}
            title={t('edit.dblClickLabel')}
            style={{ fontSize: 13, fontWeight: 400, color: '#1a1a1a', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'text' }}
          >
            {node.label}
          </span>
        )}
      </div>

      {/* Description */}
      <div style={{ ...sectionLabel, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Description</span>
        <button
          onClick={handleAutoGenerate}
          disabled={generating}
          style={{
            ...btnBase,
            padding: '1px 6px',
            fontSize: 9,
            opacity: generating ? 0.5 : 1,
            cursor: generating ? 'wait' : 'pointer',
          }}
        >
          {generating ? '...' : 'Auto'}
        </button>
      </div>
      <textarea
        value={descDraft}
        onChange={(e) => setDescDraft(e.target.value)}
        onFocus={() => setDescFocused(true)}
        onBlur={commitDesc}
        placeholder={t('edit.descPlaceholder')}
        style={textareaStyle}
      />

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
        {ALL_NODE_TYPES.map((tp) => (
          <button
            key={tp}
            onClick={() => handleTypeChange(tp)}
            style={{
              ...btnBase,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: node.type === tp ? 'rgba(0,0,0,0.06)' : 'none',
              fontWeight: node.type === tp ? 400 : 300,
            }}
          >
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              border: '0.5px solid rgba(0,0,0,0.15)',
              ...PATTERN_CSS[tp],
            }} />
            {typeLabels[tp]}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div style={{ ...sectionLabel, marginTop: 12 }}>Actions</div>
      <div style={{ display: 'flex', gap: 6 }}>
        {node.isDeleted ? (
          <button onClick={handleRestore} style={btnBase}>
            {t('edit.restore')}
          </button>
        ) : (
          <>
            <button onClick={handleDelete} style={btnBase}>
              {t('edit.delete')}
            </button>
            <button onClick={handleEdgeStart} style={btnBase}>
              {t('edit.connectEdge')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
