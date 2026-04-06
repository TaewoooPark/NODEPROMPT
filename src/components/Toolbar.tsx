import { useState, useEffect, useCallback, useRef, type CSSProperties } from 'react';
import { useGraphStore } from '../store/useGraphStore';
import { checkClaudeConnection, setApiKey, getSavedApiKey } from '../services/claude';
import { loadDemoData } from '../utils/demoData';
import { useT, useLanguageStore } from '../i18n/useLanguage';

const barStyle: CSSProperties = {
  position: 'fixed',
  top: 12,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  gap: 14,
  alignItems: 'center',
  background: 'rgba(255,255,255,0.85)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(0,0,0,0.1)',
  borderRadius: 10,
  padding: '6px 16px',
  zIndex: 100,
  fontSize: 12,
  color: '#1a1a1a',
  fontFamily: '"DM Sans", "IBM Plex Sans", sans-serif',
  fontWeight: 300,
};

const divider: CSSProperties = {
  width: 1,
  height: 14,
  background: 'rgba(0,0,0,0.1)',
  flexShrink: 0,
};

const smallBtn: CSSProperties = {
  background: 'none',
  border: '1px solid rgba(0,0,0,0.15)',
  borderRadius: 4,
  padding: '1px 6px',
  cursor: 'pointer',
  fontSize: 10,
  color: '#666',
  fontFamily: 'inherit',
  fontWeight: 400,
};

const MODE_LABELS: Record<string, string> = {
  sphere: 'Sphere',
  radial: 'Radial',
  interior: 'Interior',
};

export function Toolbar() {
  const mode = useGraphStore((s) => s.mode);
  const nodeArray = useGraphStore((s) => s.nodeArray);
  const edges = useGraphStore((s) => s.edges);
  const labelFontSize = useGraphStore((s) => s.labelFontSize);
  const setLabelFontSize = useGraphStore((s) => s.setLabelFontSize);
  const showLabels = useGraphStore((s) => s.showLabels);
  const toggleLabels = useGraphStore((s) => s.toggleLabels);
  const replaceGraph = useGraphStore((s) => s.replaceGraph);
  const setOriginalPrompt = useGraphStore((s) => s.setOriginalPrompt);
  const sphereRadius = useGraphStore((s) => s.sphereRadius);
  const [claudeOk, setClaudeOk] = useState<boolean | null>(null);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [keyDraft, setKeyDraft] = useState('');
  const keyInputRef = useRef<HTMLInputElement>(null);
  const t = useT();
  const lang = useLanguageStore((s) => s.lang);

  // API 키 존재 여부 (마스킹 표시용)
  const hasKey = Boolean(getSavedApiKey());

  const handleKeySubmit = useCallback(() => {
    const trimmed = keyDraft.trim();
    if (trimmed) {
      setApiKey(trimmed);
      setKeyDraft('');
      setShowKeyInput(false);
      checkClaudeConnection().then(setClaudeOk);
    }
  }, [keyDraft]);

  const handleDemo = useCallback(() => {
    const { nodes, edges } = loadDemoData(sphereRadius, lang);
    replaceGraph(nodes, edges);
    setOriginalPrompt(t('toolbar.demoPrompt'));
  }, [sphereRadius, replaceGraph, setOriginalPrompt, t, lang]);

  const handleReset = useCallback(() => {
    replaceGraph([], []);
    setOriginalPrompt('');
    useGraphStore.getState().setSynthesizedPrompt('');
    useGraphStore.getState().setResponse('');
  }, [replaceGraph, setOriginalPrompt]);

  useEffect(() => {
    checkClaudeConnection().then(setClaudeOk);
    const interval = setInterval(() => {
      checkClaudeConnection().then(setClaudeOk);
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  const activeNodes = nodeArray.filter((n) => !n.isDeleted).length;
  const activeEdges = Array.from(edges.values()).filter((e) => !e.isDeleted).length;

  return (
    <div style={barStyle}>
      {/* 모드 + Home */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#000' }} />
        <span style={{ fontWeight: 400 }}>{MODE_LABELS[mode] ?? mode}</span>
        <button
          style={smallBtn}
          onClick={() => window.dispatchEvent(new CustomEvent('nodeprompt:go-home'))}
          title="Home (H)"
        >
          Home
        </button>
      </div>

      <div style={divider} />

      {/* 노드/엣지 수 */}
      <span style={{ color: '#666' }}>
        {activeNodes}n · {activeEdges}e
      </span>

      <div style={divider} />

      {/* 글씨 크기 슬라이더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: '#999', fontSize: 10 }}>A</span>
        <input
          type="range"
          min={0.03}
          max={0.15}
          step={0.005}
          value={labelFontSize}
          onChange={(e) => setLabelFontSize(parseFloat(e.target.value))}
          title={`Label size: ${labelFontSize.toFixed(3)}`}
          style={{
            width: 56,
            height: 2,
            appearance: 'none',
            WebkitAppearance: 'none',
            background: 'rgba(0,0,0,0.15)',
            borderRadius: 1,
            outline: 'none',
            cursor: 'pointer',
          }}
        />
        <span style={{ color: '#999', fontSize: 13 }}>A</span>
        <button
          style={{
            ...smallBtn,
            background: showLabels ? '#000' : 'none',
            color: showLabels ? '#fff' : '#666',
            fontSize: 9,
            padding: '1px 5px',
          }}
          onClick={toggleLabels}
          title="Toggle labels (L)"
        >
          Aa
        </button>
      </div>

      <div style={divider} />

      {/* Claude API 상태 + 키 입력 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, position: 'relative' }}>
        <div
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: claudeOk === null ? '#999' : claudeOk ? '#000' : '#c00',
          }}
        />
        <button
          style={{ ...smallBtn, border: 'none', padding: '1px 4px', color: '#666' }}
          onClick={() => {
            setShowKeyInput((v) => !v);
            setTimeout(() => keyInputRef.current?.focus(), 50);
          }}
          title={t('toolbar.apiKeySettings')}
        >
          {claudeOk === null ? '...' : claudeOk ? 'API' : 'offline'}
          {hasKey && ' ****'}
        </button>

        {showKeyInput && (
          <div style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 8,
            background: 'rgba(255,255,255,0.96)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(0,0,0,0.12)',
            borderRadius: 8,
            padding: '10px 12px',
            zIndex: 200,
            width: 280,
            fontFamily: 'inherit',
          }}>
            <div style={{ fontSize: 11, fontWeight: 400, color: '#333', marginBottom: 6 }}>
              Claude API Key
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                ref={keyInputRef}
                type="password"
                placeholder={hasKey ? '••••••••••' : 'sk-ant-...'}
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleKeySubmit(); if (e.key === 'Escape') setShowKeyInput(false); }}
                style={{
                  flex: 1,
                  padding: '4px 8px',
                  fontSize: 11,
                  fontFamily: 'monospace',
                  border: '1px solid rgba(0,0,0,0.12)',
                  borderRadius: 4,
                  outline: 'none',
                  background: 'rgba(0,0,0,0.02)',
                }}
              />
              <button
                onClick={handleKeySubmit}
                style={{ ...smallBtn, background: '#1a1a1a', color: '#fff', padding: '4px 10px' }}
              >
                Save
              </button>
            </div>
            <div style={{ fontSize: 9, color: '#999', marginTop: 4, fontWeight: 300 }}>
              {t('toolbar.keyStorageNote')}
            </div>
          </div>
        )}
      </div>

      <div style={divider} />

      <button
        style={smallBtn}
        onClick={handleReset}
        title="Reset all"
      >
        Reset
      </button>

      <button
        style={{ ...smallBtn, background: '#000', color: '#fff' }}
        onClick={handleDemo}
        title="Demo: 50 nodes, depth 5"
      >
        Demo
      </button>
    </div>
  );
}
