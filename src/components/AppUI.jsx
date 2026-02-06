// ==================================================
// File: frontend/src/components/AppUI.jsx
// [激进重构] 删除 sharedProps，直接使用 props
// ==================================================
import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { THEMES } from '../constants';

// UI 组件引用
import DesktopLayout from './layout/DesktopLayout';
import MobileLayout from './layout/MobileLayout';
import { ToastContainer } from './common/Toast';
import LoginModal from './LoginModal';
import { WelcomePage } from './AppWidgets';

// 功能组件引用
import AiOutlineModal from '../features/ai-assistant/AiOutlineModal';
import AiChapterModal from '../features/ai-assistant/AiChapterModal';
import AiToxicCheckModal from '../features/ai-assistant/AiToxicCheckModal';
import AiChatModal from '../features/ai-assistant/AiChatModal';
import ConflictDialog from '../features/sync/ConflictDialog';
import OperationLogPanel from '../features/sync/OperationLogPanel';
import { useEditorStore, useEntityStore } from '../stores';

/**
 * AppUI - 主 UI 容器
 * [激进重构] 直接使用 props，不再依赖 EditorContext 或 sharedProps
 */
export default function AppUI(props) {
  const {
    // 登录与用户状态
    isAuthenticated,
    setIsAuthenticated,
    isLoginOpen,
    setIsLoginOpen,
    fetchUserProfile,

    // UI 状态与控制
    isMobile,
    themeStyles,
    toasts,
    removeToast,
    confirmDialog,
    setConfirmDialog,

    // 弹窗状态
    conflictDialogOpen,
    setConflictDialogOpen,
    conflictData,
    operationLogOpen,
    setOperationLogOpen,
    isOutlineAiOpen,
    setIsOutlineAiOpen,
    isChapterAiOpen,
    setIsChapterAiOpen,
    isToxicCheckOpen,
    setIsToxicCheckOpen,
    activeNodeIdForToxic,
    // [新增] AI 对话弹窗
    isChatAiOpen,
    setIsChatAiOpen,

    // AI 助手相关
    activeChapterIdForAi,
    fetchContextForAi,
    handleInsertAiContent,
    handleSelectChapter, // [新增] 毒点检查跳转回调
    getStorageKey,
    permissions = {},

    // 核心逻辑依赖
    showToast,
    setDbSyncStatus,
    operationLog,
    onMergeConflict,

    // 数据 (用于 AI 弹窗)
    // data, // [Deleted]
    characters,
    scenes,
    charCats,
    sceneCats,
    charFields,
  } = props;

  // 未登录显示欢迎页
  if (!isAuthenticated) {
    return (
      <div style={{ ...THEMES.default.colors }} className="text-[var(--text-main)]">
        <WelcomePage onOpenLogin={() => setIsLoginOpen(true)} />
        <LoginModal
          isOpen={isLoginOpen}
          onClose={() => setIsLoginOpen(false)}
          onLoginSuccess={() => {
            setIsAuthenticated(true);
            fetchUserProfile();
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen font-sans overflow-hidden select-none transition-colors duration-300 animate-in fade-in"
      style={{ ...themeStyles, backgroundColor: 'var(--app-bg)', color: 'var(--text-main)' }}>

      {/* 冲突解决弹窗 */}
      <ConflictDialog
        isOpen={conflictDialogOpen}
        conflicts={conflictData?.conflicts || []}
        localVersion={conflictData?.localVersion}
        serverVersion={conflictData?.serverVersion}
        onMergeComplete={onMergeConflict}
        onClose={() => {
          setConflictDialogOpen(false);
          if (setDbSyncStatus) setDbSyncStatus('idle');
          if (operationLog?.logSync) operationLog.logSync('冲突解决', '用户取消');
        }}
      />

      {/* 操作日志 */}
      <OperationLogPanel
        isOpen={operationLogOpen}
        onClose={() => setOperationLogOpen(false)}
        logs={operationLog?.getFormattedLogs?.() || []}
        onClear={operationLog?.clearLogs}
        logCount={operationLog?.logCount || 0}
      />

      {/* AI 弹窗 */}
      <AiOutlineModal isOpen={isOutlineAiOpen} onClose={() => setIsOutlineAiOpen(false)} getStorageKey={getStorageKey} permissions={permissions} />

      <AiChapterModal
        isOpen={isChapterAiOpen}
        onClose={() => setIsChapterAiOpen(false)}
        characters={characters}
        scenes={scenes}
        charCats={charCats}
        sceneCats={sceneCats}
        // [新增] 传递当前章节信息 (极简: 内联计算)
        activeChapter={(() => {
          const id = useEditorStore.getState().activeChapterIdForAi;
          const map = useEditorStore.getState().nodeIndexMap || {};
          const find = (nodes) => { for (const n of nodes || []) { if (n.id === id) return n; const r = find(n.children); if (r) return r; } return null; };
          const node = find(useEntityStore.getState().data);
          return id && node ? { index: map[id]?.chIndex, title: node.title } : null;
        })()}
        // [修复] 调用时实时获取最新的 activeChapterIdForAi，避免闭包捕获旧值
        onFetchContext={(mode) => {
          const nodeId = useEditorStore.getState().activeChapterIdForAi;
          return fetchContextForAi?.(nodeId, mode);
        }}
        // [修复] 调用时实时获取最新的 activeChapterIdForAi，避免闭包捕获旧值
        onInsertContent={(content) => {
          const nodeId = useEditorStore.getState().activeChapterIdForAi;
          return handleInsertAiContent?.(nodeId, content);
        }}
        getStorageKey={getStorageKey}
        permissions={permissions}
      />

      {/* 毒点检查弹窗 */}
      <AiToxicCheckModal
        isOpen={isToxicCheckOpen}
        onClose={() => setIsToxicCheckOpen(false)}
        targetNodeId={activeNodeIdForToxic}
        getStorageKey={getStorageKey}
        onFetchContext={(mode) => fetchContextForAi?.(activeNodeIdForToxic, mode)}
        charFields={charFields}
        onSelectChapter={handleSelectChapter}
      />

      {/* [新增] AI 对话弹窗 */}
      <AiChatModal
        isOpen={isChatAiOpen}
        onClose={() => setIsChatAiOpen(false)}
        getStorageKey={getStorageKey}
        onFetchContext={fetchContextForAi}
        permissions={permissions}
      />

      {/* 响应式布局 (Layout 组件直接从 Stores/Contexts 获取数据) */}
      {isMobile ? <MobileLayout /> : <DesktopLayout />}

      {/* 全局通知 */}
      <ToastContainer toasts={toasts} removeToast={removeToast} isMobile={isMobile} />

      {/* 全局确认弹窗 */}
      {confirmDialog?.visible && (
        <div className="fixed inset-0 z-[9998] bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--panel-bg)] border border-[var(--border)] rounded-lg shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4">
              <div className="flex items-center gap-3 mb-3 text-[var(--text-main)]">
                <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600 shrink-0">
                  <ShieldAlert size={20} />
                </div>
                <div className="font-bold text-sm">需要确认</div>
              </div>
              <p className="text-xs text-[var(--text-sub)] leading-relaxed">{confirmDialog.message}</p>
            </div>
            <div className="bg-[var(--app-bg)] px-4 py-3 flex justify-end gap-2 border-t border-[var(--border)]">
              <button onClick={() => setConfirmDialog({ ...confirmDialog, visible: false })} className="px-3 py-1.5 rounded text-xs font-bold text-[var(--text-sub)] hover:bg-[var(--hover-bg)]">取消</button>
              <button onClick={() => { setConfirmDialog({ ...confirmDialog, visible: false }); if (confirmDialog.onConfirm) confirmDialog.onConfirm(); }} className="px-3 py-1.5 rounded text-xs font-bold bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 shadow-sm">确定</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
