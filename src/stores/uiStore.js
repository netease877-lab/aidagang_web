/**
 * UI Store - 视图模式、面板状态等 UI 相关状态
 * [重构] 从 EditorPage sharedProps 提取
 */
import { create } from 'zustand';

export const useUIStore = create((set, get) => ({
    // 视图模式
    viewMode: 'list', // 'list' | 'mindmap' | 'graph'
    setViewMode: (mode) => set({ viewMode: mode }),

    // 右侧面板 Tab
    rightPanelTab: 'smart', // 'smart' | 'entities' | 'settings'
    setRightPanelTab: (tab) => set({ rightPanelTab: tab }),

    // [新增] 全局编辑状态 - 用于智能同步判断
    isEditing: false,
    setIsEditing: (val) => set({ isEditing: val }),

    // [新增] 是否有挂起的远程更新（编辑模式期间收到的）
    hasPendingRemoteUpdates: false,
    setHasPendingRemoteUpdates: (val) => set({ hasPendingRemoteUpdates: val }),

    // Zen 模式
    isZenMode: false,
    setIsZenMode: (val) => set({ isZenMode: val }),
    toggleZenMode: () => set((state) => ({ isZenMode: !state.isZenMode })),

    // TopBar 悬停状态
    isTopBarHovered: false,
    setIsTopBarHovered: (val) => set({ isTopBarHovered: val }),

    // 确认对话框
    confirmDialog: { visible: false, message: '', onConfirm: null },
    setConfirmDialog: (dialog) => set({ confirmDialog: dialog }),
    closeConfirmDialog: () => set({ confirmDialog: { visible: false, message: '', onConfirm: null } }),

    // 章节排序 - 插入模式状态
    reorderState: null,  // { sourceId: string, sourceLevel: number } | null
    setReorderState: (state) => set({ reorderState: state }),
    exitReorderMode: () => set({ reorderState: null }),

    // ==================== [新增] 节点展开状态 ====================
    // 使用 Set 存储展开的节点ID，与数据层完全解耦
    expandedNodeIds: new Set(),

    // 切换节点展开状态
    toggleNodeExpand: (id) => set(state => {
        const strId = String(id); // [FIX] 强制转 String 确保类型一致
        const newSet = new Set(state.expandedNodeIds);
        if (newSet.has(strId)) {
            newSet.delete(strId);
        } else {
            newSet.add(strId);
        }
        return { expandedNodeIds: newSet };
    }),

    // 设置节点展开状态
    setNodeExpanded: (id, expanded) => set(state => {
        const strId = String(id); // [FIX] 强制转 String
        const newSet = new Set(state.expandedNodeIds);
        if (expanded) {
            newSet.add(strId);
        } else {
            newSet.delete(strId);
        }
        return { expandedNodeIds: newSet };
    }),

    // 批量设置多个节点展开
    setNodesExpanded: (ids, expanded) => set(state => {
        const newSet = new Set(state.expandedNodeIds);
        ids.forEach(id => {
            const strId = String(id); // [FIX] 强制转 String
            if (expanded) {
                newSet.add(strId);
            } else {
                newSet.delete(strId);
            }
        });
        return { expandedNodeIds: newSet };
    }),

    // 折叠所有节点
    collapseAllNodes: () => set({ expandedNodeIds: new Set() }),

    // 检查节点是否展开
    isNodeExpanded: (id) => get().expandedNodeIds.has(String(id)), // [FIX] 强制转 String
}));
