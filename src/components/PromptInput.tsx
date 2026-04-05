import { useState, useCallback, type CSSProperties } from 'react';
import { useGraphStore } from '../store/useGraphStore';
import { scaffoldNodes, fillNodes, validateGraph, createExtractController, cancelRequest } from '../services/claude';
import { mapHierarchicalToSphere } from '../services/mapNodesToSphere';
import { computeBranchingFactor } from '../types/extraction';
import type { NodeData, EdgeData } from '../types';

const containerStyle: CSSProperties = {
  position: 'fixed',
  bottom: 16,
  left: 16,
  width: 380,
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

const textareaStyle: CSSProperties = {
  width: '100%',
  minHeight: 80,
  maxHeight: 200,
  resize: 'vertical',
  background: 'rgba(0,0,0,0.03)',
  border: '1px solid rgba(0,0,0,0.12)',
  borderRadius: 8,
  padding: 10,
  color: '#1a1a1a',
  fontSize: 13,
  fontFamily: 'inherit',
  fontWeight: 300,
  outline: 'none',
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

const sliderRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 11,
  color: '#666',
};

export function PromptInput() {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const isProcessing = useGraphStore((s) => s.isProcessing);
  const replaceGraph = useGraphStore((s) => s.replaceGraph);
  const sphereRadius = useGraphStore((s) => s.sphereRadius);
  const setOriginalPrompt = useGraphStore((s) => s.setOriginalPrompt);
  const setProcessing = useGraphStore((s) => s.setProcessing);
  const extractionConfig = useGraphStore((s) => s.extractionConfig);
  const setExtractionConfig = useGraphStore((s) => s.setExtractionConfig);
  const setExtractionProgress = useGraphStore((s) => s.setExtractionProgress);
  const extractionProgress = useGraphStore((s) => s.extractionProgress);

  const branchingFactor = computeBranchingFactor(extractionConfig.maxNodes, extractionConfig.maxDepth);

  const handleExtract = useCallback(async () => {
    const prompt = text.trim();
    if (!prompt || isProcessing) return;

    setError('');
    setProcessing(true);
    setOriginalPrompt(prompt);

    const controller = createExtractController(300_000);
    const config = { ...extractionConfig, branchingFactor };

    try {
      // ── Phase 1: Scaffold — 구조 설계 ──
      setExtractionProgress({ pass: 1, total: 3, nodesSoFar: 0 });
      const skeleton = await scaffoldNodes(prompt, config, controller.signal);

      const placeholderRaw = skeleton.map((s) => ({
        id: s.id,
        label: '\u00B7',
        type: 'concept' as const,
        weight: 0.5,
        description: '',
        parentId: s.parentId,
        abstractionLevel: s.abstractionLevel,
      }));
      const parentChildEdges = skeleton
        .filter((s) => s.parentId)
        .map((s) => ({
          sourceId: s.parentId!,
          targetId: s.id,
          relation: 'parent-child' as const,
          strength: 0.8,
        }));

      const { nodes, edges } = mapHierarchicalToSphere(
        placeholderRaw, parentChildEdges, sphereRadius, config.maxDepth,
      );
      replaceGraph(nodes, edges);
      setExtractionProgress({ pass: 1, total: 3, nodesSoFar: skeleton.length });

      // ── Phase 2: Fill — 내용 채움 ──
      setExtractionProgress({ pass: 2, total: 3, nodesSoFar: 0 });
      const fills = await fillNodes(prompt, skeleton, controller.signal);

      const store = useGraphStore.getState();
      for (let i = 0; i < fills.length; i++) {
        if (controller.signal.aborted) break;
        const f = fills[i]!;
        store.updateNode(f.id, {
          label: f.label,
          type: f.type as NodeData['type'],
          weight: f.weight,
          description: f.description,
        });
        setExtractionProgress({ pass: 2, total: 3, nodesSoFar: i + 1 });
        if (i < fills.length - 1) await new Promise((r) => setTimeout(r, 40));
      }

      // ── Phase 3: Validate — 검증 및 패치 ──
      setExtractionProgress({ pass: 3, total: 3, nodesSoFar: fills.length });
      try {
        const fullNodes = skeleton.map((s) => {
          const f = fills.find((fi) => fi.id === s.id);
          return {
            id: s.id,
            label: f?.label ?? '\u00B7',
            type: f?.type ?? 'concept',
            weight: f?.weight ?? 0.5,
            parentId: s.parentId,
            abstractionLevel: s.abstractionLevel,
          };
        });
        const validation = await validateGraph(prompt, fullNodes, controller.signal);

        const latestStore = useGraphStore.getState();
        for (const patch of validation.patches) {
          if (controller.signal.aborted) break;
          const updates: Partial<NodeData> = {};
          if (patch.label) updates.label = patch.label;
          if (patch.type) updates.type = patch.type as NodeData['type'];
          if (patch.weight !== undefined) updates.weight = patch.weight;
          if (patch.description) updates.description = patch.description;
          if (Object.keys(updates).length > 0) {
            latestStore.updateNode(patch.id, updates);
            await new Promise((r) => setTimeout(r, 60));
          }
        }

        const nodeIds = new Set(skeleton.map((s) => s.id));
        for (const edge of validation.edges) {
          if (controller.signal.aborted) break;
          if (nodeIds.has(edge.sourceId) && nodeIds.has(edge.targetId)) {
            latestStore.addEdge({
              id: `edge-val-${edge.sourceId}-${edge.targetId}`,
              sourceId: edge.sourceId,
              targetId: edge.targetId,
              relation: edge.relation as EdgeData['relation'],
              strength: edge.strength,
              isUserCreated: false,
              isDeleted: false,
              isHierarchical: false,
              extractionPass: 3,
            });
            await new Promise((r) => setTimeout(r, 30));
          }
        }
      } catch {
        console.warn('Phase 3 (validate) 실패, 기존 그래프 유지');
      }

      // ── Final sweep: 여전히 플레이스홀더인 노드 보정 ──
      {
        const sweepStore = useGraphStore.getState();
        const placeholderPattern = /^(detail|concept|case|theme|sub)\s*[-\s]?\d/i;
        const fallbackPattern = /[—]\s*(핵심 주제|세부 개념|구체적 요소|사례)$/;

        for (const s of skeleton) {
          const node = sweepStore.nodes.get(s.id);
          if (!node) continue;

          const needsFix =
            !node.label || node.label === '\u00B7' ||
            placeholderPattern.test(node.label) ||
            fallbackPattern.test(node.label) ||
            !node.description ||
            node.description.endsWith('(자동 생성)');

          if (needsFix) {
            // 부모/형제 노드의 라벨을 참조하여 컨텍스트 기반 라벨 생성
            const parent = s.parentId ? sweepStore.nodes.get(s.parentId) : null;
            const siblings = skeleton
              .filter((sib) => sib.parentId === s.parentId && sib.id !== s.id)
              .map((sib) => sweepStore.nodes.get(sib.id))
              .filter((n): n is NodeData => !!n && !placeholderPattern.test(n.label) && n.label !== '\u00B7');

            const parentLabel = parent?.label && parent.label !== '\u00B7' && !placeholderPattern.test(parent.label)
              ? parent.label : '';
            const siblingLabels = siblings.slice(0, 3).map((n) => n.label).join(', ');

            const updates: Partial<NodeData> = {};

            if (!node.label || node.label === '\u00B7' || placeholderPattern.test(node.label) || fallbackPattern.test(node.label)) {
              if (parentLabel && siblingLabels) {
                updates.label = `${parentLabel}의 관련 개념`;
              } else if (parentLabel) {
                updates.label = `${parentLabel} — 하위 항목`;
              } else {
                updates.label = `개념 ${s.id.split('-').pop() ?? ''}`.trim();
              }
            }

            if (!node.description || node.description.endsWith('(자동 생성)')) {
              if (parentLabel) {
                updates.description = `${parentLabel}${siblingLabels ? ` (${siblingLabels} 등)` : ''}과 관련된 하위 개념`;
              } else {
                updates.description = `프롬프트 "${prompt.slice(0, 30)}…"에서 추출된 개념`;
              }
            }

            if (Object.keys(updates).length > 0) {
              sweepStore.updateNode(s.id, updates);
            }
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        setError('요청이 취소되었습니다.');
      } else {
        setError((e as Error).message);
      }
    } finally {
      setProcessing(false);
      setExtractionProgress(null);
    }
  }, [text, isProcessing, sphereRadius, replaceGraph, setOriginalPrompt, setProcessing, extractionConfig, branchingFactor, setExtractionProgress]);

  const handleCancel = useCallback(() => {
    cancelRequest();
    setProcessing(false);
    setExtractionProgress(null);
  }, [setProcessing, setExtractionProgress]);

  return (
    <div style={containerStyle}>
      <div style={{ fontSize: 11, color: '#999', fontWeight: 400, letterSpacing: '0.05em' }}>PROMPT</div>
      <textarea
        style={textareaStyle}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="프롬프트를 입력하세요..."
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleExtract();
          }
        }}
      />

      {/* D/N 슬라이더 */}
      <div style={sliderRow}>
        <span style={{ width: 50 }}>깊이 D:{extractionConfig.maxDepth}</span>
        <input
          type="range" min={1} max={5} step={1}
          value={extractionConfig.maxDepth}
          onChange={(e) => setExtractionConfig({ maxDepth: parseInt(e.target.value) })}
          style={{ flex: 1, height: 2, appearance: 'none', WebkitAppearance: 'none', background: 'rgba(0,0,0,0.15)', borderRadius: 1, outline: 'none', cursor: 'pointer' }}
        />
      </div>
      <div style={sliderRow}>
        <span style={{ width: 50 }}>노드 N:{extractionConfig.maxNodes}</span>
        <input
          type="range" min={5} max={100} step={1}
          value={extractionConfig.maxNodes}
          onChange={(e) => setExtractionConfig({ maxNodes: parseInt(e.target.value) })}
          style={{ flex: 1, height: 2, appearance: 'none', WebkitAppearance: 'none', background: 'rgba(0,0,0,0.15)', borderRadius: 1, outline: 'none', cursor: 'pointer' }}
        />
        <span style={{ color: '#999', fontSize: 10 }}>분기:{branchingFactor}</span>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {isProcessing ? (
          <button style={{ ...btnStyle, background: '#c00', color: '#fff', flex: 1 }} onClick={handleCancel}>
            취소
          </button>
        ) : (
          <button
            style={{ ...btnStyle, background: text.trim() ? '#000' : '#ccc', color: '#fff', flex: 1, opacity: text.trim() ? 1 : 0.5 }}
            onClick={handleExtract}
            disabled={!text.trim()}
          >
            분석 (Ctrl+Enter)
          </button>
        )}
      </div>

      {extractionProgress && (
        <div style={{ fontSize: 12, color: '#666' }}>
          Phase {extractionProgress.pass}/{extractionProgress.total}
          {' — '}
          {extractionProgress.pass === 1 && '구조 설계'}
          {extractionProgress.pass === 2 && `내용 채움${extractionProgress.nodesSoFar > 0 ? ` (${extractionProgress.nodesSoFar}/${extractionConfig.maxNodes})` : ''}`}
          {extractionProgress.pass === 3 && '검증 및 패치'}
        </div>
      )}
      {error && (
        <div style={{ fontSize: 12, color: '#c00', wordBreak: 'break-word' }}>{error}</div>
      )}
    </div>
  );
}
