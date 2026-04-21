import { useState, useCallback, useRef, type CSSProperties, type DragEvent } from 'react';
import { useGraphStore } from '../store/useGraphStore';
import { scaffoldNodes, fillNodes, validateGraph, createExtractController, cancelRequest } from '../services/claude';
import { mapHierarchicalToSphere } from '../services/mapNodesToSphere';
import { computeBranchingFactor } from '../types/extraction';
import type { NodeData, EdgeData } from '../types';
import { useT } from '../i18n/useLanguage';
import { getActiveProviderId, providerSupports } from '../services/llm/registry';
import { PROVIDER_CATALOG } from '../services/llm/catalog';
import type { Attachment } from '../services/llm/types';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PDF_BYTES = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

type AttachmentItem = Attachment & {
  id: string;
  sizeBytes: number;
  previewUrl?: string; // 이미지만
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // "data:image/png;base64,xxxxx" → "xxxxx"
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

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
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isProcessing = useGraphStore((s) => s.isProcessing);
  const replaceGraph = useGraphStore((s) => s.replaceGraph);
  const sphereRadius = useGraphStore((s) => s.sphereRadius);
  const setOriginalPrompt = useGraphStore((s) => s.setOriginalPrompt);
  const setProcessing = useGraphStore((s) => s.setProcessing);
  const extractionConfig = useGraphStore((s) => s.extractionConfig);
  const setExtractionConfig = useGraphStore((s) => s.setExtractionConfig);
  const setExtractionProgress = useGraphStore((s) => s.setExtractionProgress);
  const extractionProgress = useGraphStore((s) => s.extractionProgress);
  const t = useT();

  const branchingFactor = computeBranchingFactor(extractionConfig.maxNodes, extractionConfig.maxDepth);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    setError('');
    const providerId = getActiveProviderId();
    const providerLabel = PROVIDER_CATALOG[providerId].label;
    const supports = providerSupports(providerId);
    const next: AttachmentItem[] = [];

    for (const file of Array.from(files)) {
      const isImage = ACCEPTED_IMAGE_TYPES.includes(file.type);
      const isPdf = file.type === 'application/pdf';

      if (!isImage && !isPdf) {
        setError(t('prompt.attach.unsupportedType'));
        continue;
      }
      if (isImage && !supports.image) {
        setError(t('prompt.attach.providerNoImage').replace('{provider}', providerLabel));
        continue;
      }
      if (isPdf && !supports.pdf) {
        setError(t('prompt.attach.providerNoPdf').replace('{provider}', providerLabel));
        continue;
      }

      const maxBytes = isImage ? MAX_IMAGE_BYTES : MAX_PDF_BYTES;
      if (file.size > maxBytes) {
        setError(t('prompt.attach.tooLarge').replace('{max}', String(Math.round(maxBytes / (1024 * 1024)))));
        continue;
      }

      try {
        const base64 = await fileToBase64(file);
        const id = `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        if (isImage) {
          next.push({
            id, kind: 'image', mimeType: file.type, dataBase64: base64,
            name: file.name, sizeBytes: file.size,
            previewUrl: URL.createObjectURL(file),
          });
        } else {
          next.push({
            id, kind: 'pdf', mimeType: 'application/pdf', dataBase64: base64,
            name: file.name, sizeBytes: file.size,
          });
        }
      } catch (e) {
        console.warn('파일 읽기 실패:', e);
      }
    }
    if (next.length > 0) setAttachments((prev) => [...prev, ...next]);
  }, [t]);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) void addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const providerId = getActiveProviderId();
  const supports = providerSupports(providerId);
  const acceptAttr = [
    ...(supports.image ? ACCEPTED_IMAGE_TYPES : []),
    ...(supports.pdf ? ['application/pdf'] : []),
  ].join(',');

  const handleExtract = useCallback(async () => {
    const prompt = text.trim();
    const hasAttachments = attachments.length > 0;
    // 텍스트나 첨부 둘 중 하나는 있어야 함.
    if ((!prompt && !hasAttachments) || isProcessing) return;

    setError('');
    setProcessing(true);
    setOriginalPrompt(prompt || (hasAttachments ? '[multimodal input]' : ''));

    // Provider에 넘길 순수 Attachment 배열 (UI용 필드 제거).
    const attachmentsForApi: Attachment[] = attachments.map((a) =>
      a.kind === 'image'
        ? { kind: 'image', mimeType: a.mimeType, dataBase64: a.dataBase64, name: a.name }
        : { kind: 'pdf', mimeType: 'application/pdf', dataBase64: a.dataBase64, name: a.name },
    );
    // 텍스트가 비어있으면 추출 프롬프트에 placeholder 문구 전달.
    const effectivePrompt = prompt || 'Extract concepts from the attached file(s).';

    const controller = createExtractController(300_000);
    const config = { ...extractionConfig, branchingFactor };

    try {
      // ── Phase 1: Scaffold ──
      setExtractionProgress({ pass: 1, total: 3, nodesSoFar: 0 });
      const skeleton = await scaffoldNodes(effectivePrompt, config, controller.signal, attachmentsForApi);

      const placeholderRaw = skeleton.map((s) => ({
        id: s.id,
        label: '\u00B7',
        type: 'ens' as const,
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

      // ── Phase 2: Fill ──
      setExtractionProgress({ pass: 2, total: 3, nodesSoFar: 0 });
      const fills = await fillNodes(effectivePrompt, skeleton, controller.signal, attachmentsForApi);

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

      // ── Phase 3: Validate ──
      setExtractionProgress({ pass: 3, total: 3, nodesSoFar: fills.length });
      try {
        const fullNodes = skeleton.map((s) => {
          const f = fills.find((fi) => fi.id === s.id);
          return {
            id: s.id,
            label: f?.label ?? '\u00B7',
            type: f?.type ?? 'ens',
            weight: f?.weight ?? 0.5,
            parentId: s.parentId,
            abstractionLevel: s.abstractionLevel,
          };
        });
        const validation = await validateGraph(effectivePrompt, fullNodes, controller.signal, attachmentsForApi);

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
        console.warn('Phase 3 (validate) failed, keeping existing graph');
      }

      // ── Final sweep ──
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
                updates.description = `프롬프트 "${effectivePrompt.slice(0, 30)}…"에서 추출된 개념`;
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
        setError(t('prompt.cancelled'));
      } else {
        setError((e as Error).message);
      }
    } finally {
      setProcessing(false);
      setExtractionProgress(null);
    }
  }, [text, attachments, isProcessing, sphereRadius, replaceGraph, setOriginalPrompt, setProcessing, extractionConfig, branchingFactor, setExtractionProgress, t]);

  const handleCancel = useCallback(() => {
    cancelRequest();
    setProcessing(false);
    setExtractionProgress(null);
  }, [setProcessing, setExtractionProgress]);

  const canAttach = supports.image || supports.pdf;
  const dropzoneStyle: CSSProperties = {
    border: `1px dashed ${dragOver ? '#000' : 'rgba(0,0,0,0.2)'}`,
    borderRadius: 8,
    padding: 8,
    fontSize: 11,
    color: canAttach ? '#666' : '#bbb',
    textAlign: 'center',
    cursor: canAttach ? 'pointer' : 'not-allowed',
    background: dragOver ? 'rgba(0,0,0,0.04)' : 'transparent',
    transition: 'background 0.15s ease, border-color 0.15s ease',
  };

  return (
    <div
      style={containerStyle}
      onDragOver={(e) => {
        if (!canAttach) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={canAttach ? handleDrop : undefined}
    >
      <div style={{ fontSize: 11, color: '#999', fontWeight: 400, letterSpacing: '0.05em' }}>PROMPT</div>
      <textarea
        style={textareaStyle}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('prompt.placeholder')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleExtract();
          }
        }}
      />

      {/* 첨부 드롭존 */}
      <div
        style={dropzoneStyle}
        onClick={() => canAttach && fileInputRef.current?.click()}
        title={canAttach ? undefined : PROVIDER_CATALOG[providerId].label}
      >
        {canAttach
          ? t('prompt.attach.drop')
          : `${PROVIDER_CATALOG[providerId].label} — ${t('prompt.attach.providerNoImage').replace('{provider}', '').replace(/^\s*—\s*/, '')}`}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptAttr}
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files) void addFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {/* 첨부 칩 리스트 */}
      {attachments.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {attachments.map((a) => (
            <div
              key={a.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 8px', borderRadius: 6,
                background: 'rgba(0,0,0,0.05)', fontSize: 11, color: '#333',
                maxWidth: '100%',
              }}
            >
              {a.kind === 'image' && a.previewUrl && (
                <img
                  src={a.previewUrl}
                  alt=""
                  style={{ width: 20, height: 20, borderRadius: 3, objectFit: 'cover' }}
                />
              )}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
                {a.kind === 'pdf' ? '📄 ' : ''}{a.name ?? a.kind}
              </span>
              <button
                onClick={() => removeAttachment(a.id)}
                style={{
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  color: '#999', fontSize: 14, padding: 0, lineHeight: 1,
                }}
                aria-label={t('prompt.attach.remove')}
              >×</button>
            </div>
          ))}
        </div>
      )}

      {/* D/N 슬라이더 */}
      <div style={sliderRow}>
        <span style={{ width: 50 }}>{t('prompt.depth')} D:{extractionConfig.maxDepth}</span>
        <input
          type="range" min={1} max={5} step={1}
          value={extractionConfig.maxDepth}
          onChange={(e) => setExtractionConfig({ maxDepth: parseInt(e.target.value) })}
          style={{ flex: 1, height: 2, appearance: 'none', WebkitAppearance: 'none', background: 'rgba(0,0,0,0.15)', borderRadius: 1, outline: 'none', cursor: 'pointer' }}
        />
      </div>
      <div style={sliderRow}>
        <span style={{ width: 50 }}>{t('prompt.nodes')} N:{extractionConfig.maxNodes}</span>
        <input
          type="range" min={5} max={100} step={1}
          value={extractionConfig.maxNodes}
          onChange={(e) => setExtractionConfig({ maxNodes: parseInt(e.target.value) })}
          style={{ flex: 1, height: 2, appearance: 'none', WebkitAppearance: 'none', background: 'rgba(0,0,0,0.15)', borderRadius: 1, outline: 'none', cursor: 'pointer' }}
        />
        <span style={{ color: '#999', fontSize: 10 }}>{t('prompt.branch')}:{branchingFactor}</span>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {isProcessing ? (
          <button style={{ ...btnStyle, background: '#c00', color: '#fff', flex: 1 }} onClick={handleCancel}>
            {t('prompt.cancel')}
          </button>
        ) : (() => {
          const canSubmit = Boolean(text.trim()) || attachments.length > 0;
          return (
            <button
              style={{ ...btnStyle, background: canSubmit ? '#000' : '#ccc', color: '#fff', flex: 1, opacity: canSubmit ? 1 : 0.5 }}
              onClick={handleExtract}
              disabled={!canSubmit}
            >
              {t('prompt.analyze')}
            </button>
          );
        })()}
      </div>

      {extractionProgress && (
        <div style={{ fontSize: 12, color: '#666' }}>
          Phase {extractionProgress.pass}/{extractionProgress.total}
          {' — '}
          {extractionProgress.pass === 1 && t('prompt.phase1')}
          {extractionProgress.pass === 2 && `${t('prompt.phase2')}${extractionProgress.nodesSoFar > 0 ? ` (${extractionProgress.nodesSoFar}/${extractionConfig.maxNodes})` : ''}`}
          {extractionProgress.pass === 3 && t('prompt.phase3')}
        </div>
      )}
      {error && (
        <div style={{ fontSize: 12, color: '#c00', wordBreak: 'break-word' }}>{error}</div>
      )}
    </div>
  );
}
