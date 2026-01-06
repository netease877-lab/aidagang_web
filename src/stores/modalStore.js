/**
 * Modal Store - 弹窗状态管理
 * [重构] 从 EditorPage sharedProps 提取
 */
import { create } from 'zustand';

export const useModalStore = create((set) => ({
    // 操作日志弹窗
    operationLogOpen: false,
    setOperationLogOpen: (open) => set({ operationLogOpen: open }),
    openOperationLog: () => set({ operationLogOpen: true }),
    closeOperationLog: () => set({ operationLogOpen: false }),

    // 大纲 AI 弹窗
    isOutlineAiOpen: false,
    setIsOutlineAiOpen: (open) => set({ isOutlineAiOpen: open }),

    // 章节 AI 弹窗
    isChapterAiOpen: false,
    setIsChapterAiOpen: (open) => set({ isChapterAiOpen: open }),

    // 毒点检查弹窗
    isToxicCheckOpen: false,
    setIsToxicCheckOpen: (open) => set({ isToxicCheckOpen: open }),

    // [新增] AI 对话弹窗
    isChatAiOpen: false,
    setIsChatAiOpen: (open) => set({ isChatAiOpen: open }),

    // 冲突对话框
    conflictDialogOpen: false,
    setConflictDialogOpen: (open) => set({ conflictDialogOpen: open }),
}));
