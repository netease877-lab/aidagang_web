// ==================================================
// File: frontend/src/pages/EditorPage.jsx
// [激进重构] 删除 sharedProps，子组件直接从 Stores/Contexts 获取数据
// ==================================================
import React, { useEffect, useMemo, useCallback } from 'react';
import { useMediaQuery } from 'react-responsive';
import AppUI from '../components/AppUI';
import { useNovelSync } from '../hooks/useNovelSync';
import { useAutoSave } from '../hooks/useAutoSave';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useEditorState } from '../hooks/useEditorState';
import { useRelations } from '../hooks/useRelations';
import { useWebSocket } from '../hooks/useWebSocket';
import { useCollaboration } from '../hooks/useCollaboration';
import { useToast, useUser, useNovel } from '../contexts';
import { fetchAPI } from '../services/api';
import { buildNodeIndexMap, buildSmartContextData, fetchContextForAi } from '../utils/treeUtils'; // [修复] 引入正版 fetchContextForAi

// [激进重构] 直接导入 Stores
import { useUIStore, useEditorStore, useModalStore, useEntityStore, useSettingsStore } from '../stores';
import { clearSettingsDirty, isSettingsDirty } from '../stores/settingsStore';

export default function EditorPage() {
    // --- Global Contexts ---
    const toast = useToast();
    const { showToast } = toast;
    const user = useUser();
    const novel = useNovel();
    const entityStore = useEntityStore();

    const { isAuthenticated, getStorageKey, isConfigLoading, setIsConfigLoading } = user;
    const { currentNovelId, operationLog } = novel;
    const data = entityStore.data; // [Refactor] Get data from EntityStore

    // --- Hooks ---
    const isMobile = useMediaQuery({ query: '(max-width: 768px)' });
    const { wsStatus, sendMessage, lastCollabMessage } = useWebSocket();
    const collab = useCollaboration({ sendMessage });
    const { handleCollabMessage } = collab;

    useEffect(() => {
        if (lastCollabMessage) handleCollabMessage(lastCollabMessage);
    }, [lastCollabMessage, handleCollabMessage]);

    // [新增] 保险机制：settingsStore 变化时，自动覆盖到 entityStore
    // 确保 settingsStore 是模版和颜色的唯一权威来源
    const settingsTemplates = useSettingsStore(state => state.chapterTemplates);
    const settingsCharFields = useSettingsStore(state => state.charFields);
    const settingsCharColor = useSettingsStore(state => state.defaultCharColor);
    const settingsSceneColor = useSettingsStore(state => state.defaultSceneColor);
    const settingsSettingColor = useSettingsStore(state => state.defaultSettingColor);

    useEffect(() => {
        const es = useEntityStore.getState();
        // 整体判断：任意一个值不同就全部同步
        const needSync =
            (settingsTemplates?.length > 0 && JSON.stringify(es.chapterTemplates) !== JSON.stringify(settingsTemplates)) ||
            (settingsCharFields?.length > 0 && JSON.stringify(es.charFields) !== JSON.stringify(settingsCharFields)) ||
            (settingsCharColor && es.defaultCharColor !== settingsCharColor) ||
            (settingsSceneColor && es.defaultSceneColor !== settingsSceneColor) ||
            (settingsSettingColor && es.defaultSettingColor !== settingsSettingColor);

        if (needSync) {
            if (settingsTemplates?.length > 0) es.setChapterTemplates(settingsTemplates);
            if (settingsCharFields?.length > 0) es.setCharFields(settingsCharFields);
            if (settingsCharColor) es.setDefaultCharColor(settingsCharColor);
            if (settingsSceneColor) es.setDefaultSceneColor(settingsSceneColor);
            if (settingsSettingColor) es.setDefaultSettingColor(settingsSettingColor);
        }
    }, [settingsTemplates, settingsCharFields, settingsCharColor, settingsSceneColor, settingsSettingColor]);

    // --- useEditorState 管理 UI 状态 ---
    const editorState = useEditorState();
    const {
        chapterNumberingMode,
        themeStyles,
        loadUserConfig,
        buildConfigPayload,
    } = editorState;

    // [激进重构] 移除手动同步代码
    // useEditorState 现在直接操作 Store，因此无需在此手动同步
    // const setViewMode = useUIStore(state => state.setViewMode);
    // const setActiveNodeId = useEditorStore(state => state.setActiveNodeId);

    // [修复] 获取 Store Setter 用于更新计算状态
    const setNodeIndexMap = useEditorStore(state => state.setNodeIndexMap);
    const setSmartContextData = useEditorStore(state => state.setSmartContextData);

    // [关键修复] 恢复上下文到 Store 的同步桥接
    // 原因：useNovelSync 仍然使用 Context 更新数据，而 UI 组件已迁移至 useEntityStore
    // 必须保留以此桥接，否则 RightPanel 等组件无法获取数据！
    // [已修复] 移除被动同步代码，改为在 NovelContext 中主动推送
    // useEffect(() => {
    //     const state = useEntityStore.getState();
    //     if (novel.characters) state.setCharacters(novel.characters);
    //     if (novel.scenes) state.setScenes(novel.scenes);
    //     if (novel.worldSettings) state.setWorldSettings(novel.worldSettings);
    //     if (novel.charCats) state.setCharCats(novel.charCats);
    //     if (novel.sceneCats) state.setSceneCats(novel.sceneCats);
    //     if (novel.settingCats) state.setSettingCats(novel.settingCats);
    //     if (novel.charFields) state.setCharFields(novel.charFields);
    //     if (novel.relations) state.setRelations(novel.relations);
    // }, [
    //     novel.characters, novel.scenes, novel.worldSettings,
    //     novel.charCats, novel.sceneCats, novel.settingCats,
    //     novel.charFields, novel.relations
    // ]);

    // 下面的 useEffect 块已废弃
    /*
    useEffect(() => {
        if (editorState.viewMode !== undefined) setViewMode(editorState.viewMode);
    }, [editorState.viewMode, setViewMode]);
    // ... other sync effects
    */

    // 下面的 useEffect 块已废弃（重复代码已删除）

    // --- 计算派生数据并同步到 Store ---
    const activeNodeId = useEditorStore(state => state.activeNodeId);

    // [修复] 细纲关键词配置，用于 AI 插入时查找细纲节点
    const outlineKeywords = useMemo(() => ['细纲', '大纲', '梗概', '提纲', 'outline'], []);

    // [修复] 查找章节下的细纲子节点
    const findOutlineChildNode = useCallback((chapterId) => {
        const findChapter = (nodes) => {
            for (const node of nodes) {
                if (node.id === chapterId && node.type === 'chapter') {
                    return node;
                }
                if (node.children) {
                    const found = findChapter(node.children);
                    if (found) return found;
                }
            }
            return null;
        };

        const chapter = findChapter(data || []);
        if (!chapter || !chapter.children || chapter.children.length === 0) {
            return null;
        }

        // 优先: 找标题含配置关键词的子节点
        const xigang = chapter.children.find(child =>
            outlineKeywords.some(kw => child.title?.includes(kw))
        );
        if (xigang) {
            return xigang;
        }

        // 次之: 第一个子节点
        return chapter.children[0];
    }, [data, outlineKeywords]);

    useEffect(() => {
        const entities = {
            characters: entityStore.characters || [],
            scenes: entityStore.scenes || [],
            worldSettings: entityStore.worldSettings || []
        };
        const options = { chapterNumberingMode };
        const indexMap = buildNodeIndexMap(data || [], options);
        const smartContext = buildSmartContextData(data || [], activeNodeId, entities, options);

        setNodeIndexMap(indexMap);
        setSmartContextData(smartContext);
    }, [data, activeNodeId, entityStore.characters, entityStore.scenes, entityStore.worldSettings, chapterNumberingMode, setNodeIndexMap, setSmartContextData]);

    // --- Sync Logic ---
    const { sync } = useNovelSync();
    const { triggerSave, syncToWebDAV, lastSaved, webdavSyncStatus, webdavLastMsg } = useAutoSave();
    const { relations, fetchRelations } = useRelations(currentNovelId);

    // Initial Load Effect
    // Initial Load Effect
    // [修复] 移除 user.config 依赖，防止本地修改配置时触发不必要的重新加载（导致旧数据覆盖新数据）
    const isInitializedRef = React.useRef(false);
    useEffect(() => {
        if (isAuthenticated && !isInitializedRef.current) {
            isInitializedRef.current = true;
            // 仅在首次认证通过时加载配置，并触发后台同步
            loadUserConfig();
            sync();

            // [重构] 移除强制 initFromConfig 调用
            // settingsStore 已经通过 persist 自动加载了本地配置 (Local-First)
            // loadUserConfig() 返回后会自动调用 updateConfig -> Store.initFromConfig (带脏检查)
            // 从而实现：先显示本地 -> 后台拉取 -> 无冲突则静默更新
        }
    }, [isAuthenticated]); // 仅依赖认证状态变化

    // --- Config Auto-Save ---
    const lastSavedConfigRef = React.useRef(null);
    useEffect(() => {
        if (!isAuthenticated || isConfigLoading) return;

        const currentPayload = buildConfigPayload();
        const currentHash = JSON.stringify(currentPayload);

        if (lastSavedConfigRef.current === currentHash) {
            return;
        }
        lastSavedConfigRef.current = currentHash;

        // [修复] 立即设置配置保存锁，告诉 pong 跳过配置版本检测
        window.__configSavingLock = true;

        const timer = setTimeout(async () => {
            try {
                // [新增] 读取当前版本号作为 base_version
                const baseVersion = parseInt(localStorage.getItem(getStorageKey('config_version')) || '0');

                // [Fix] Use correct endpoint PATCH /api/users/me
                const res = await fetchAPI('/api/users/me', 'PATCH', {
                    config: currentPayload,
                    base_version: baseVersion  // [新增] 传版本号给后端校验
                });
                // [修复] 保存成功后立即更新本地版本号，防止回声广播触发远程拉取
                if (res?.config_version) {
                    localStorage.setItem(getStorageKey('config_version'), res.config_version.toString());
                    clearSettingsDirty();  // [新增] 上传成功，清除脏标记
                }
            } catch (e) {
                // [新增] 409 冲突时保持 dirty，下次刷新会处理
                if (e.status === 409) {
                    console.warn('[Config] 版本冲突，保持 dirty 状态');
                } else {
                    console.error('[Config] Auto-save failed:', e);
                }
            } finally {
                // [修复] 释放配置保存锁
                window.__configSavingLock = false;
            }
        }, 2000);

        return () => clearTimeout(timer);
    }, [isAuthenticated, isConfigLoading, buildConfigPayload]);

    // --- Shortcuts ---
    const shortcuts = {
        s: () => triggerSave(),
        r: () => sync(),
    };
    useKeyboardShortcuts(shortcuts);

    // --- 构建传递给 AppUI 的最小化 Props ---
    // [激进重构] 只传递必要的函数引用和状态，子组件自行从 Stores 获取数据
    const appUIProps = {
        // 必要的 Context 引用
        isMobile,
        themeStyles,

        // 弹窗状态 (Modal Store 会接管，但 AppUI 需要控制)
        confirmDialog: editorState.confirmDialog,
        setConfirmDialog: editorState.setConfirmDialog,

        // 冲突处理
        conflictDialogOpen: novel.conflictDialogOpen,
        setConflictDialogOpen: novel.setConflictDialogOpen,
        conflictData: novel.conflictData,
        onMergeConflict: async (selections) => {
            await novel.handleMergeConflict(selections);
            // [修复] 解决冲突后强制触发保存
            triggerSave();
        },

        // 操作日志
        operationLogOpen: editorState.operationLogOpen,
        setOperationLogOpen: editorState.setOperationLogOpen,
        operationLog,

        // AI 弹窗
        isOutlineAiOpen: editorState.isOutlineAiOpen,
        setIsOutlineAiOpen: editorState.setIsOutlineAiOpen,
        isChapterAiOpen: editorState.isChapterAiOpen,
        setIsChapterAiOpen: editorState.setIsChapterAiOpen,
        isToxicCheckOpen: editorState.isToxicCheckOpen,
        setIsToxicCheckOpen: editorState.setIsToxicCheckOpen,
        activeNodeIdForToxic: editorState.activeNodeIdForToxic,
        // [新增] AI 对话弹窗
        isChatAiOpen: editorState.isChatAiOpen,
        setIsChatAiOpen: editorState.setIsChatAiOpen,

        // AI 相关函数（activeChapterIdForAi 已改由 AppUI 直接从 Store 获取）
        // [修复] fetchContextForAi 需要 nodeIndexMap 参数
        // [修复] Task 10: 即使在 React 渲染周期未更新时，也强制从 Store 获取最新数据
        fetchContextForAi: useCallback((nodeId, mode, extraOptions = {}) => {
            // 从 EditorStore 获取最新的 nodeIndexMap
            const nodeIndexMap = useEditorStore.getState().nodeIndexMap || {};
            // [关键] 从 EntityStore 获取最新数据（解决新建章节后立即点击 AI 上下文滞后问题）
            const currentData = useEntityStore.getState().data || [];

            return fetchContextForAi(currentData, nodeId, mode, {
                chapterNumberingMode: editorState.chapterNumberingMode,
                nodeIndexMap,
                ...extraOptions // [修复] 透传额外选项 (如 start, end)
            });
        }, [editorState.chapterNumberingMode]), // Removed 'data' dependency
        // [修复] AI 细纲插入到章节下的子项中
        handleInsertAiContent: useCallback((chapterId, content) => {
            const targetNode = findOutlineChildNode(chapterId);
            if (targetNode) {
                novel.handleUpdateNode(targetNode.id, { content: content });
            } else {
                // 回退：章节无子节点，写入章节本身
                novel.handleUpdateNode(chapterId, { content: content });
            }
        }, [novel, findOutlineChildNode]),
        // [修复] 毒点检查跳转回调，展开父节点并设置激活节点
        handleSelectChapter: useCallback((id, isLeaf, path) => {
            // [重构] 使用 uiStore 方法展开路径上的节点
            const { setNodesExpanded } = useUIStore.getState();
            if (path && path.length > 0) {
                const idsToExpand = path.map(nodeInfo => nodeInfo.id).filter(nodeId => nodeId !== id);
                if (idsToExpand.length > 0) {
                    setNodesExpanded(idsToExpand, true);
                }
            }
            // [修复] 目标节点本身也需要展开（如果是容器节点）
            if (!isLeaf) {
                setNodesExpanded([id], true);
            }
            useEditorStore.getState().setActiveNodeId(id);
        }, []),

        // 登录状态
        isAuthenticated: user.isAuthenticated,
        setIsAuthenticated: user.setIsAuthenticated,
        isLoginOpen: user.isLoginOpen,
        setIsLoginOpen: user.setIsLoginOpen,
        fetchUserProfile: user.fetchUserProfile,

        // Toast
        toasts: toast.toasts,
        removeToast: toast.removeToast,
        showToast,
        addToast: toast.addToast,

        // 权限和工具
        permissions: user.permissions,
        getStorageKey,
        fetchAPI,

        // 同步状态
        setDbSyncStatus: novel.setDbSyncStatus,
        versionRef: novel.versionRef,
        serverTimestampRef: novel.serverTimestampRef,

        // [Deleted] 协作与 WebDAV (Layout 自取)
        // wsStatus,
        // remoteEditors: collab.remoteEditors,
        // webdavSyncStatus,
        // webdavLastMsg,
        // syncToWebDAV,

        // 数据 (用于 AI 弹窗)
        // data, // [Deleted] Layout 自取
        characters: entityStore.characters || [],
        scenes: entityStore.scenes || [],
        charCats: entityStore.charCats || [],
        sceneCats: entityStore.sceneCats || [],
        charFields: entityStore.charFields || [],
    };

    return <AppUI key={novel.currentNovelId} {...appUIProps} />;
}
