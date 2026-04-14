import { useState, useEffect, useCallback, useRef, type CSSProperties } from 'react';
import { useGraphStore } from '../store/useGraphStore';
import { checkClaudeConnection } from '../services/claude';
import {
  getActiveProviderId, setActiveProviderId,
  setProviderKey, hasProviderKey,
} from '../services/llm/registry';
import { PROVIDER_CATALOG, PROVIDER_ORDER } from '../services/llm/catalog';
import { ProviderLogo } from '../services/llm/logos';
import type { ProviderId } from '../services/llm/types';
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
  const [showProviderMenu, setShowProviderMenu] = useState(false);
  const [showProviderNote, setShowProviderNote] = useState(false);
  const [activeProvider, setActiveProvider] = useState<ProviderId>(() => getActiveProviderId());
  const [keyDraft, setKeyDraft] = useState('');
  const [keyVersion, setKeyVersion] = useState(0); // key 저장 후 hasKey 재계산 트리거
  const keyInputRef = useRef<HTMLInputElement>(null);
  const t = useT();
  const lang = useLanguageStore((s) => s.lang);

  const activeMeta = PROVIDER_CATALOG[activeProvider];
  // 현재 활성 프로바이더에 키가 저장되어 있는지
  void keyVersion;
  const hasKey = hasProviderKey(activeProvider);

  const handleKeySubmit = useCallback(() => {
    const trimmed = keyDraft.trim();
    if (trimmed) {
      setProviderKey(activeProvider, trimmed);
      setKeyDraft('');
      setShowKeyInput(false);
      setKeyVersion((v) => v + 1);
      checkClaudeConnection().then(setClaudeOk);
    }
  }, [keyDraft, activeProvider]);

  const handleProviderPick = useCallback((id: ProviderId) => {
    setActiveProviderId(id);
    setActiveProvider(id);
    setShowProviderMenu(false);
    setClaudeOk(null);
    // 선택한 프로바이더가 note를 가지면 안내 팝업 표시, 없으면 숨김
    setShowProviderNote(Boolean(PROVIDER_CATALOG[id].note));
    checkClaudeConnection().then(setClaudeOk);
  }, []);

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

      {/* Provider 선택 + API 상태 + 키 입력 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
        <div
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: claudeOk === null ? '#999' : claudeOk ? '#000' : '#c00',
            flexShrink: 0,
          }}
        />

        {/* 프로바이더 드롭다운 (로고 + 이름) */}
        <button
          style={{
            ...smallBtn,
            border: '1px solid rgba(0,0,0,0.12)',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '2px 7px',
            color: '#1a1a1a',
          }}
          onClick={() => { setShowProviderMenu((v) => !v); setShowKeyInput(false); setShowProviderNote(false); }}
          title="Select LLM provider"
        >
          <ProviderLogo provider={activeProvider} size={11} />
          <span style={{ fontWeight: 400 }}>{activeMeta.short}</span>
          <span style={{ color: '#999', fontSize: 8 }}>▾</span>
        </button>

        {/* 모델별 추가 인증/활성화가 필요한 프로바이더 안내 팝업 */}
        {showProviderNote && activeMeta.note && !showProviderMenu && (
          <div
            onClick={() => setShowProviderNote(false)}
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 8,
              background: 'rgba(255,255,255,0.96)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(0,0,0,0.12)',
              borderRadius: 8,
              padding: '8px 10px',
              zIndex: 199,
              width: 240,
              fontFamily: 'inherit',
              fontSize: 10,
              lineHeight: 1.45,
              color: '#333',
              fontWeight: 300,
              cursor: 'pointer',
              display: 'flex',
              gap: 6,
              alignItems: 'flex-start',
            }}
            title="Click to dismiss"
          >
            <div style={{
              flexShrink: 0,
              width: 12,
              height: 12,
              borderRadius: '50%',
              border: '1px solid #000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 8,
              fontWeight: 400,
              marginTop: 1,
            }}>
              !
            </div>
            <div style={{ flex: 1 }}>
              {lang === 'ko' ? activeMeta.note.ko : activeMeta.note.en}
            </div>
          </div>
        )}

        {showProviderMenu && (
          <div style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 8,
            background: 'rgba(255,255,255,0.96)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(0,0,0,0.12)',
            borderRadius: 8,
            padding: '4px 0',
            zIndex: 200,
            width: 180,
            fontFamily: 'inherit',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {PROVIDER_ORDER.map((pid) => {
              const meta = PROVIDER_CATALOG[pid];
              const selected = pid === activeProvider;
              const hasPkey = hasProviderKey(pid);
              return (
                <button
                  key={pid}
                  onClick={() => handleProviderPick(pid)}
                  style={{
                    background: selected ? 'rgba(0,0,0,0.06)' : 'transparent',
                    border: 'none',
                    textAlign: 'left',
                    padding: '6px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 11,
                    color: '#1a1a1a',
                    fontFamily: 'inherit',
                    fontWeight: selected ? 400 : 300,
                    cursor: 'pointer',
                  }}
                >
                  <ProviderLogo provider={pid} size={12} />
                  <span style={{ flex: 1 }}>{meta.short}</span>
                  <span style={{
                    fontSize: 8,
                    color: hasPkey ? '#000' : '#bbb',
                    fontWeight: 300,
                  }}>
                    {hasPkey ? '●' : '○'}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* 키 입력 토글 */}
        <button
          style={{ ...smallBtn, border: 'none', padding: '1px 4px', color: '#666' }}
          onClick={() => {
            setShowKeyInput((v) => !v);
            setShowProviderMenu(false);
            setShowProviderNote(false);
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
            <div style={{
              fontSize: 11,
              fontWeight: 400,
              color: '#333',
              marginBottom: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <ProviderLogo provider={activeProvider} size={11} />
              {activeMeta.label} API Key
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                ref={keyInputRef}
                type="password"
                placeholder={hasKey ? '••••••••••' : activeMeta.keyHint}
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
