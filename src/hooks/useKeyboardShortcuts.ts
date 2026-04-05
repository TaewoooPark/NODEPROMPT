import { useEffect } from 'react';
import { useGraphStore } from '../store/useGraphStore';
import { useHistoryStore } from '../store/useHistoryStore';

/**
 * 글로벌 키보드 단축키.
 * P3-PATCH-5: 텍스트 입력 요소에 포커스 중이면 무시.
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // 텍스트 입력 요소 포커스 중이면 무시
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.getAttribute('contenteditable')) {
        return;
      }

      const store = useGraphStore.getState();
      const history = useHistoryStore.getState();

      // Escape: 선택 해제 / 엣지 생성 취소
      if (e.key === 'Escape') {
        if (store.edgeCreation.isCreatingEdge) {
          store.cancelEdgeCreation();
        } else {
          store.setSelectedNodeId(null);
        }
        return;
      }

      // Backspace / Delete: 선택된 노드 소프트 삭제
      if ((e.key === 'Backspace' || e.key === 'Delete') && store.mode === 'radial') {
        const { selectedNodeId } = store;
        if (selectedNodeId) {
          const node = store.nodes.get(selectedNodeId);
          if (node && !node.isDeleted) {
            store.softDeleteNode(selectedNodeId);
            history.pushAction({
              type: 'softDeleteNode',
              targetId: selectedNodeId,
              before: { isDeleted: false },
              after: { isDeleted: true },
            });
          }
        }
        return;
      }

      // Space: Sphere ↔ Radial 전환 (P6-PATCH-2)
      if (e.key === ' ' && !e.ctrlKey && !e.metaKey) {
        if (store.isTransitioning || store.isProcessing) return;
        if (store.mode === 'sphere' || store.mode === 'radial') {
          e.preventDefault();
          // SceneInner에서 morph 호출 — 여기서는 더블클릭 시뮬레이션 이벤트를 발생시키지 않고
          // mode를 직접 전환하기보다 SceneInner의 더블클릭 로직을 트리거하기 위해
          // 간단히 커스텀 이벤트를 dispatch
          window.dispatchEvent(new CustomEvent('nodeprompt:toggle-mode'));
        }
        return;
      }

      // ] 또는 +: 선택 노드 가중치 증가 / [ 또는 -: 감소
      if ((e.key === ']' || e.key === '=' || e.key === '+') && store.selectedNodeId) {
        const node = store.nodes.get(store.selectedNodeId);
        if (node) {
          const newWeight = Math.min(1, node.weight + 0.05);
          history.pushAction({
            type: 'updateNode',
            targetId: node.id,
            before: { weight: node.weight },
            after: { weight: newWeight },
          });
          store.updateNode(node.id, { weight: newWeight });
        }
        return;
      }
      if ((e.key === '[' || e.key === '-') && store.selectedNodeId) {
        const node = store.nodes.get(store.selectedNodeId);
        if (node) {
          const newWeight = Math.max(0.05, node.weight - 0.05);
          history.pushAction({
            type: 'updateNode',
            targetId: node.id,
            before: { weight: node.weight },
            after: { weight: newWeight },
          });
          store.updateNode(node.id, { weight: newWeight });
        }
        return;
      }

      // L: 라벨 토글
      if (e.key === 'l' || e.key === 'L') {
        store.toggleLabels();
        return;
      }

      // H 또는 Home: 카메라 홈 위치로 복귀
      if (e.key === 'h' || e.key === 'H' || e.key === 'Home') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('nodeprompt:go-home'));
        return;
      }

      // Ctrl+Z / Cmd+Z: Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        history.undo();
        return;
      }

      // Ctrl+Shift+Z / Cmd+Shift+Z: Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        history.redo();
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
