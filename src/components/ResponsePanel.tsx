import { useState, useCallback, useRef, useMemo, useEffect, type CSSProperties } from 'react';
import { useGraphStore } from '../store/useGraphStore';
import { synthesizePromptSegments } from '../services/synthesizer';
import { flattenSegments, type SynthesisSegment, type NodeData } from '../types';
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
      return { display: 'inline', fontWeight: 500, color: '#000', letterSpacing: '0.02em' };
    case 'original':
      return { fontStyle: 'italic', color: '#555' };
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
      return { cursor: 'pointer', textDecoration: 'line-through', opacity: 0.5 };
    case 'instruction':
      return { display: 'inline-block', borderLeft: '2px solid #000', paddingLeft: 6, marginLeft: 2, color: '#333' };
    default:
      return {};
  }
}

const INTERACTIVE_KINDS: ReadonlySet<SynthesisSegment['kind']> = new Set([
  'hierarchy-node',
  'cross-edge',
  'excluded',
]);

type ResponseToken = { kind: 'sentence' | 'break'; text: string };

/**
 * 응답 텍스트를 문장과 개행 블록으로 분해.
 * `.`, `!`, `?`, `。` 뒤 공백을 문장 경계로 보고, 개행은 별도 토큰으로 보존.
 * whiteSpace: pre-wrap 레이아웃 유지가 목적.
 */
function tokenizeResponse(text: string): ResponseToken[] {
  if (!text) return [];
  const tokens: ResponseToken[] = [];
  const lines = text.split(/(\n+)/);
  for (const line of lines) {
    if (line.length === 0) continue;
    if (/^\n+$/.test(line)) {
      tokens.push({ kind: 'break', text: line });
      continue;
    }
    const re = /[^.!?。]*[.!?。]+\s*|[^.!?。]+$/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      if (m[0].length === 0) break;
      tokens.push({ kind: 'sentence', text: m[0] });
    }
  }
  return tokens;
}

function findNodeIdsInText(text: string, nodes: NodeData[]): string[] {
  const active = nodes.filter((n) => !n.isDeleted && n.label.length >= 2);
  if (active.length === 0) return [];
  const lower = text.toLowerCase();
  const matched: string[] = [];
  // 긴 라벨 우선 — 포함 관계로 인한 중복 허용 (Set로 dedupe)
  const sorted = [...active].sort((a, b) => b.label.length - a.label.length);
  const seen = new Set<string>();
  for (const n of sorted) {
    if (seen.has(n.id)) continue;
    if (lower.includes(n.label.toLowerCase())) {
      matched.push(n.id);
      seen.add(n.id);
    }
  }
  return matched;
}

export function ResponsePanel() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSynthesized, setShowSynthesized] = useState(false);
  const [clickedSentenceIdx, setClickedSentenceIdx] = useState<number | null>(null);
  const [clickedSegmentIdx, setClickedSegmentIdx] = useState<number | null>(null);
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

  const responseTokens = useMemo<ResponseToken[]>(
    () => tokenizeResponse(response),
    [response],
  );

  // 새 답변 생성 시작 시 클릭 상태 리셋
  useEffect(() => {
    if (response === '') {
      setClickedSentenceIdx(null);
      setHoveredProvenance(null);
    }
  }, [response, setHoveredProvenance]);

  // 뷰 전환 시 provenance 정리 — 서로 다른 채널이 상태를 흘리지 않게
  useEffect(() => {
    setClickedSentenceIdx(null);
    setClickedSegmentIdx(null);
    setHoveredProvenance(null);
  }, [showSynthesized, setHoveredProvenance]);

  // 그래프가 재추출/변경되면 세그먼트 인덱스가 무효화됨
  useEffect(() => {
    setClickedSegmentIdx(null);
  }, [segments]);

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

  const handleSegmentClick = useCallback(
    (idx: number, seg: SynthesisSegment) => {
      if (isGenerating) return;
      if (!INTERACTIVE_KINDS.has(seg.kind)) return;
      if (seg.provenance.nodeIds.length === 0 && seg.provenance.edgeIds.length === 0) return;
      if (clickedSegmentIdx === idx) {
        setClickedSegmentIdx(null);
        setHoveredProvenance(null);
        return;
      }
      setClickedSegmentIdx(idx);
      setHoveredProvenance({
        nodeIds: seg.provenance.nodeIds,
        edgeIds: seg.provenance.edgeIds,
        kind: 'text',
      });
    },
    [clickedSegmentIdx, isGenerating, setHoveredProvenance],
  );

  const handleSynthBgClick = useCallback(() => {
    if (clickedSegmentIdx !== null) {
      setClickedSegmentIdx(null);
      setHoveredProvenance(null);
    }
  }, [clickedSegmentIdx, setHoveredProvenance]);

  const handleSentenceClick = useCallback(
    (idx: number, text: string) => {
      if (isGenerating) return;
      if (clickedSentenceIdx === idx) {
        setClickedSentenceIdx(null);
        setHoveredProvenance(null);
        return;
      }
      const nodeIds = findNodeIdsInText(text, nodeArray);
      if (nodeIds.length === 0) {
        // 이 문장은 참조된 개념이 없음 — 현재 선택은 유지
        return;
      }
      setClickedSentenceIdx(idx);
      setHoveredProvenance({ nodeIds, edgeIds: [], kind: 'text' });
    },
    [clickedSentenceIdx, isGenerating, nodeArray, setHoveredProvenance],
  );

  const handleResponseBgClick = useCallback(() => {
    if (clickedSentenceIdx !== null) {
      setClickedSentenceIdx(null);
      setHoveredProvenance(null);
    }
  }, [clickedSentenceIdx, setHoveredProvenance]);

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
          <div style={synthesizedBoxStyle} onClick={handleSynthBgClick}>
            {segments.map((seg, i) => {
              const interactive = INTERACTIVE_KINDS.has(seg.kind);
              const baseStyle = segmentStyle(seg);
              if (!interactive) {
                return (
                  <span key={i} style={baseStyle}>
                    {seg.text}
                  </span>
                );
              }
              const isActive = clickedSegmentIdx === i;
              return (
                <span
                  key={i}
                  style={{
                    ...baseStyle,
                    background: isActive ? 'rgba(0,0,0,0.08)' : 'transparent',
                    borderRadius: 3,
                    padding: '1px 2px',
                    margin: '0 -2px',
                    transition: 'background 0.25s ease',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSegmentClick(i, seg);
                  }}
                >
                  {seg.text}
                </span>
              );
            })}
          </div>
        </>
      ) : (
        <div style={responseStyle} onClick={handleResponseBgClick}>
          {responseTokens.length === 0 ? (
            <span style={{ color: '#999' }}>{t('resp.placeholder')}</span>
          ) : (
            responseTokens.map((tok, i) => {
              if (tok.kind === 'break') {
                return <span key={i}>{tok.text}</span>;
              }
              const isActive = clickedSentenceIdx === i;
              return (
                <span
                  key={i}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSentenceClick(i, tok.text);
                  }}
                  style={{
                    cursor: 'pointer',
                    background: isActive ? 'rgba(0,0,0,0.07)' : 'transparent',
                    borderRadius: 3,
                    padding: '1px 2px',
                    margin: '0 -2px',
                    transition: 'background 0.25s ease',
                  }}
                >
                  {highlightConcepts(tok.text, nodeArray)}
                </span>
              );
            })
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        {isGenerating ? (
          <button style={{ ...btnStyle, background: '#c00', color: '#fff', flex: 1 }} onClick={handleCancel}>
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

      {isGenerating && <div style={{ fontSize: 12, color: '#666' }}>{t('resp.generating')}</div>}
    </div>
  );
}
