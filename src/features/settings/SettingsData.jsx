// ==================================================
// File: frontend/src/components/settings/SettingsData.jsx
// 数据管理Tab - 从 SettingsPanel.jsx 拆分
// ==================================================
import React, { useState } from 'react';
import {
    Edit3, Cloud, FileJson, Download, Upload, DownloadCloud,
    RotateCcw, CheckCircle, XCircle, Wifi, Trash2
} from 'lucide-react';
import { safeBtoa, getWebDAVProxyUrl } from '../../hooks/useWebDAV';
import { fetchAPI } from '../../services/api'; // [修复] 用于保存书名

// 设置区块组件
// [修复] 引入用于保存配置的 Hooks (已移除: 自动保存由 EditorPage 接管)
// import { useUser } from '../../contexts';
// import { useEditorState } from '../../hooks/useEditorState';

// [修复] 恢复 SettingSection 组件定义
const SettingSection = ({ title, children }) => (
    <div className="mb-6 animate-in fade-in slide-in-from-left-2 duration-300">
        <h4 className="font-bold text-sm text-[var(--text-main)] mb-3 flex items-center gap-2 border-b border-[var(--border)] pb-2">
            {title}
        </h4>
        <div className="space-y-4">{children}</div>
    </div>
);

export default function SettingsData({
    // ... existing props ...
    novels,
    setNovels,
    currentNovelId,
    version,
    getStorageKey,
    handleExportJSON,
    handleImportJSON,
    permissions,
    webdavConfig,
    updateWebdavConfig,
    webdavStatus,
    testWebDAV,
    onManualBackup,
    cloudFiles,
    setCloudFiles,
    isCloudLoading,
    setIsCloudLoading,
    fetchWebDAVFiles,
    restoreFromCloud,
    deleteWebDAVFile,
    setConfirmDialog,
    addToast
}) {
    // ... existing code ...
    const safeNovels = Array.isArray(novels) ? novels : [];
    const safeNovelId = currentNovelId || '';
    const currentNovelTitle = safeNovels.find(n => n.id === safeNovelId)?.title || '';

    // [修复] 记录原始书名，用于判断是否真的发生了修改
    const originalTitleRef = React.useRef(currentNovelTitle);
    React.useEffect(() => {
        originalTitleRef.current = currentNovelTitle;
    }, [safeNovelId]); // 切换小说时更新原始值

    // [修复] 获取保存配置所需的方法 (已移除: 自动保存由 EditorPage 接管)
    // const { updateConfig } = useUser();
    // const { buildConfigPayload } = useEditorState();

    // [修复] WebDAV 配置自动保存处理函数 (已移除: 自动保存由 EditorPage 接管)
    // const handleWebDavSave = async () => {};

    // ... existing refs and code ...

    const safeWebdavConfig = webdavConfig || {
        url: '', username: '', password: '', enabled: false, autoBackupInterval: 120
    };

    return (
        <>
            {/* 作品信息 */}
            <SettingSection title={<><Edit3 size={16} /> 作品信息</>}>
                <div className="bg-[var(--panel-bg)] p-3 rounded-lg border border-[var(--border)]">
                    <label className="text-xs text-[var(--text-sub)] block mb-1">小说标题</label>
                    <input
                        className="w-full text-xs p-2 rounded border border-[var(--border)] bg-[var(--app-bg)] text-[var(--text-main)] focus:border-[var(--accent)] outline-none"
                        value={currentNovelTitle}
                        onChange={(e) => {
                            const newTitle = e.target.value;
                            const newNovels = safeNovels.map(n =>
                                n.id === safeNovelId ? { ...n, title: newTitle } : n
                            );
                            setNovels(newNovels);
                        }}
                        onBlur={async (e) => {
                            const newTitle = e.target.value;

                            // [修复] 只有书名真正发生变化时才保存
                            if (newTitle && safeNovelId && newTitle !== originalTitleRef.current) {
                                try {
                                    const res = await fetchAPI('/api/novel/sync', 'POST', {
                                        novel_id: safeNovelId,
                                        title: newTitle,
                                        base_version: version || 1
                                    });
                                    if (res?.status === 'success') {
                                        addToast?.('书名已保存', 'success');
                                        originalTitleRef.current = newTitle; // 更新原始值
                                    } else {
                                        console.error('[Title] 保存失败:', res);
                                        addToast?.('书名保存失败', 'error');
                                    }
                                } catch (err) {
                                    console.error('[Title] 保存失败:', err);
                                    addToast?.('书名保存失败', 'error');
                                }
                            }
                        }}
                    />
                </div>
            </SettingSection>

            {/* WebDAV 云备份 */}
            {permissions?.webdav && (
                <SettingSection title={<><Cloud size={16} /> WebDAV 云备份 & 恢复</>}>
                    <div className="bg-[var(--panel-bg)] p-3 rounded-lg border border-[var(--border)] space-y-3">
                        {/* 自动备份设置 */}
                        <div className="flex justify-between items-center mb-1 gap-2">
                            <label className="text-xs text-[var(--text-sub)] font-bold shrink-0">自动备份</label>
                            <select
                                className="text-[10px] px-2 py-1 rounded border border-[var(--border)] bg-[var(--app-bg)] text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
                                value={safeWebdavConfig.autoBackupInterval || 120}
                                onChange={(e) => {
                                    updateWebdavConfig('autoBackupInterval', parseInt(e.target.value));
                                }}
                                // onBlur removed
                                disabled={!safeWebdavConfig.enabled}
                            >
                                <option value={30}>30秒</option>
                                <option value={60}>1分钟</option>
                                <option value={120}>2分钟</option>
                                <option value={300}>5分钟</option>
                                <option value={600}>10分钟</option>
                                <option value={1800}>30分钟</option>
                            </select>
                            <button
                                onClick={() => {
                                    updateWebdavConfig('enabled', !safeWebdavConfig.enabled);
                                    // Switch 比较特殊，自动保存会监测 Store 变化，无需手动处理
                                }}
                                className={`w-8 h-4 rounded-full transition-colors relative duration-300 shrink-0 ${safeWebdavConfig.enabled ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
                                    }`}
                            >
                                <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 left-0.5 transition-transform duration-300 shadow-sm ${safeWebdavConfig.enabled ? 'translate-x-4' : 'translate-x-0'
                                    }`} />
                            </button>
                        </div>

                        {/* 配置输入 */}
                        <div className="space-y-2">
                            <div>
                                <label className="text-[10px] text-[var(--text-sub)] block mb-1">服务器地址 (URL)</label>
                                <input
                                    className="w-full text-xs p-2 rounded border border-[var(--border)] bg-[var(--app-bg)] text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
                                    placeholder="https://dav.example.com/novel_backup/"
                                    value={safeWebdavConfig.url || ''}
                                    onChange={(e) => updateWebdavConfig('url', e.target.value)}
                                // onBlur removed
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] text-[var(--text-sub)] block mb-1">用户名</label>
                                    <input
                                        className="w-full text-xs p-2 rounded border border-[var(--border)] bg-[var(--app-bg)] text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
                                        value={safeWebdavConfig.username || ''}
                                        onChange={(e) => updateWebdavConfig('username', e.target.value)}
                                    // onBlur removed
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-[var(--text-sub)] block mb-1">密码</label>
                                    <input
                                        type="password"
                                        className="w-full text-xs p-2 rounded border border-[var(--border)] bg-[var(--app-bg)] text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
                                        value={safeWebdavConfig.password || ''}
                                        onChange={(e) => updateWebdavConfig('password', e.target.value)}
                                    // onBlur removed
                                    />
                                </div>
                            </div>
                        </div>

                        {/* ... rest of the component ... */}

                        {/* 操作按钮 */}
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={testWebDAV}
                                className={`w-full py-2 rounded text-xs font-bold flex items-center justify-center gap-2 transition-all border ${webdavStatus === 'success'
                                    ? 'bg-green-50 border-green-200 text-green-600'
                                    : webdavStatus === 'error'
                                        ? 'bg-red-50 border-red-200 text-red-600'
                                        : 'bg-[var(--app-bg)] border-[var(--border)] text-[var(--text-main)] hover:border-[var(--accent)]'
                                    }`}
                            >
                                {webdavStatus === 'testing' ? <RotateCcw className="animate-spin" size={14} /> :
                                    webdavStatus === 'success' ? <CheckCircle size={14} /> :
                                        webdavStatus === 'error' ? <XCircle size={14} /> :
                                            <Wifi size={14} />}
                                {webdavStatus === 'testing' ? '测试中...' :
                                    webdavStatus === 'success' ? '连接成功' :
                                        webdavStatus === 'error' ? '连接失败' : '测试链接'}
                            </button>
                            <button
                                onClick={onManualBackup}
                                className="w-full py-2 bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 rounded flex items-center justify-center gap-2 text-xs font-bold transition-all shadow-sm"
                            >
                                <Upload size={14} /> 立即手动备份
                            </button>
                        </div>

                        {/* 查看云端列表 */}
                        <button
                            onClick={fetchWebDAVFiles}
                            className="w-full py-2 bg-[var(--accent-bg)] border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white rounded flex items-center justify-center gap-2 text-xs font-bold transition-all"
                        >
                            {isCloudLoading ? <RotateCcw className="animate-spin" size={14} /> : <DownloadCloud size={14} />}
                            查看云端备份列表
                        </button>

                        {/* 云端文件列表 */}
                        {cloudFiles.length > 0 && (
                            <div className="mt-3 border border-[var(--border)] rounded-lg overflow-hidden animate-in fade-in slide-in-from-top-2">
                                <div className="bg-[var(--app-bg)] px-2 py-1 text-[10px] font-bold text-[var(--text-sub)] border-b border-[var(--border)]">
                                    云端备份列表
                                </div>
                                <div className="max-h-40 overflow-y-auto bg-[var(--panel-bg)] custom-scrollbar">
                                    {cloudFiles.map((file, idx) => (
                                        <div
                                            key={idx}
                                            className="px-2 py-2 text-xs border-b border-[var(--border)] last:border-0 hover:bg-[var(--hover-bg)] flex items-center justify-between gap-2 text-[var(--text-main)] group"
                                        >
                                            <div
                                                className="flex items-center gap-2 truncate cursor-pointer flex-1"
                                                onClick={() => restoreFromCloud(file.name)}
                                                title="点击恢复"
                                            >
                                                <FileJson size={12} className="shrink-0 text-[var(--accent)]" />
                                                {decodeURIComponent(file.name)}
                                            </div>
                                            <button
                                                onClick={() => deleteWebDAVFile(file.name)}
                                                className="p-1 text-[var(--text-sub)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                title="永久删除云端备份"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </SettingSection>
            )}

            {/* 本地备份与恢复 */}
            <SettingSection title={<><FileJson size={16} /> 本地备份与恢复</>}>
                <div className="bg-[var(--panel-bg)] p-3 rounded-lg border border-[var(--border)] space-y-2">
                    <button
                        onClick={handleExportJSON}
                        className="w-full py-2 bg-[var(--app-bg)] border border-[var(--border)] hover:border-[var(--accent)] text-[var(--text-main)] hover:text-[var(--accent)] rounded flex items-center justify-center gap-2 text-xs font-bold transition-all"
                    >
                        <Download size={14} /> 导出全量备份 (JSON)
                    </button>
                    <div className="relative w-full">
                        <input
                            type="file"
                            accept=".json"
                            onChange={handleImportJSON}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <button className="w-full py-2 bg-[var(--app-bg)] border border-[var(--border)] hover:border-green-400 text-[var(--text-main)] hover:text-green-600 rounded flex items-center justify-center gap-2 text-xs font-bold transition-all">
                            <Upload size={14} /> 导入数据 (新建书籍)
                        </button>
                    </div>
                </div>
            </SettingSection>
        </>
    );
}
