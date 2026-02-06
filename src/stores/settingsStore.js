/**
 * settingsStore - 用户设置状态管理
 * [激进重构] 从 EditorPage props 提取，统一管理所有用户配置
 * [Fix] 恢复与旧代码一致的默认值
 * [新增] 使用 persist 中间件实现 localStorage 持久化，支持多用户隔离
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { DEFAULT_AI_CONFIG, DEFAULT_OUTLINE_AI_CONFIG, DEFAULT_CHAPTER_AI_CONFIG, DEFAULT_TOXIC_AI_CONFIG, DEFAULT_CHAT_AI_CONFIG, DEFAULT_STYLES, ZEN_CARD_STYLES } from '../constants';

// 动态获取用户 ID，与 UserContext.getStorageKey 逻辑一致
const LAST_USER_KEY = 'novel_studio_last_user_id';
const getSettingsKey = () => {
    const cachedUserId = localStorage.getItem(LAST_USER_KEY);
    return cachedUserId ? `novel_studio_${cachedUserId}_settings` : 'novel_studio_guest_settings';
};

// [新增] 脏数据标记函数（参照小说同步的 novel_dirty_{id} 模式）
export function markSettingsDirty() {
    const userId = localStorage.getItem(LAST_USER_KEY);
    if (userId) {
        localStorage.setItem(`novel_studio_${userId}_settings_dirty`, 'true');
    }
}

export function clearSettingsDirty() {
    const userId = localStorage.getItem(LAST_USER_KEY);
    if (userId) {
        localStorage.removeItem(`novel_studio_${userId}_settings_dirty`);
    }
}

export function isSettingsDirty() {
    const userId = localStorage.getItem(LAST_USER_KEY);
    return userId && localStorage.getItem(`novel_studio_${userId}_settings_dirty`) === 'true';
}

export const useSettingsStore = create(

    persist(
        (set, get) => ({
            // === 主题与外观 ===
            currentThemeId: 'default',
            previousThemeId: null, // [修复] 记住切换前的主题
            uiScale: 100,
            isSeamlessBg: false,
            workspaceBgColor: '#eff6ff', // [Fix] 恢复旧代码固定色值

            // === 颜色配置 === [Fix] 恢复旧代码颜色
            defaultCharColor: '#22c55e',
            defaultSceneColor: '#0ea5e9',
            defaultSettingColor: '#a855f7',

            // === 专注模式 ===
            zenAutoPopup: true,
            zenCardStyle: 'glass', // [Fix] 恢复旧代码默认值

            // === 编辑器配置 === [Fix] 恢复旧代码默认值
            editorMaxWidth: 900,
            chapterNumStyle: 'chinese',
            chapterNumberingMode: 'reset',
            collapseTrigger: 'double', // [Fix] 恢复旧代码默认值，与 UI 选项匹配
            singleExpand: false,
            mindMapWheelBehavior: 'ctrl', // [Fix] 恢复旧代码默认值，与 UI 选项匹配
            mobileSmartTooltip: true,

            // === 关系图配置 === [Fix] 恢复旧代码默认值
            graphRotationSpeed: 0.002,
            isGraphRotationEnabled: true,
            isGraphEnabled: true,
            isGraphShowInZen: true,

            // === AI 配置 === [Fix] 使用默认常量，不再是 null
            aiConfig: DEFAULT_AI_CONFIG,
            outlineAiConfig: DEFAULT_OUTLINE_AI_CONFIG,
            chapterAiConfig: DEFAULT_CHAPTER_AI_CONFIG,
            toxicAiConfig: DEFAULT_TOXIC_AI_CONFIG,
            chatAiConfig: DEFAULT_CHAT_AI_CONFIG, // [新增]
            chatDeletedDefaultIds: [], // [新增] 已删除的默认提示词 ID
            aiStyles: DEFAULT_STYLES,

            // === WebDAV 配置 ===
            webdavConfig: null,

            // === 模板配置 ===
            chapterTemplates: [],
            charFields: [],

            // === Setters (Batch) ===
            setSettings: (updates) => { set(updates); markSettingsDirty(); },
            // [新增] 静默设置：用于系统内部操作（如初始化），不触发 dirty 标记
            setSettingsSilent: (updates) => set(updates),

            // === Individual Setters === [新增] 每个 setter 调用 markSettingsDirty 标记脏数据
            setCurrentThemeId: (v) => { set({ currentThemeId: v }); markSettingsDirty(); },
            setUiScale: (v) => { set({ uiScale: v }); markSettingsDirty(); },
            setIsSeamlessBg: (v) => { set({ isSeamlessBg: v }); markSettingsDirty(); },
            setWorkspaceBgColor: (v) => { set({ workspaceBgColor: v }); markSettingsDirty(); },
            setDefaultCharColor: (v) => { set({ defaultCharColor: v }); markSettingsDirty(); },
            setDefaultSceneColor: (v) => { set({ defaultSceneColor: v }); markSettingsDirty(); },
            setDefaultSettingColor: (v) => { set({ defaultSettingColor: v }); markSettingsDirty(); },
            setZenAutoPopup: (v) => { set({ zenAutoPopup: v }); markSettingsDirty(); },
            setZenCardStyle: (v) => { set({ zenCardStyle: v }); markSettingsDirty(); },
            setEditorMaxWidth: (v) => { set({ editorMaxWidth: v }); markSettingsDirty(); },
            setChapterNumStyle: (v) => { set({ chapterNumStyle: v }); markSettingsDirty(); },
            setChapterNumberingMode: (v) => { set({ chapterNumberingMode: v }); markSettingsDirty(); },
            setCollapseTrigger: (v) => { set({ collapseTrigger: v }); markSettingsDirty(); },
            setSingleExpand: (v) => { set({ singleExpand: v }); markSettingsDirty(); },
            setMindMapWheelBehavior: (v) => { set({ mindMapWheelBehavior: v }); markSettingsDirty(); },
            setMobileSmartTooltip: (v) => { set({ mobileSmartTooltip: v }); markSettingsDirty(); },
            setGraphRotationSpeed: (v) => { set({ graphRotationSpeed: v }); markSettingsDirty(); },
            setIsGraphRotationEnabled: (v) => { set({ isGraphRotationEnabled: v }); markSettingsDirty(); },
            setIsGraphEnabled: (v) => { set({ isGraphEnabled: v }); markSettingsDirty(); },
            setIsGraphShowInZen: (v) => { set({ isGraphShowInZen: v }); markSettingsDirty(); },
            // [Fix] AI 配置 setters 支持函数式更新（与 SettingsAI.jsx 兼容）
            setAiConfig: (v) => { set((state) => ({ aiConfig: typeof v === 'function' ? v(state.aiConfig) : v })); markSettingsDirty(); },
            setOutlineAiConfig: (v) => { set((state) => ({ outlineAiConfig: typeof v === 'function' ? v(state.outlineAiConfig) : v })); markSettingsDirty(); },
            setChapterAiConfig: (v) => { set((state) => ({ chapterAiConfig: typeof v === 'function' ? v(state.chapterAiConfig) : v })); markSettingsDirty(); },
            setToxicAiConfig: (v) => { set((state) => ({ toxicAiConfig: typeof v === 'function' ? v(state.toxicAiConfig) : v })); markSettingsDirty(); },
            setChatAiConfig: (v) => { set((state) => ({ chatAiConfig: typeof v === 'function' ? v(state.chatAiConfig) : v })); markSettingsDirty(); }, // [新增]
            setChatDeletedDefaultIds: (v) => { set((state) => ({ chatDeletedDefaultIds: typeof v === 'function' ? v(state.chatDeletedDefaultIds) : v })); markSettingsDirty(); }, // [新增]
            setAiStyles: (v) => { set((state) => ({ aiStyles: typeof v === 'function' ? v(state.aiStyles) : v })); markSettingsDirty(); },
            setWebdavConfig: (v) => { set((state) => ({ webdavConfig: typeof v === 'function' ? v(state.webdavConfig) : v })); markSettingsDirty(); },
            setChapterTemplates: (v) => { set((state) => ({ chapterTemplates: typeof v === 'function' ? v(state.chapterTemplates) : v })); markSettingsDirty(); },
            setCharFields: (v) => { set((state) => ({ charFields: typeof v === 'function' ? v(state.charFields) : v })); markSettingsDirty(); },


            // === 从 userConfig 初始化 ===
            // === 从 userConfig 初始化 ===
            // [重构] Local-First 策略：仅当本地无脏数据时才从云端同步
            initFromConfig: (config) => {
                if (!config) return;

                // [Check 1] 如果本地有未保存的修改 (Dirty)，则忽略云端配置，以本地为准
                if (isSettingsDirty()) {
                    console.log('[Settings] 本地有未保存修改，忽略云端同步');
                    return;
                }

                // [Check 2] 如果是全新加载（Zustand初始化已完成，此处仅做比对更新）
                // 我们直接 set()，但依赖 UserContext 或 EditorPage 传入的 config 必须是云端最新的
                set({
                    currentThemeId: config.currentThemeId || config.themeId || 'default',
                    uiScale: config.uiScale || 100,
                    isSeamlessBg: config.isSeamlessBg || config.seamlessBg || false,
                    workspaceBgColor: config.workspaceBgColor || config.workspaceBg || '#eff6ff',
                    // [Fix] 恢复旧代码颜色默认值
                    defaultCharColor: config.defaultCharColor || config.defCharColor || '#22c55e',
                    defaultSceneColor: config.defaultSceneColor || config.defSceneColor || '#0ea5e9',
                    defaultSettingColor: config.defaultSettingColor || config.defSetColor || '#a855f7',
                    zenAutoPopup: config.zenAutoPopup !== undefined ? config.zenAutoPopup : (config.zenAuto !== false),
                    zenCardStyle: config.zenCardStyle || config.zenStyle || 'glass',
                    // [Fix] 恢复旧代码编辑器默认值
                    editorMaxWidth: config.editorMaxWidth || config.editorWidth || 900,
                    chapterNumStyle: config.chapterNumStyle || config.numStyle || 'chinese',
                    chapterNumberingMode: config.chapterNumberingMode || config.numMode || 'reset',
                    collapseTrigger: config.collapseTrigger || config.trigger || 'double',
                    singleExpand: config.singleExpand || false,
                    mindMapWheelBehavior: config.mindMapWheelBehavior || config.mapWheel || 'ctrl',
                    mobileSmartTooltip: config.mobileSmartTooltip !== false,
                    // [Fix] 恢复旧代码关系图默认值
                    graphRotationSpeed: config.graphRotationSpeed || config.graphSpeed || 0.002,
                    isGraphRotationEnabled: config.isGraphRotationEnabled !== undefined ? config.isGraphRotationEnabled : (config.graphRotation !== false),
                    isGraphEnabled: config.isGraphEnabled !== undefined ? config.isGraphEnabled : (config.graphEnabled !== false),
                    isGraphShowInZen: config.isGraphShowInZen !== undefined ? config.isGraphShowInZen : (config.graphShowInZen !== false),
                    // [Fix] AI 配置使用常量作为 fallback，保留默认提示词
                    aiConfig: config.aiConfig || DEFAULT_AI_CONFIG,
                    // [Fix] 兼容旧字段映射
                    outlineAiConfig: config.outlineAiConfig || config.aiOutline || DEFAULT_OUTLINE_AI_CONFIG,
                    chapterAiConfig: config.chapterAiConfig || config.aiChapter || DEFAULT_CHAPTER_AI_CONFIG,
                    toxicAiConfig: config.toxicAiConfig || config.aiToxic || DEFAULT_TOXIC_AI_CONFIG,
                    chatAiConfig: config.chatAiConfig || DEFAULT_CHAT_AI_CONFIG,
                    chatDeletedDefaultIds: Array.isArray(config.chatDeletedDefaultIds) ? config.chatDeletedDefaultIds : [], // [新增]
                    aiStyles: config.aiStyles || DEFAULT_STYLES,
                    // [统一] WebDAV 配置：只从 webdavConfig 对象加载
                    webdavConfig: config.webdavConfig?.url ? {
                        url: config.webdavConfig.url || '',
                        username: config.webdavConfig.username || '',
                        password: config.webdavConfig.password || '',
                        enabled: config.webdavConfig.enabled || false,
                        autoBackupInterval: config.webdavConfig.autoBackupInterval || 120
                    } : null,

                    // [Fix] 修复模板初始化，确保不为 undefined
                    chapterTemplates: Array.isArray(config.chapterTemplates) ? config.chapterTemplates : [],
                    charFields: Array.isArray(config.charFields) ? config.charFields : [],
                });
            },
        }),
        {
            name: 'settings',
            storage: createJSONStorage(() => ({
                getItem: () => localStorage.getItem(getSettingsKey()),
                setItem: (_, value) => localStorage.setItem(getSettingsKey(), value),
                removeItem: () => localStorage.removeItem(getSettingsKey()),
            })),
            partialize: (state) => ({
                currentThemeId: state.currentThemeId,
                previousThemeId: state.previousThemeId,
                uiScale: state.uiScale,
                isSeamlessBg: state.isSeamlessBg,
                workspaceBgColor: state.workspaceBgColor,
                defaultCharColor: state.defaultCharColor,
                defaultSceneColor: state.defaultSceneColor,
                defaultSettingColor: state.defaultSettingColor,
                zenAutoPopup: state.zenAutoPopup,
                zenCardStyle: state.zenCardStyle,
                editorMaxWidth: state.editorMaxWidth,
                chapterNumStyle: state.chapterNumStyle,
                chapterNumberingMode: state.chapterNumberingMode,
                collapseTrigger: state.collapseTrigger,
                singleExpand: state.singleExpand,
                mindMapWheelBehavior: state.mindMapWheelBehavior,
                mobileSmartTooltip: state.mobileSmartTooltip,
                graphRotationSpeed: state.graphRotationSpeed,
                isGraphRotationEnabled: state.isGraphRotationEnabled,
                isGraphEnabled: state.isGraphEnabled,
                isGraphShowInZen: state.isGraphShowInZen,
                aiConfig: state.aiConfig,
                outlineAiConfig: state.outlineAiConfig,
                chapterAiConfig: state.chapterAiConfig,
                toxicAiConfig: state.toxicAiConfig,
                chatAiConfig: state.chatAiConfig,
                chatDeletedDefaultIds: state.chatDeletedDefaultIds, // [新增]
                aiStyles: state.aiStyles,
                webdavConfig: state.webdavConfig,
                chapterTemplates: state.chapterTemplates,
                charFields: state.charFields,
            }),
        }
    )
);
