/**
 * configUtils.js - 配置同步工具函数
 * 提取设置上传的共用逻辑，避免 useWebSocket.js 和 useEditorState.js 代码重复
 */
import { useSettingsStore } from '../stores';
import { isSettingsDirty, clearSettingsDirty } from '../stores/settingsStore';
import { fetchAPI } from '../services/api';

/**
 * 从 settingsStore 构建配置上传 payload
 * @param {Object} settings - settingsStore.getState() 的结果
 * @param {Object} options - 额外选项
 * @param {Array} options.chapterTemplates - 章节模板（从 novel 获取）
 * @param {Array} options.charFields - 角色字段（从 novel 获取）
 * @param {Array} options.relationTypes - 关系类型
 * @returns {Object} 配置 payload
 */
export function buildConfigPayloadFromStore(settings, options = {}) {
    const payload = {
        // 主题与外观
        themeId: settings.currentThemeId,
        editorWidth: settings.editorMaxWidth,
        uiScale: settings.uiScale,
        seamlessBg: settings.isSeamlessBg,
        workspaceBg: settings.workspaceBgColor,
        // 编辑器配置
        numStyle: settings.chapterNumStyle,
        numMode: settings.chapterNumberingMode,
        trigger: settings.collapseTrigger,
        singleExpand: settings.singleExpand,
        mobileSmartTooltip: settings.mobileSmartTooltip,
        mapWheel: settings.mindMapWheelBehavior,
        zenAuto: settings.zenAutoPopup,
        zenStyle: settings.zenCardStyle,
        // 颜色配置
        defCharColor: settings.defaultCharColor,
        defSceneColor: settings.defaultSceneColor,
        defSetColor: settings.defaultSettingColor,
        // 关系图设置
        graphSpeed: settings.graphRotationSpeed,
        graphRotation: settings.isGraphRotationEnabled,
        graphEnabled: settings.isGraphEnabled,
        graphShowInZen: settings.isGraphShowInZen,
        // AI 配置
        aiConfig: settings.aiConfig,
        aiOutline: settings.outlineAiConfig,
        aiChapter: settings.chapterAiConfig,
        aiToxic: settings.toxicAiConfig,
        aiStyles: settings.aiStyles,
        // WebDAV
        webdavConfig: settings.webdavConfig,
        // 关系类型
        relationTypes: options.relationTypes || [],
    };

    // 模板和字段（可选）
    if (options.chapterTemplates?.length > 0) {
        payload.chapterTemplates = options.chapterTemplates;
    }
    if (options.charFields?.length > 0) {
        payload.charFields = options.charFields;
    }

    return payload;
}

/**
 * 上传待同步的设置（用于断网恢复等场景）
 * @param {Function} getStorageKey - 获取存储 key 的函数
 * @returns {Promise<boolean>} 是否上传成功
 */
export async function uploadPendingSettings(getStorageKey) {
    if (!isSettingsDirty()) {
        return false;
    }

    console.log('[ConfigUtils] 检测到未上传的设置修改，开始上传');

    try {
        const settings = useSettingsStore.getState();
        const baseVersion = parseInt(localStorage.getItem(getStorageKey('config_version')) || '0');
        const payload = buildConfigPayloadFromStore(settings);

        const res = await fetchAPI('/api/users/me', 'PATCH', {
            config: payload,
            base_version: baseVersion
        });

        if (res?.config_version) {
            localStorage.setItem(getStorageKey('config_version'), res.config_version.toString());
            clearSettingsDirty();
            console.log('[ConfigUtils] 设置上传成功');
            return true;
        }
        return false;
    } catch (e) {
        console.warn('[ConfigUtils] 设置上传失败:', e);
        return false;
    }
}
