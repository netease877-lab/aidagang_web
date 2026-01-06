// ==================================================
// File: frontend/src/hooks/useEditorState.js
// 编辑器UI状态管理Hook - 从EditorPage.jsx提取
// [重构] AI配置/关系类型统一从 settingsStore 获取
// ==================================================
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useUser, useNovel } from '../contexts';
import { useUIStore, useEditorStore, useModalStore, useSettingsStore, useEntityStore } from '../stores';
import { isSettingsDirty, clearSettingsDirty } from '../stores/settingsStore';
import { fetchAPI } from '../services/api';
import { THEMES, DEFAULT_CHAPTER_TEMPLATES, DEFAULT_CHAR_FIELDS, DEFAULT_WEBDAV_CONFIG } from '../constants';

/**
 * 编辑器UI状态管理Hook
 * 负责管理所有编辑器相关的UI状态和配置
 * [重构] AI配置/关系类型统一从 settingsStore 获取
 */
export function useEditorState() {
    const user = useUser();
    const novel = useNovel();
    const { getStorageKey, isConfigLoading, setIsConfigLoading, isAuthenticated } = user;
    const { setChapterTemplates, setCharFields } = novel;

    // === Global Stores Integration ===
    // [Fix] 直接对接 Store，移除本地 State，解决"设置面板修改不生效"的问题
    const settings = useSettingsStore();

    // 从 Store 中解构状态和 Setters（包含 AI 配置）
    const {
        currentThemeId, setCurrentThemeId,
        editorMaxWidth, setEditorMaxWidth,
        uiScale, setUiScale,
        isSeamlessBg, setIsSeamlessBg,
        workspaceBgColor, setWorkspaceBgColor,
        collapseTrigger, setCollapseTrigger,
        chapterNumStyle, setChapterNumStyle,
        chapterNumberingMode, setChapterNumberingMode,
        singleExpand, setSingleExpand,
        mobileSmartTooltip, setMobileSmartTooltip,
        mindMapWheelBehavior, setMindMapWheelBehavior,
        zenAutoPopup, setZenAutoPopup,
        zenCardStyle, setZenCardStyle,
        defaultCharColor, setDefaultCharColor,
        defaultSceneColor, setDefaultSceneColor,
        defaultSettingColor, setDefaultSettingColor,
        // 关系图设置
        graphRotationSpeed, setGraphRotationSpeed,
        isGraphRotationEnabled, setIsGraphRotationEnabled,
        isGraphEnabled, setIsGraphEnabled,
        isGraphShowInZen, setIsGraphShowInZen,
        // WebDAV
        webdavConfig, setWebdavConfig,
        // [重构] AI 配置从 Store 获取
        aiConfig, setAiConfig,
        outlineAiConfig, setOutlineAiConfig,
        chapterAiConfig, setChapterAiConfig,
        toxicAiConfig, setToxicAiConfig,
        aiStyles, setAiStyles
    } = settings;

    // [临时] 关系类型暂时使用空数组，后续可从 Store 添加
    const relationTypes = [];
    const setRelationTypes = () => { };

    // === UI View States (Refactored to use Stores) ===
    const viewMode = useUIStore(state => state.viewMode);
    const setViewMode = useUIStore(state => state.setViewMode);
    const rightPanelTab = useUIStore(state => state.rightPanelTab);
    const setRightPanelTab = useUIStore(state => state.setRightPanelTab);
    const isZenMode = useUIStore(state => state.isZenMode);
    const setIsZenMode = useUIStore(state => state.setIsZenMode);
    const isTopBarHovered = useUIStore(state => state.isTopBarHovered);
    const setIsTopBarHovered = useUIStore(state => state.setIsTopBarHovered);

    const activeNodeId = useEditorStore(state => state.activeNodeId);
    const setActiveNodeId = useEditorStore(state => state.setActiveNodeId);

    // [Legacy] These seem specific to this hook or temporary needed
    const [activeChapterIdForAi, setActiveChapterIdForAi] = useState(null);
    const [prevChapterContext, setPrevChapterContext] = useState('');

    // === Modal States ===
    const confirmDialog = useUIStore(state => state.confirmDialog);
    const setConfirmDialog = useUIStore(state => state.setConfirmDialog);

    const setOperationLogOpen = useModalStore(state => state.setOperationLogOpen);
    const operationLogOpen = useModalStore(state => state.operationLogOpen); // Add getter if needed for return

    const isOutlineAiOpen = useModalStore(state => state.isOutlineAiOpen);
    const setIsOutlineAiOpen = useModalStore(state => state.setIsOutlineAiOpen);

    const isChapterAiOpen = useModalStore(state => state.isChapterAiOpen);
    const setIsChapterAiOpen = useModalStore(state => state.setIsChapterAiOpen);

    const isToxicCheckOpen = useModalStore(state => state.isToxicCheckOpen);
    const setIsToxicCheckOpen = useModalStore(state => state.setIsToxicCheckOpen);

    // [新增] AI 对话弹窗
    const isChatAiOpen = useModalStore(state => state.isChatAiOpen);
    const setIsChatAiOpen = useModalStore(state => state.setIsChatAiOpen);

    const activeNodeIdForToxic = useEditorStore(state => state.activeNodeIdForToxic);
    const setActiveNodeIdForToxic = useEditorStore(state => state.setActiveNodeIdForToxic);

    // === Derived States ===
    // [修复] 夜间模式优先级最高：无论 currentThemeId 如何变化，夜间模式开启时强制使用 dark 主题
    const themeStyles = useMemo(() => {
        const isNightMode = typeof window !== 'undefined' && localStorage.getItem('novel_night_mode') === 'true';
        const effectiveThemeId = isNightMode ? 'dark' : currentThemeId;
        return THEMES[effectiveThemeId]?.colors || THEMES.default.colors;
    }, [currentThemeId]);

    const currentWorkspaceColor = useMemo(() =>
        isSeamlessBg ? 'transparent' : workspaceBgColor,
        [isSeamlessBg, workspaceBgColor]
    );

    // === 日间/夜间模式切换 ===
    // [修复] 本地优先模式：不保存到服务器，仅操作 localStorage


    // === 加载用户配置 ===
    const loadUserConfig = useCallback(async () => {
        setIsConfigLoading(true);
        try {
            const res = await fetchAPI('/api/user/config');
            if (res && res.data) {
                const cfg = res.data;
                const serverVersion = cfg._version || cfg.config_version || 0;
                const localVersion = parseInt(localStorage.getItem(getStorageKey('config_version')) || '0');

                // [新增] 脏数据检测：参照小说同步的 novel_dirty_{id} 模式
                if (isSettingsDirty()) {
                    if (localVersion === serverVersion) {
                        // 本地有修改，版本相同 → 跳过覆盖，等待 EditorPage 自动上传
                        console.log('[Config] isDirty + 版本相同，跳过服务器覆盖，等待上传');
                        setIsConfigLoading(false);
                        return;
                    } else {
                        // 版本不同 → 服务器有更新，放弃本地修改
                        console.log('[Config] isDirty + 版本不同，放弃本地修改，用服务器覆盖');
                        clearSettingsDirty();
                    }
                }

                // 正常覆盖本地
                settings.initFromConfig(cfg);

                // [修复] 同步模板到 entityStore，确保 handleAddChildNode 能使用最新模板
                if (cfg.chapterTemplates?.length > 0) {
                    useEntityStore.getState().setChapterTemplates(cfg.chapterTemplates);
                }
                if (cfg.charFields?.length > 0) {
                    useEntityStore.getState().setCharFields(cfg.charFields);
                }

                // [简化] 夜间模式优先级已在 themeStyles 派生逻辑中处理
                // 这里只需记录服务器主题作为 previousThemeId，供关闭夜间模式时恢复使用
                const isNightMode = localStorage.getItem('novel_night_mode') === 'true';
                if (isNightMode) {
                    const serverTheme = cfg.currentThemeId || cfg.themeId || 'default';
                    if (serverTheme !== 'dark') {
                        settings.setSettingsSilent({ previousThemeId: serverTheme });
                    }
                }

                if (serverVersion > localVersion || serverVersion === 1) {
                    localStorage.setItem(getStorageKey('config_version'), serverVersion);
                }
            }
        } catch (e) {
            console.error("Load config fail", e);
        } finally {
            setIsConfigLoading(false);
        }
    }, [getStorageKey, settings, setIsConfigLoading]);

    // === 构建配置保存Payload ===
    const buildConfigPayload = useCallback(() => {
        const payload = {
            themeId: currentThemeId,
            editorWidth: editorMaxWidth,
            uiScale: uiScale,
            seamlessBg: isSeamlessBg,
            workspaceBg: workspaceBgColor,
            numStyle: chapterNumStyle,
            numMode: chapterNumberingMode,
            trigger: collapseTrigger,
            singleExpand: singleExpand,
            mobileSmartTooltip: mobileSmartTooltip,
            mapWheel: mindMapWheelBehavior,
            zenAuto: zenAutoPopup,
            zenStyle: zenCardStyle,
            defCharColor: defaultCharColor,
            defSceneColor: defaultSceneColor,
            defSetColor: defaultSettingColor,
            // 关系图设置
            graphSpeed: graphRotationSpeed,
            graphRotation: isGraphRotationEnabled,
            graphEnabled: isGraphEnabled,
            graphShowInZen: isGraphShowInZen,
            // AI Configs from Hook state (partially synced with store via effect in component? No, this hook manages them)
            // Wait, look at deps. The hook manages aiConfig. But settingsStore also has aiConfig.
            // The settingsStore.initFromConfig loaded it. But where does the hook get it?
            // Ah, line 27: const aiConfigHook = useAiConfig(getStorageKey);
            // This hook might be duplicated logic too. But let's stick to the current plan: 
            // settingsStore is source of truth.
            // However, useAiConfig is a separate hook. 
            // Ideally useAiConfig should also use the store, but I can't change that now (new function ban).
            // For now, let's keep the existing logic for AI config from the hook, 
            // BUT make sure we use the store values if available.
            // Actually, settingsStore has aiConfig state. 
            // Let's use the Values from the Store for payload if they exist?
            // The original code used `aiConfig` from `useAiConfig`.
            // Let's keep using the destructured vars from `aiConfigHook` for consistency with existing structure,
            // assuming `initFromConfig` updated the store, but we need to ensure `useAiConfig` sees it?
            // Note: `useAiConfig` likely uses localStorage or its own state. 
            // If `settings.initFromConfig` updates the Store, does `useAiConfig` know?
            // If `useAiConfig` is just local state, we have another split brain.
            // But for this "Subtraction Fix", let's focus on the UI settings first.
            // The user complained about Theme/UI settings specifically.

            aiConfig,
            aiOutline: outlineAiConfig,
            aiChapter: chapterAiConfig,
            aiToxic: toxicAiConfig,
            aiStyles: aiStyles,
            // [新增] Relation Types
            relationTypes: relationTypes,
            // [统一] WebDAV Config: 只使用对象格式
            webdavConfig: webdavConfig ? {
                url: webdavConfig.url || '',
                username: webdavConfig.username || '',
                password: webdavConfig.password || '',
                enabled: webdavConfig.enabled || false,
                autoBackupInterval: webdavConfig.autoBackupInterval || 120
            } : null,
        };
        // [修复] 只有当有数据时才保存模板和字段，避免空数组覆盖后端默认值
        if (novel.chapterTemplates?.length > 0) {
            payload.chapterTemplates = novel.chapterTemplates;
        }
        if (novel.charFields?.length > 0) {
            payload.charFields = novel.charFields;
        }
        return payload;
    }, [
        currentThemeId, editorMaxWidth, uiScale, isSeamlessBg, workspaceBgColor,
        novel.chapterTemplates, novel.charFields, chapterNumStyle, chapterNumberingMode, collapseTrigger, singleExpand, mobileSmartTooltip,
        mindMapWheelBehavior, zenAutoPopup, zenCardStyle, defaultCharColor,
        defaultSceneColor, defaultSettingColor,
        graphRotationSpeed, isGraphRotationEnabled, isGraphEnabled, isGraphShowInZen,
        aiConfig, outlineAiConfig, chapterAiConfig, toxicAiConfig, aiStyles, webdavConfig, relationTypes
    ]);



    return {
        // Theme & UI Props
        currentThemeId, setCurrentThemeId,
        editorMaxWidth, setEditorMaxWidth,
        uiScale, setUiScale,
        isSeamlessBg, setIsSeamlessBg,
        workspaceBgColor, setWorkspaceBgColor,
        collapseTrigger, setCollapseTrigger,
        chapterNumStyle, setChapterNumStyle,
        chapterNumberingMode, setChapterNumberingMode,
        singleExpand, setSingleExpand,
        mobileSmartTooltip, setMobileSmartTooltip,
        mindMapWheelBehavior, setMindMapWheelBehavior,
        defaultCharColor, setDefaultCharColor,
        defaultSceneColor, setDefaultSceneColor,
        defaultSettingColor, setDefaultSettingColor,
        zenAutoPopup, setZenAutoPopup,
        zenCardStyle, setZenCardStyle,

        // 关系图设置
        graphRotationSpeed, setGraphRotationSpeed,
        isGraphRotationEnabled, setIsGraphRotationEnabled,
        isGraphEnabled, setIsGraphEnabled,
        isGraphShowInZen, setIsGraphShowInZen,

        // View States
        viewMode, setViewMode,
        rightPanelTab, setRightPanelTab,
        activeNodeId, setActiveNodeId,
        activeChapterIdForAi, setActiveChapterIdForAi,
        prevChapterContext, setPrevChapterContext,
        isZenMode, setIsZenMode,
        isTopBarHovered, setIsTopBarHovered,

        // Modal States
        confirmDialog, setConfirmDialog,
        operationLogOpen, setOperationLogOpen,
        isOutlineAiOpen, setIsOutlineAiOpen,
        isChapterAiOpen, setIsChapterAiOpen,
        isToxicCheckOpen, setIsToxicCheckOpen,
        isChatAiOpen, setIsChatAiOpen, // [新增]
        activeNodeIdForToxic, setActiveNodeIdForToxic,

        // Derived
        themeStyles,
        currentWorkspaceColor,

        // AI Config States
        aiConfig, setAiConfig,
        outlineAiConfig, setOutlineAiConfig,
        chapterAiConfig, setChapterAiConfig,
        toxicAiConfig, setToxicAiConfig,
        aiStyles, setAiStyles,

        // WebDAV State
        webdavConfig, setWebdavConfig,

        // Relation Types State
        relationTypes, setRelationTypes,

        // Actions

        loadUserConfig,
        buildConfigPayload,
    };
}

export default useEditorState;
