import { useState, useCallback, useRef, useMemo, type CSSProperties } from 'react';
import { useGraphStore } from '../store/useGraphStore';
import { synthesizePromptSegments } from '../services/synthesizer';
import { flattenSegments, type SynthesisSegment } from '../types';
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

const synthesizedBoxStyle: CSSProperties = {
  ...responseStyle,
  color: '#333',
  fontSize: 11.5,
  lineHeight: 1.7,
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

function segmentStyle(seg: SynthesisSegment): CSSProperties {
  switch (seg.kind) {
    case 'heading':
      return {
        display: 'inline',
        fontWeight: 500,
        color: '#000',
        letterSpacing: '0.02em',
      };
    case 'original':
      return {
        fontStyle: 'italic',
        color: '#555',
      };
    case 'hierarchy-node': {
      const w = seg.provenance.weight ?? 0.5;
      const thickness = Math.max(0.4, w * 1.4);
      return {
        cursor: 'pointer',
        textDecoration: 'underline',
        textDecorationColor: '#000',
        textDecorationThickness: `${thickness}px`,
        textUnderlineOffset: '3px',
      };
    }
    case 'cross-edge':
      return {
        cursor: 'pointer',
        textDecoration: 'underline dashed',
        textDecorationThickness: '0.8px',
        textUnderlineOffset: '3px',
      };
    case 'excluded':
      return {
        cursor: 'pointer',
        textDecoration: 'line-through',
        opacity: 0.5,
      };
    case 'instruction':
      return {
        display: 'inline-block',
        borderLeft: '2px solid #000',
        paddingLeft: 6,
        marginLeft: 2,
        color: '#333',
      };
    default:
      return {};
  }
}

const INTERACTIVE_KINDS: ReadonlySet<SynthesisSegment['kind']> = new Set([
  'hierarchy-node',
  'cross-edge',
  'excluded',
]);

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
  const setSynthesisSegments = useGraphStore((s) => s.setSynthesisSegments);
  const setHoveredProvenance = useGraphStore((s) => s.setHoveredProvenance);

  const segments = useMemo<SynthesisSegment[]>(() => {
    if (!originalPrompt) return [];
    return synthesizePromptSegments(originalPrompt, nodeArray, Array.from(edges.values()));
  }, [originalPrompt, nodeArray, edges]);

  const handleGenerate = useCallback(async () => {
    if (isGenerating || !originalPrompt || nodeArray.length === 0) return;

    const segs = synthesizePromptSegments(originalPrompt, nodeArray, Array.from(edges.values()));
    const synth = flattenSegments(segs);
    setSynthesizedPrompt(synth);
    setSynthesisSegments(segs);
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
  }, [isGenerating, originalPrompt, nodeArray, edges, setResponse, setSynthesizedPrompt, setSynthesisSegments, t]);

  const handleCancel = useCallback(() => {
    cancelRequest();
    setIsGenerating(false);
  }, []);

  const handleSegmentEnter = useCallback(
    (seg: SynthesisSegment) => {
      if (isGenerating) return;
      if (!INTERACTIVE_KINDS.has(seg.kind)) return;
      if (seg.provenance.nodeIds.length === 0 && seg.provenance.edgeIds.length === 0) return;
      setHoveredProvenance({
        nodeIds: seg.provenance.nodeIds,
        edgeIds: seg.provenance.edgeIds,
        kind: 'text',
      });
    },
    [isGenerating, setHoveredProvenance],
  );

  const handleSegmentLeave = useCallback(() => {
    setHoveredProvenance(null);
  }, [setHoveredProvenance]);

  const canGenerate = Boolean(originalPrompt) && nodeArray.length > 0;

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
        <>
          <div style={{ fontSize: 10, color: '#888', fontWeight: 300, letterSpacing: '0.02em', margin: '0 2px' }}>
            {t('resp.diffHint')}
          </div>
          <div style={synthesizedBoxStyle} onMouseLeave={handleSegmentLeave}>
            {segments.map((seg, i) => {
              const interactive = INTERACTIVE_KINDS.has(seg.kind);
              const style = segmentStyle(seg);
              if (!interactive) {
                return (
                  <span key={i} style={style}>
                    {seg.text}
                  </span>
                );
              }
              return (
                <span
                  key={i}
                  style={style}
                  onMouseEnter={() => handleSegmentEnter(seg)}
                >
                  {seg.text}
                </span>
              );
            })}
          </div>
        </>
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
              background: canGenerate ? '#000' : '#ccc',
              color: '#fff',
              flex: 1,
              opacity: canGenerate ? 1 : 0.5,
            }}
            onClick={handleGenerate}
            disabled={!canGenerate}
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
