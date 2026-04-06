import { useState, useCallback, useRef, type CSSProperties } from 'react';
import { useGraphStore } from '../store/useGraphStore';
import { synthesizePrompt } from '../services/synthesizer';
import { streamResponse, cancelRequest } from '../services/claude';
import { detectLanguage } from '../services/prompts';
import { highlightConcepts } from '../utils/highlightConcepts';
import { useT } from '../i18n/useLanguage';

const containerStyle: CSSProperties = {
  position: 'fixed',
  bottom: 16,
  right: 16,
  width: 420,
  maxHeight: '60vh',
  background: 'rgba(255,255,255,0.9)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(0,0,0,0.1)',
  borderRadius: 12,
  padding: 16,
  zIndex: 100,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  fontFamily: '"DM Sans", "IBM Plex Sans", sans-serif',
};

const responseStyle: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  color: '#1a1a1a',
  fontSize: 13,
  lineHeight: 1.7,
  fontWeight: 300,
  whiteSpace: 'pre-wrap',
  maxHeight: '40vh',
  padding: 8,
  background: 'rgba(0,0,0,0.02)',
  borderRadius: 8,
};

const btnStyle: CSSProperties = {
  padding: '8px 16px',
  borderRadius: 8,
  border: 'none',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 400,
  fontFamily: 'inherit',
};

export function ResponsePanel() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSynthesized, setShowSynthesized] = useState(false);
  const lastUpdateRef = useRef(0);
  const t = useT();

  const originalPrompt = useGraphStore((s) => s.originalPrompt);
  const nodeArray = useGraphStore((s) => s.nodeArray);
  const edges = useGraphStore((s) => s.edges);
  const response = useGraphStore((s) => s.response);
  const setResponse = useGraphStore((s) => s.setResponse);
  const setSynthesizedPrompt = useGraphStore((s) => s.setSynthesizedPrompt);

  const handleGenerate = useCallback(async () => {
    if (isGenerating || !originalPrompt || nodeArray.length === 0) return;

    const edgeArray = Array.from(edges.values());
    const synth = synthesizePrompt(originalPrompt, nodeArray, edgeArray);
    setSynthesizedPrompt(synth);
    const lang = detectLanguage(originalPrompt);

    setIsGenerating(true);
    setResponse('');

    let buffer = '';
    try {
      for await (const chunk of streamResponse(synth, lang)) {
        buffer += chunk;
        const now = Date.now();
        if (now - lastUpdateRef.current > 50) {
          setResponse(buffer);
          lastUpdateRef.current = now;
        }
      }
      setResponse(buffer);
    } catch (e) {
      setResponse(buffer + `\n\n[${t('resp.error')}: ${(e as Error).message}]`);
    } finally {
      setIsGenerating(false);
    }
  }, [isGenerating, originalPrompt, nodeArray, edges, setResponse, setSynthesizedPrompt, t]);

  const handleCancel = useCallback(() => {
    cancelRequest();
    setIsGenerating(false);
  }, []);

  if (!originalPrompt) return null;

  const synthesized = synthesizePrompt(originalPrompt, nodeArray, Array.from(edges.values()));

  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: '#999', fontWeight: 400, letterSpacing: '0.05em' }}>RESPONSE</span>
        <button
          style={{ fontSize: 10, color: '#666', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          onClick={() => setShowSynthesized((v) => !v)}
        >
          {showSynthesized ? t('resp.viewResponse') : t('resp.viewSynthesized')}
        </button>
      </div>

      {showSynthesized ? (
        <div style={{ ...responseStyle, color: '#666', fontSize: 11 }}>{synthesized}</div>
      ) : (
        <div style={responseStyle}>
          {response
            ? highlightConcepts(response, nodeArray)
            : t('resp.placeholder')}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        {isGenerating ? (
          <button
            style={{ ...btnStyle, background: '#c00', color: '#fff', flex: 1 }}
            onClick={handleCancel}
          >
            {t('resp.cancel')}
          </button>
        ) : (
          <button
            style={{
              ...btnStyle,
              background: nodeArray.length > 0 ? '#000' : '#ccc',
              color: '#fff',
              flex: 1,
              opacity: nodeArray.length > 0 ? 1 : 0.5,
            }}
            onClick={handleGenerate}
            disabled={nodeArray.length === 0}
          >
            {t('resp.generate')}
          </button>
        )}
      </div>

      {isGenerating && (
        <div style={{ fontSize: 12, color: '#666' }}>{t('resp.generating')}</div>
      )}
    </div>
  );
}
