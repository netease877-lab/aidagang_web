/**
 * backupUtils.js
 * 共用的备份和恢复工具函数
 * 本地备份、WebDAV 备份都共用这些函数
 */
import { DATA_VERSION } from '../constants';
import { apiClient } from '../services/api';

/**
 * 构建备份数据的 JSON 格式
 * @param {Object} novelData - 小说数据对象
 * @returns {Object} 符合 WebDAV 恢复格式的 JSON 对象
 */
export const buildBackupJSON = ({
    novelId,
    title,
    data = [],
    chapterTemplates = [],
    charFields = [],
    charCats = [],
    characters = [],
    sceneCats = [],
    scenes = [],
    settingCats = [],
    worldSettings = [],
    relations = []
}) => {
    // [规范化] 前端 CamelCase -> 后端 SnakeCase
    const toBackendStyle = (item) => ({
        ...item,
        category_id: item.categoryId,
        sort_order: item.sortOrder,
        extra_fields: item.extra_fields || {},
        // 删除前端风格的字段，避免混淆
        categoryId: undefined,
        sortOrder: undefined
    });

    return {
        version: '2.0',
        meta: {
            id: novelId,
            title: title,
            lastModified: new Date().toISOString(),
            appVersion: DATA_VERSION
        },
        content: {
            data,
            chapterTemplates,
            charFields,
            charCats: charCats.map(toBackendStyle),
            characters: characters.map(toBackendStyle),
            sceneCats: sceneCats.map(toBackendStyle),
            scenes: scenes.map(toBackendStyle),
            settingCats: settingCats.map(toBackendStyle),
            worldSettings: worldSettings.map(toBackendStyle),
            relations
            // 注意：relations 已经在前端组件中使用了下划线风格(source_id)，或者需要检查
        }
    };
};

/**
 * 调用后端恢复 API
 * @param {Object} json - 备份 JSON 数据
 * @param {Function} getStorageKey - 获取存储 key 的函数
 * @param {Object} toast - Toast 实例
 * @returns {Promise<{success: boolean, newId?: string, newTitle?: string, error?: string}>}
 */
export const restoreFromBackup = async (json, getStorageKey, toast) => {
    try {
        const token = localStorage.getItem('novel_token');
        if (!token) {
            toast?.showToast?.('请先登录', 'error');
            return { success: false, error: '请先登录' };
        }

        const result = await apiClient.post('/api/novel/restore', json);

        if (result?.error) {
            const errMsg = result.error || result.msg || '恢复失败';
            throw new Error(errMsg);
        }

        const newId = result.data?.id;
        const newTitle = result.data?.title || json.meta?.title || '已恢复书籍';

        return { success: true, newId, newTitle };

    } catch (err) {
        console.error('[Restore] Failed:', err);
        return { success: false, error: err.message };
    }
};

/**
 * 恢复成功后的跳转处理
 * @param {string} newId - 新书籍 ID
 * @param {string} newTitle - 新书籍标题
 * @param {Function} getStorageKey - 获取存储 key 的函数
 * @param {Object} toast - Toast 实例
 */
export const handleRestoreSuccess = (newId, newTitle, getStorageKey, toast) => {
    toast?.showToast?.(`《${newTitle}》已导入成功，正在跳转...`, 'success');

    if (newId && getStorageKey) {
        localStorage.setItem(getStorageKey('last_active'), newId);
    }
    setTimeout(() => window.location.reload(), 500);
};
