import { useEffect, useCallback, useState, type CSSProperties } from 'react';
import type { NodeType } from '../types';
import { useGraphStore } from '../store/useGraphStore';
import { PATTERN_CSS } from '../utils/nodePatterns';
import { useHistoryStore } from '../store/useHistoryStore';

const NODE_TYPES: NodeType[] = ['concept', 'nuance', 'mood', 'philosophy', 'abstraction', 'context'];

interface MenuState {
  visible: boolean;
  x: number;
  y: number;
  targetNodeId: string | null;
  targetEdgeId: string | null;
}

const INITIAL: MenuState = { visible: false, x: 0, y: 0, targetNodeId: null, targetEdgeId: null };

export function ContextMenu() {
  const [menu, setMenu] = useState<MenuState>(INITIAL);
  const mode = useGraphStore((s) => s.mode);
  const nodes = useGraphStore((s) => s.nodes);
  const softDeleteNode = useGraphStore((s) => s.softDeleteNode);
  const restoreNode = useGraphStore((s) => s.restoreNode);
  const updateNode = useGraphStore((s) => s.updateNode);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const startEdgeCreation = useGraphStore((s) => s.startEdgeCreation);
  const pushAction = useHistoryStore((s) => s.pushAction);

  // 우클릭 감지
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (mode !== 'radial') return;
      e.preventDefault();

      // 선택된 노드가 있으면 노드 메뉴
      if (selectedNodeId) {
        setMenu({ visible: true, x: e.clientX, y: e.clientY, targetNodeId: selectedNodeId, targetEdgeId: null });
        return;
      }

      // 빈 공간 메뉴
      setMenu({ visible: true, x: e.clientX, y: e.clientY, targetNodeId: null, targetEdgeId: null });
    };
    window.addEventListener('contextmenu', handler);
    return () => window.removeEventListener('contextmenu', handler);
  }, [mode, selectedNodeId]);

  // 클릭으로 메뉴 닫기
  useEffect(() => {
    if (!menu.visible) return;
    const handler = () => setMenu(INITIAL);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [menu.visible]);

  const close = useCallback(() => setMenu(INITIAL), []);

  if (!menu.visible || mode !== 'radial') return null;

  const targetNode = menu.targetNodeId ? nodes.get(menu.targetNodeId) : null;

  // 뷰포트 안으로 clamping — 메뉴가 화면 밖으로 나가지 않게
  const menuWidth = 200;
  const menuHeight = targetNode ? 320 : 60;
  const clampedX = Math.min(menu.x, window.innerWidth - menuWidth - 12);
  const clampedY = Math.min(menu.y, window.innerHeight - menuHeight - 12);

  const menuStyle: CSSProperties = {
    position: 'fixed',
    left: Math.max(8, clampedX),
    top: Math.max(8, clampedY),
    background: 'rgba(255,255,255,0.95)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(0,0,0,0.12)',
    borderRadius: 8,
    padding: '4px 0',
    minWidth: 180,
    zIndex: 1000,
    fontSize: 13,
    color: '#1a1a1a',
    fontFamily: '"DM Sans", "IBM Plex Sans", sans-serif',
    fontWeight: 300,
  };

  const itemStyle: CSSProperties = {
    padding: '6px 14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  };

  // --- 노드 메뉴 ---
  if (targetNode) {
    return (
      <div style={menuStyle}>
        {/* 삭제 / 복원 */}
        {targetNode.isDeleted ? (
          <div
            style={itemStyle}
            onMouseOver={(e) => ((e.target as HTMLElement).style.background = 'rgba(0,0,0,0.05)')}
            onMouseOut={(e) => ((e.target as HTMLElement).style.background = 'transparent')}
            onClick={() => {
              restoreNode(targetNode.id);
              pushAction({
                type: 'restoreNode',
                targetId: targetNode.id,
                before: { isDeleted: true },
                after: { isDeleted: false },
              });
              close();
            }}
          >
            복원
          </div>
        ) : (
          <div
            style={itemStyle}
            onMouseOver={(e) => ((e.target as HTMLElement).style.background = 'rgba(0,0,0,0.05)')}
            onMouseOut={(e) => ((e.target as HTMLElement).style.background = 'transparent')}
            onClick={() => {
              softDeleteNode(targetNode.id);
              pushAction({
                type: 'softDeleteNode',
                targetId: targetNode.id,
                before: { isDeleted: false },
                after: { isDeleted: true },
              });
              close();
            }}
          >
            삭제
          </div>
        )}

        {/* 타입 변경 */}
        <div style={{ padding: '4px 14px', fontSize: 11, color: '#888', borderTop: '1px solid rgba(0,0,0,0.08)', marginTop: 2 }}>
          타입 변경
        </div>
        {NODE_TYPES.map((t) => (
          <div
            key={t}
            style={{ ...itemStyle, fontWeight: targetNode.type === t ? 700 : 400 }}
            onMouseOver={(e) => ((e.target as HTMLElement).style.background = 'rgba(0,0,0,0.05)')}
            onMouseOut={(e) => ((e.target as HTMLElement).style.background = 'transparent')}
            onClick={() => {
              if (targetNode.type === t) { close(); return; }
              pushAction({
                type: 'updateNode',
                targetId: targetNode.id,
                before: { type: targetNode.type },
                after: { type: t },
              });
              updateNode(targetNode.id, { type: t });
              close();
            }}
          >
            <span style={{ width: 10, height: 10, borderRadius: '50%', border: '1px solid rgba(0,0,0,0.2)', flexShrink: 0, ...PATTERN_CSS[t] }} />
            {t}
          </div>
        ))}

        {/* 엣지 연결 시작 */}
        {!targetNode.isDeleted && (
          <>
            <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', margin: '2px 0' }} />
            <div
              style={itemStyle}
              onMouseOver={(e) => ((e.target as HTMLElement).style.background = 'rgba(0,0,0,0.05)')}
              onMouseOut={(e) => ((e.target as HTMLElement).style.background = 'transparent')}
              onClick={() => { startEdgeCreation(targetNode.id); close(); }}
            >
              엣지 연결 시작
            </div>
          </>
        )}
      </div>
    );
  }

  // --- 빈 공간 메뉴 ---
  return (
    <div style={menuStyle}>
      <div
        style={itemStyle}
        onMouseOver={(e) => ((e.target as HTMLElement).style.background = 'rgba(0,0,0,0.05)')}
        onMouseOut={(e) => ((e.target as HTMLElement).style.background = 'transparent')}
        onClick={() => {
          useGraphStore.getState().setSelectedNodeId(null);
          close();
        }}
      >
        선택 해제
      </div>
    </div>
  );
}
