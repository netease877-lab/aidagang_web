/**
 * Config Store - 配置类状态
 * [重构] 从 EditorPage sharedProps 提取
 * 注意: 大部分配置已在 useEditorState/useAiConfig 等 hooks 中管理
 * 此 Store 主要用于需要跨组件共享但不需要持久化的临时配置
 */
import { create } from 'zustand';

export const useConfigStore = create((set) => ({
    // 当前工作区背景色（计算值）
    currentWorkspaceColor: '#eff6ff',
    setCurrentWorkspaceColor: (color) => set({ currentWorkspaceColor: color }),
}));
