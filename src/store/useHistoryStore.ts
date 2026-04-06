import { create } from 'zustand';
import type { NodeData, EdgeData } from '../types';
import { useGraphStore } from './useGraphStore';

const MAX_HISTORY = 50;

interface HistoryEntry {
  type: 'addNode' | 'updateNode' | 'softDeleteNode' | 'restoreNode' | 'addEdge' | 'removeEdge';
  targetId: string;
  before: Partial<NodeData> | Partial<EdgeData> | null;
  after: Partial<NodeData> | Partial<EdgeData> | null;
}

interface HistoryState {
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  pushAction: (entry: HistoryEntry) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
}

function applyEntry(entry: HistoryEntry, data: Partial<NodeData> | Partial<EdgeData> | null) {
  if (!data) return;
  const graph = useGraphStore.getState();

  switch (entry.type) {
    case 'addNode':
      // undo = remove, redo = add
      if (data === null) {
        graph.removeNode(entry.targetId);
      } else {
        graph.addNode(data as NodeData);
      }
      break;
    case 'updateNode':
      graph.updateNode(entry.targetId, data as Partial<NodeData>);
      break;
    case 'softDeleteNode':
      // undo = restore, redo = softDelete
      if ((data as Partial<NodeData>).isDeleted === false) {
        graph.restoreNode(entry.targetId);
      } else {
        graph.softDeleteNode(entry.targetId);
      }
      break;
    case 'restoreNode':
      if ((data as Partial<NodeData>).isDeleted === true) {
        graph.softDeleteNode(entry.targetId);
      } else {
        graph.restoreNode(entry.targetId);
      }
      break;
    case 'addEdge':
      // undo = remove, redo = add
      if (data === null) {
        graph.removeEdge(entry.targetId);
      } else {
        graph.addEdge(data as EdgeData);
      }
      break;
    case 'removeEdge':
      if (data !== null) {
        graph.addEdge(data as EdgeData);
      } else {
        graph.removeEdge(entry.targetId);
      }
      break;
  }
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  undoStack: [],
  redoStack: [],

  pushAction: (entry) =>
    set((s) => ({
      undoStack: [...s.undoStack.slice(-(MAX_HISTORY - 1)), entry],
      redoStack: [], // 새 액션 시 redo 스택 초기화
    })),

  undo: () => {
    const { undoStack } = get();
    if (undoStack.length === 0) return;

    const entry = undoStack[undoStack.length - 1]!;
    applyEntry(entry, entry.before);

    set((s) => ({
      undoStack: s.undoStack.slice(0, -1),
      redoStack: [...s.redoStack, entry],
    }));
  },

  redo: () => {
    const { redoStack } = get();
    if (redoStack.length === 0) return;

    const entry = redoStack[redoStack.length - 1]!;
    applyEntry(entry, entry.after);

    set((s) => ({
      redoStack: s.redoStack.slice(0, -1),
      undoStack: [...s.undoStack, entry],
    }));
  },

  clear: () => set({ undoStack: [], redoStack: [] }),
}));
