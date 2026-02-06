/**
 * Editor Store - 编辑器核心状态
 * [重构] 从 EditorPage sharedProps 提取
 */
import { create } from 'zustand';

export const useEditorStore = create((set, get) => ({
    // 当前激活的节点 ID
    activeNodeId: null,
    setActiveNodeId: (id) => set({ activeNodeId: id }),

    // AI 相关
    activeChapterIdForAi: null,
    setActiveChapterIdForAi: (id) => set({ activeChapterIdForAi: id }),

    prevChapterContext: '',
    setPrevChapterContext: (ctx) => set({ prevChapterContext: ctx }),

    // 毒点检查
    activeNodeIdForToxic: null,
    setActiveNodeIdForToxic: (id) => set({ activeNodeIdForToxic: id }),

    // 智能上下文数据（由 useMemo 计算，这里仅存储引用）
    smartContextData: null,
    setSmartContextData: (data) => set({ smartContextData: data }),

    // 节点索引映射（由 useMemo 计算）
    nodeIndexMap: new Map(),
    setNodeIndexMap: (map) => set({ nodeIndexMap: map }),
}));
