// ==================================================
// File: frontend/src/features/settings/SettingsPanel.jsx
// [激进重构] 直接从 Stores 和 Contexts 获取数据
// ==================================================
import React, { useState, useEffect } from 'react';
import {
  FileJson, Download, Upload, Edit3, PaintBucket,
  LayoutTemplate, Database, Info, FileText,
  RotateCcw, Trash2, Brain, Cloud, Wifi,
  CheckCircle, XCircle, DownloadCloud, History, ShieldAlert,
  Book, Lightbulb, User, LogOut
} from 'lucide-react';
import { STORAGE_PREFIX, DEFAULT_WEBDAV_CONFIG } from '../../constants.js';
import { useWebDAV, safeBtoa, getWebDAVProxyUrl } from '../../hooks/useWebDAV';

// [激进重构] 直接从 Stores 获取数据
import { useSettingsStore, useEntityStore, useUIStore } from '../../stores';
import { useNovel, useUser, useToast } from '../../contexts';

// [重构] 导入拆分后的子组件
import { SettingsTheme, SettingsEditor, SettingsData, SettingsTemplates, SettingsAI } from './index';
import { dbService } from '../../services/db';
import { fetchAPI } from '../../services/api';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import ChangePasswordModal from '../../components/ChangePasswordModal';
import { restoreFromBackup, handleRestoreSuccess } from '../../utils/backupUtils';

const getSafeProxyUrl = getWebDAVProxyUrl;

// 子菜单项组件
const SettingSection = ({ title, children }) => (
  <div className="mb-6 animate-in fade-in slide-in-from-left-2 duration-300">
    <h4 className="font-bold text-sm text-[var(--text-main)] mb-3 flex items-center gap-2 border-b border-[var(--border)] pb-2">
      {title}
    </h4>
    <div className="space-y-4">{children}</div>
  </div>
);

// 侧边导航项
const NavItem = ({ id, icon: Icon, label, activeTab, setActiveTab, isMobile }) => (
  <button
    onClick={() => setActiveTab(id)}
    className={`p-3 flex flex-col items-center justify-center gap-1 rounded-lg transition-all flex-shrink-0 ${isMobile ? 'min-w-[70px]' : 'w-full'} ${activeTab === id ? 'bg-[var(--accent)] text-white shadow-md' : 'text-[var(--text-sub)] hover:bg-[var(--hover-bg)]'}`}
  >
    <Icon size={20} />
    <span className="text-[10px] font-bold">{label}</span>
  </button>
);

/**
 * [激进重构] SettingsPanel 直接从 Stores/Contexts 获取数据
 * 删除 40+ props，改为内部订阅
 */
export default function SettingsPanel({ isMobile = false }) {
  const [activeTab, setActiveTab] = useState('appearance');
  const [confirmDialog, setConfirmDialog] = useState({ visible: false, message: '', onConfirm: null });
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  // ========== 从 Stores 和 Contexts 获取数据 ==========
  const settings = useSettingsStore();
  const entityStore = useEntityStore();
  const novel = useNovel();
  const user = useUser();
  const toast = useToast();

  // 获取视图模式
  const viewMode = useUIStore(state => state.viewMode);

  const { novels, setNovels, currentNovelId, operationLog } = novel;
  const { permissions = {}, getStorageKey, currentUser } = user;
  const { addToast } = toast;

  // 设置值（从 Store） - 仅保留 AI/WebDAV/Templates 相关
  const {
    aiConfig, setAiConfig,
    outlineAiConfig, setOutlineAiConfig,
    chapterAiConfig, setChapterAiConfig,
    toxicAiConfig, setToxicAiConfig,
    chatAiConfig, setChatAiConfig, // [新增]
    aiStyles, setAiStyles,
    webdavConfig, setWebdavConfig
    // [Refactor] Templates/Fields moved to EntityStore and self-managed by SettingsTemplates
  } = settings;

  // [Refactor] charFields removed from here, SettingsTemplates manages it.

  const safeNovels = Array.isArray(novels) ? novels : [];
  const safeNovelId = currentNovelId || '';
  const currentNovelTitle = safeNovels.find(n => n.id === safeNovelId)?.title || '';

  // WebDAV Hook - [修复] 补充缺失的数据参数
  const webdavHook = useWebDAV({
    getStorageKey,
    currentNovelId,
    novels,
    data: entityStore.data,
    characters: entityStore.characters,
    charCats: entityStore.charCats,
    scenes: entityStore.scenes,
    sceneCats: entityStore.sceneCats,
    worldSettings: entityStore.worldSettings,
    settingCats: entityStore.settingCats,
    chapterTemplates: entityStore.chapterTemplates,
    charFields: entityStore.charFields,
    relations: entityStore.relations,
    permissions,
    operationLog,
    addToast,
    showToast: addToast
  });
  const {
    webdavStatus, setWebdavStatus,
    cloudFiles, isCloudLoading, setIsCloudLoading,
    testConnection: hookTestConnection,
    fetchFileList: hookFetchFileList,
    deleteFile: hookDeleteFile,
  } = webdavHook;

  // [Refactor] 移除了 legacy 的 localStorage 同步逻辑
  // useWebDAV hook 现已直接读取 SettingsStore

  // WebDAV 方法
  // [修复] 同时保存到 settingsStore 和 localStorage
  const updateWebdavConfig = (key, value) => {
    const newConfig = { ...webdavConfig, [key]: value };
    setWebdavConfig(newConfig);
    setWebdavStatus('idle');

    // [Refactor] 仅更新 Store，不再写入 localStorage
    // (因为 useWebDAV 现在直接读 Store)
  };

  const testWebDAV = async () => {
    const result = await hookTestConnection(webdavConfig);
    if (result.success) addToast('WebDAV 连接成功', 'success');
    else addToast(`连接测试失败: ${result.error}`, 'error');
  };

  const deleteWebDAVFile = async (fileName) => {
    setConfirmDialog({
      visible: true,
      message: `确定要从云端永久删除 "${fileName}" 吗？`,
      onConfirm: async () => { await hookDeleteFile(fileName); }
    });
  };

  const restoreFromCloud = async (fileName) => {
    setConfirmDialog({
      visible: true,
      message: '确定要下载并导入此备份吗？将创建一本新书籍。',
      onConfirm: async () => {
        setIsCloudLoading(true);
        const { url, username, password } = webdavConfig;
        const baseUrl = url.endsWith('/') ? url : url + '/';
        const proxyUrl = getSafeProxyUrl(baseUrl + encodeURIComponent(fileName));
        try {
          const token = localStorage.getItem('novel_token');
          const headers = { 'X-WebDAV-Authorization': 'Basic ' + safeBtoa(`${username}:${password}`) };
          if (token) headers['Authorization'] = `Bearer ${token}`;
          const res = await fetch(proxyUrl, { method: 'GET', headers });
          if (!res.ok) throw new Error('下载失败');
          const rawJson = await res.json();
          const result = await restoreFromBackup(rawJson, getStorageKey, { showToast: addToast });
          setIsCloudLoading(false);
          if (result.success) {
            operationLog?.logSync?.('WebDAV恢复', `《${result.newTitle}》已恢复`);
            handleRestoreSuccess(result.newId, result.newTitle, getStorageKey, { showToast: addToast });
          } else {
            addToast('恢复失败: ' + result.error, 'error');
          }
        } catch (error) {
          addToast('恢复失败: ' + error.message, 'error');
          setIsCloudLoading(false);
        }
      }
    });
  };

  const handleExportJSON = () => novel.handleExportJSON?.();
  const handleImportJSON = (e) => novel.handleImportJSON?.(e);

  const openOperationLog = () => {
    // 使用 ModalStore
    import('../../stores').then(({ useModalStore }) => {
      useModalStore.getState().setOperationLogOpen(true);
    });
  };

  // 布局样式
  const containerClass = isMobile ? "flex flex-col h-full bg-[var(--app-bg)] w-full relative" : "flex flex-1 min-h-0 bg-[var(--app-bg)] w-full relative";
  const navContainerClass = isMobile ? "w-full bg-[var(--panel-bg)] border-b border-[var(--border)] flex items-center px-2 py-1 gap-2 flex-shrink-0 z-10 overflow-x-auto hide-scrollbar" : "w-[72px] bg-[var(--panel-bg)] flex flex-col items-center py-4 gap-2 flex-shrink-0 z-10 h-full";
  const contentContainerClass = isMobile ? "flex-1 w-full overflow-y-auto p-3 custom-scrollbar bg-[var(--app-bg)] relative" : "flex-1 h-full overflow-y-auto p-5 hide-scrollbar bg-[var(--app-bg)] relative";

  return (
    <div className={containerClass}>
      <ConfirmDialog
        visible={confirmDialog.visible}
        message={confirmDialog.message}
        onConfirm={() => { setConfirmDialog({ ...confirmDialog, visible: false }); confirmDialog.onConfirm?.(); }}
        onCancel={() => setConfirmDialog({ ...confirmDialog, visible: false })}
      />

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
        createdAt={currentUser?.created_at}
        addToast={addToast}
      />

      {/* 导航栏 */}
      <div className={`${navContainerClass} ${isMobile ? 'order-1' : 'order-2'}`}>
        <NavItem id="appearance" icon={PaintBucket} label="外观" activeTab={activeTab} setActiveTab={setActiveTab} isMobile={isMobile} />
        <NavItem id="editor" icon={LayoutTemplate} label="编辑" activeTab={activeTab} setActiveTab={setActiveTab} isMobile={isMobile} />
        <NavItem id="templates" icon={FileText} label="模版" activeTab={activeTab} setActiveTab={setActiveTab} isMobile={isMobile} />
        <NavItem id="data" icon={Database} label="数据" activeTab={activeTab} setActiveTab={setActiveTab} isMobile={isMobile} />

        {(permissions.ai_outline || permissions.ai_chapter || permissions.ai_toxic || permissions.ai_chat) && (
          <>
            <div className={isMobile ? "h-8 w-px bg-[var(--border)] mx-1" : "w-8 h-px bg-[var(--border)] my-1"}></div>
            <NavItem id="ai_management" icon={Brain} label="AI管理" activeTab={activeTab} setActiveTab={setActiveTab} isMobile={isMobile} />
            <NavItem id="ai_config" icon={Book} label="AI配置" activeTab={activeTab} setActiveTab={setActiveTab} isMobile={isMobile} />
          </>
        )}

        <div className={isMobile ? "ml-auto" : "mt-auto"}></div>
        <NavItem id="history" icon={History} label="日志" activeTab={activeTab} setActiveTab={setActiveTab} isMobile={isMobile} />
        <NavItem id="about" icon={Info} label="关于" activeTab={activeTab} setActiveTab={setActiveTab} isMobile={isMobile} />
      </div>

      {/* 内容区域 */}
      <div className={`${contentContainerClass} ${isMobile ? 'order-2' : 'order-1'}`}>
        {activeTab === 'appearance' && <SettingsTheme isMobile={isMobile} />}

        {activeTab === 'editor' && <SettingsEditor isMobile={isMobile} />}

        {activeTab === 'templates' && (
          <SettingsTemplates
            isMobile={isMobile} setConfirmDialog={setConfirmDialog}
          />
        )}

        {activeTab === 'data' && (
          <SettingsData
            novels={novels}
            setNovels={setNovels}
            currentNovelId={currentNovelId}
            version={novel.versionRef.current[currentNovelId]} // [修复] 传递当前版本号
            getStorageKey={getStorageKey}
            handleExportJSON={handleExportJSON}
            handleImportJSON={handleImportJSON}
            permissions={permissions}
            webdavConfig={webdavConfig}
            updateWebdavConfig={updateWebdavConfig}
            webdavStatus={webdavStatus}
            testWebDAV={testWebDAV}
            onManualBackup={webdavHook.backup}
            cloudFiles={cloudFiles}
            isCloudLoading={isCloudLoading}
            setIsCloudLoading={setIsCloudLoading}
            fetchWebDAVFiles={hookFetchFileList}
            restoreFromCloud={restoreFromCloud}
            deleteWebDAVFile={deleteWebDAVFile}
            setConfirmDialog={setConfirmDialog}
            addToast={addToast}
          />
        )}

        {activeTab === 'history' && (
          <SettingSection title={<><History size={16} /> 操作日志</>}>
            <div className="bg-[var(--panel-bg)] p-4 rounded-lg border border-[var(--border)] text-center">
              <History size={32} className="mx-auto mb-3 text-[var(--accent)]" />
              <button onClick={openOperationLog} className="px-6 py-2 bg-[var(--accent)] text-white rounded-lg font-bold">
                查看完整日志
              </button>
            </div>
          </SettingSection>
        )}

        {(permissions.ai_outline || permissions.ai_chapter || permissions.ai_toxic || permissions.ai_chat) && (
          <SettingsAI
            activeTab={activeTab}
            permissions={permissions}
            getStorageKey={getStorageKey}
            addToast={addToast}
            setConfirmDialog={setConfirmDialog}
            aiConfig={aiConfig} setAiConfig={setAiConfig}
            outlineAiConfig={outlineAiConfig} setOutlineAiConfig={setOutlineAiConfig}
            chapterAiConfig={chapterAiConfig} setChapterAiConfig={setChapterAiConfig}
            toxicAiConfig={toxicAiConfig} setToxicAiConfig={setToxicAiConfig}
            chatAiConfig={chatAiConfig} setChatAiConfig={setChatAiConfig} // [新增]
            customStyles={aiStyles} setCustomStyles={setAiStyles}
          />
        )}

        {activeTab === 'about' && (
          <SettingSection title={<><Info size={16} /> 关于</>}>
            <div className="bg-[var(--panel-bg)] p-4 rounded-lg border border-[var(--border)] text-center">
              <div className="text-[var(--accent)] font-bold text-lg mb-1">Novel Studio</div>
              <div className="text-[var(--text-sub)] text-xs mb-4">v8.0 Scene Manager Edition</div>
              <p className="text-[var(--text-main)] text-xs leading-relaxed opacity-80">
                专为网文作者打造的沉浸式大纲与世界观管理工具。
                <br />双模组 AI 助手 (大纲/细纲) + Zen专注模式 + 场景管理。
              </p>

              {/* [新增] 移动端专属: 显示用户名和下载按钮 */}
              {isMobile && (
                <div className="mt-4 pt-4 border-t border-[var(--border)] flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <div
                      onClick={() => setIsChangePasswordOpen(true)}
                      className="flex-1 flex items-center justify-center gap-2 text-[var(--text-sub)] text-xs bg-[var(--app-bg)] py-2 rounded-lg cursor-pointer hover:bg-[var(--hover-bg)] transition-colors border border-[var(--border)]"
                      title="点击修改密码"
                    >
                      <User size={14} />
                      <span>当前用户: <span className="text-[var(--text-main)] font-bold">
                        {currentUser?.nickname || currentUser?.email || 'User'}
                      </span></span>
                    </div>
                    <button
                      onClick={() => { if (confirm('确定退出登录吗？')) { user.logout(); } }}
                      className="flex-shrink-0 px-3 py-2 bg-[var(--app-bg)] text-red-500 hover:bg-red-50 border border-[var(--border)] rounded-lg font-bold text-xs transition-colors flex items-center justify-center"
                      title="退出登录"
                    >
                      <LogOut size={16} />
                    </button>
                  </div>
                  <button
                    onClick={() => viewMode === 'mindmap' ? novel.handleExportMindmap() : novel.handleExportText()}
                    className="w-full py-2.5 flex items-center justify-center gap-2 bg-[var(--panel-bg)] border border-[var(--border)] hover:bg-[var(--hover-bg)] text-[var(--text-sub)] rounded-lg font-bold text-xs transition-colors"
                  >
                    {viewMode === 'mindmap' ? (
                      <><Download size={14} /> 下载思维导图 (Image)</>
                    ) : (
                      <><Download size={14} /> 下载书籍 (TXT)</>
                    )}
                  </button>
                </div>
              )}

              {permissions.admin && (
                <button onClick={() => {
                  window.location.href = '/ztadmin';
                }} className="w-full mt-3 py-3 flex items-center justify-center gap-2 bg-[var(--accent-bg)] border border-[var(--accent)]/30 text-[var(--accent)] rounded-lg font-bold">
                  <ShieldAlert size={16} /> 进入管理后台
                </button>
              )}
            </div>
          </SettingSection>
        )}
      </div>
    </div>
  );
}
