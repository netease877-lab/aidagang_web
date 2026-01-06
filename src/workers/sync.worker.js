// ==================================================
// sync.worker.js - Web Worker 处理 CPU 密集型同步任务
// 解决主线程阻塞问题，将深拷贝和 Diff 计算移至后台线程
// ==================================================

/**
 * 深拷贝函数（使用 structuredClone 更高效）
 */
function deepClone(obj) {
    // 优先使用原生 structuredClone（比 JSON.parse/stringify 快）
    if (typeof structuredClone === 'function') {
        return structuredClone(obj);
    }
    // 降级方案
    return JSON.parse(JSON.stringify(obj));
}

/**
 * 扁平化节点树
 */
function flattenNodes(nodes) {
    const result = [];
    const traverse = (node) => {
        if (!node) return;
        const { children, ...rest } = node;
        // 映射字段名以匹配后端
        result.push({
            ...rest,
            summary: rest.content || '',
            content: undefined
        });
        if (children && Array.isArray(children)) {
            children.forEach(traverse);
        }
    };
    if (Array.isArray(nodes)) {
        nodes.forEach(traverse);
    }
    return result;
}

/**
 * 基于版本号的增量 Diff
 */
function diffByVersion(oldItems, newItems) {
    const oldMap = new Map(oldItems.map(item => [item.id, item]));
    const newMap = new Map(newItems.map(item => [item.id, item]));

    const changed = [];
    const deleted = [];

    // 找出变更和新增
    // [修复] 增加内容对比，检测本地修改（版本号由后端控制，前端不自增）
    for (const [id, newItem] of newMap) {
        const oldItem = oldMap.get(id);
        // 条件1：Snapshot 中不存在 → 新增的项
        // 条件2：版本号不一致 → 服务器更新的项
        // 条件3：内容不一致（序列化对比）→ 本地修改的项
        if (!oldItem ||
            oldItem.version !== newItem.version ||
            JSON.stringify(oldItem) !== JSON.stringify(newItem)) {
            changed.push(newItem);
        }
    }

    // 找出删除
    for (const [id] of oldMap) {
        if (!newMap.has(id)) {
            deleted.push(id);
        }
    }

    return { changed, deleted };
}

/**
 * 创建快照（深拷贝所有状态）
 */
function createSnapshot(state) {
    return {
        data: deepClone(state.data || []),
        characters: deepClone(state.characters || []),
        scenes: deepClone(state.scenes || []),
        worldSettings: deepClone(state.worldSettings || []),
        charCats: deepClone(state.charCats || []),
        sceneCats: deepClone(state.sceneCats || []),
        settingCats: deepClone(state.settingCats || []),
        relations: deepClone(state.relations || [])
    };
}

/**
 * 计算同步 Payload
 */
function computeSyncPayload(oldSnapshot, newSnapshot, baseVersion, chapters = []) {
    // 扁平化节点
    const oldNodes = flattenNodes(oldSnapshot.data);
    const newNodes = flattenNodes(newSnapshot.data);

    // 计算各类数据的 Diff
    const nodeDiff = diffByVersion(oldNodes, newNodes);
    const charDiff = diffByVersion(oldSnapshot.characters, newSnapshot.characters);
    const sceneDiff = diffByVersion(oldSnapshot.scenes, newSnapshot.scenes);
    const settingDiff = diffByVersion(oldSnapshot.worldSettings, newSnapshot.worldSettings);
    const charCatDiff = diffByVersion(oldSnapshot.charCats, newSnapshot.charCats);
    const sceneCatDiff = diffByVersion(oldSnapshot.sceneCats, newSnapshot.sceneCats);
    const settingCatDiff = diffByVersion(oldSnapshot.settingCats, newSnapshot.settingCats);
    const relationDiff = diffByVersion(oldSnapshot.relations || [], newSnapshot.relations || []);

    // 构建 Payload
    return {
        base_version: baseVersion,
        nodes: nodeDiff.changed,
        deleted_nodes: nodeDiff.deleted,
        chapters: chapters,
        characters: charDiff.changed,
        deleted_characters: charDiff.deleted,
        scenes: sceneDiff.changed,
        deleted_scenes: sceneDiff.deleted,
        world_settings: settingDiff.changed,
        deleted_settings: settingDiff.deleted,
        char_categories: charCatDiff.changed,
        deleted_char_categories: charCatDiff.deleted,
        scene_categories: sceneCatDiff.changed,
        deleted_scene_categories: sceneCatDiff.deleted,
        setting_categories: settingCatDiff.changed,
        deleted_setting_categories: settingCatDiff.deleted,
        relations: relationDiff.changed,
        deleted_relations: relationDiff.deleted
    };
}

/**
 * 检查 Payload 是否为空
 */
function isEmptyPayload(payload) {
    return (
        (!payload.nodes || payload.nodes.length === 0) &&
        (!payload.deleted_nodes || payload.deleted_nodes.length === 0) &&
        (!payload.chapters || payload.chapters.length === 0) &&
        (!payload.characters || payload.characters.length === 0) &&
        (!payload.deleted_characters || payload.deleted_characters.length === 0) &&
        (!payload.scenes || payload.scenes.length === 0) &&
        (!payload.deleted_scenes || payload.deleted_scenes.length === 0) &&
        (!payload.world_settings || payload.world_settings.length === 0) &&
        (!payload.deleted_settings || payload.deleted_settings.length === 0) &&
        (!payload.char_categories || payload.char_categories.length === 0) &&
        (!payload.deleted_char_categories || payload.deleted_char_categories.length === 0) &&
        (!payload.scene_categories || payload.scene_categories.length === 0) &&
        (!payload.deleted_scene_categories || payload.deleted_scene_categories.length === 0) &&
        (!payload.setting_categories || payload.setting_categories.length === 0) &&
        (!payload.deleted_setting_categories || payload.deleted_setting_categories.length === 0) &&
        (!payload.relations || payload.relations.length === 0) &&
        (!payload.deleted_relations || payload.deleted_relations.length === 0)
    );
}

// Worker 消息处理
self.onmessage = function (e) {
    const { type, payload, id } = e.data;

    try {
        switch (type) {
            case 'CREATE_SNAPSHOT': {
                const snapshot = createSnapshot(payload.state);
                self.postMessage({ type: 'SNAPSHOT_CREATED', id, result: snapshot });
                break;
            }

            case 'COMPUTE_SYNC_PAYLOAD': {
                const { oldSnapshot, newSnapshot, baseVersion, chapters } = payload;
                const syncPayload = computeSyncPayload(oldSnapshot, newSnapshot, baseVersion, chapters);
                const isEmpty = isEmptyPayload(syncPayload);
                self.postMessage({
                    type: 'SYNC_PAYLOAD_COMPUTED',
                    id,
                    result: { payload: syncPayload, isEmpty }
                });
                break;
            }

            case 'DEEP_CLONE': {
                const cloned = deepClone(payload.data);
                self.postMessage({ type: 'CLONE_COMPLETED', id, result: cloned });
                break;
            }

            default:
                self.postMessage({ type: 'ERROR', id, error: `Unknown message type: ${type}` });
        }
    } catch (error) {
        self.postMessage({ type: 'ERROR', id, error: error.message });
    }
};
