// ==================================================
// File: frontend/src/utils/syncUtils.js
// 增量同步工具函数 - 基于版本号的扁平化增量同步
// [重构] 使用版本号比较而非 JSON.stringify
// ==================================================

import { flattenNodes, diffByVersion } from './novelUtils';
import { INITIAL_CHAR_CATS, INITIAL_SCENE_CATS, INITIAL_SETTING_CATS } from '../constants';
import { dbService } from '../services/db'; // [重构] 引入 DB 服务
import { useEntityStore } from '../stores/entityStore'; // [修复] 引入 Store 以更新 UI

/**
 * [重构] 计算需要同步的变化数据
 * 使用版本号比较，只返回有变化的扁平化节点
 * @param {Object} snapshot - 上次快照
 * @param {Object} current - 当前状态
 * @returns {Object} { nodes, characters, scenes, settings, chapters, categories, deletedIds }
 */
export const computeSyncPayload = (snapshot, current) => {
    // 扁平化当前大纲节点
    const currentNodes = flattenNodes(current.data || []);
    const snapshotNodes = flattenNodes(snapshot?.data || []);

    // 基于版本号找出变化
    const nodeDiff = diffByVersion(snapshotNodes, currentNodes);
    const charDiff = diffByVersion(snapshot?.characters || [], current.characters || []);
    const sceneDiff = diffByVersion(snapshot?.scenes || [], current.scenes || []);
    const settingDiff = diffByVersion(snapshot?.worldSettings || [], current.worldSettings || []);

    // [新增] 关系变化
    const relationDiff = diffByVersion(snapshot?.relations || [], current.relations || []);

    // 分类变化
    const charCatDiff = diffByVersion(snapshot?.charCats || [], current.charCats || []);
    const sceneCatDiff = diffByVersion(snapshot?.sceneCats || [], current.sceneCats || []);
    const settingCatDiff = diffByVersion(snapshot?.settingCats || [], current.settingCats || []);

    // [优化] 角色转换：包含 avatar 和 extra_fields
    const transformCharacter = (item) => ({
        id: item.id,
        name: item.name || '',
        desc: item.desc || '',
        color: item.color || null,
        avatar: item.avatar || null,
        category_id: item.categoryId || null,
        sort_order: item.sortOrder || 0,
        extra_fields: item.extra_fields || {},
        version: item.version || 1
    });

    // [优化] 场景转换：包含 image
    const transformScene = (item) => ({
        id: item.id,
        name: item.name || '',
        desc: item.desc || '',
        color: item.color || null,
        image: item.image || null,
        category_id: item.categoryId || null,
        sort_order: item.sortOrder || 0,
        version: item.version || 1
    });

    // [优化] 设定转换：无 avatar/image/extra_fields
    const transformSetting = (item) => ({
        id: item.id,
        name: item.name || '',
        desc: item.desc || '',
        color: item.color || null,
        category_id: item.categoryId || null,
        sort_order: item.sortOrder || 0,
        version: item.version || 1
    });

    // [新增] 转换分类：清理 UI 状态字段，转换字段名
    const transformCategory = (cat, categoryType) => {
        const { isNew, isExpanded, sortOrder, ...rest } = cat;
        return {
            id: cat.id,
            name: cat.name || '',
            color: cat.color || null,
            category_type: categoryType,
            sort_order: sortOrder ?? cat.sort_order ?? 0,
            version: cat.version || 1
        };
    };

    // [新增] 转换关系：前端字段名 → 后端字段名
    const transformRelation = (rel) => ({
        id: rel.id,
        source_id: rel.source_id || rel.sourceId,
        target_id: rel.target_id || rel.targetId,
        relation_type: rel.relation_type || rel.relationType || 'custom',
        relation_label: rel.relation_label || rel.relationLabel || '',
        distance: rel.distance || 1,
        version: rel.version || 1
    });

    return {
        nodes: nodeDiff.changed,
        characters: charDiff.changed.map(transformCharacter),
        scenes: sceneDiff.changed.map(transformScene),
        settings: settingDiff.changed.map(transformSetting),
        relations: relationDiff.changed.map(transformRelation),
        categories: [
            ...charCatDiff.changed.map(c => transformCategory(c, 'character')),
            ...sceneCatDiff.changed.map(c => transformCategory(c, 'scene')),
            ...settingCatDiff.changed.map(c => transformCategory(c, 'setting'))
        ],
        deleted_ids: [
            ...nodeDiff.deleted,
            ...charDiff.deleted,
            ...sceneDiff.deleted,
            ...settingDiff.deleted,
            ...relationDiff.deleted,
            ...charCatDiff.deleted,
            ...sceneCatDiff.deleted,
            ...settingCatDiff.deleted
        ]
    };
};

/**
 * [重构] 检查是否有实质性变化
 */
export const hasChanges = (payload) => {
    return (
        (payload.nodes && payload.nodes.length > 0) ||
        (payload.characters && payload.characters.length > 0) ||
        (payload.scenes && payload.scenes.length > 0) ||
        (payload.settings && payload.settings.length > 0) ||
        (payload.relations && payload.relations.length > 0) ||  // [新增]
        (payload.categories && payload.categories.length > 0) ||
        (payload.deleted_ids && payload.deleted_ids.length > 0)
    );
};

/**
 * [保留] 计算章节内容变化（章节内容单独处理）
 */
export const computeChapterChanges = (oldChapters, newChapters) => {
    const oldMap = new Map((oldChapters || []).map(c => [c.id, c.content]));
    const changes = [];

    for (const chapter of newChapters || []) {
        const oldContent = oldMap.get(chapter.id);
        if (oldContent !== chapter.content) {
            changes.push({ id: chapter.id, content: chapter.content });
        }
    }

    return changes;
};

/**
 * 创建数据快照用于比较
 * @param {Object} state - 当前状态
 * @returns {Object} 快照对象
 */
export const createSnapshot = (state) => {
    return {
        data: JSON.parse(JSON.stringify(state.data || [])),
        characters: JSON.parse(JSON.stringify(state.characters || [])),
        charCats: JSON.parse(JSON.stringify(state.charCats || [])),
        scenes: JSON.parse(JSON.stringify(state.scenes || [])),
        sceneCats: JSON.parse(JSON.stringify(state.sceneCats || [])),
        worldSettings: JSON.parse(JSON.stringify(state.worldSettings || [])),
        settingCats: JSON.parse(JSON.stringify(state.settingCats || [])),
        chapterTemplates: JSON.parse(JSON.stringify(state.chapterTemplates || [])),
        charFields: JSON.parse(JSON.stringify(state.charFields || [])),
        relations: JSON.parse(JSON.stringify(state.relations || []))  // [新增]
    };
};


// [End of sync logic]

// ===========================
// 冲突检测辅助函数
// ===========================

/**
 * 统一处理空值，避免 undefined/null 导致的假冲突
 */
const normalize = (v) => String(v ?? '').trim();

/**
 * 递归对比大纲节点，收集差异
 * @param {Array} localNodes - 本地节点
 * @param {Array} serverNodes - 服务器节点
 * @param {string} novelTitle - 小说标题（用于显示）
 * @param {string} path - 当前路径
 * @returns {Array} 冲突列表
 */
export const compareOutlineNodes = (localNodes, serverNodes, novelTitle, path = '') => {
    const conflicts = [];
    const safeLocal = Array.isArray(localNodes) ? localNodes : [];
    const safeServer = Array.isArray(serverNodes) ? serverNodes : [];
    const serverMap = new Map(safeServer.map(n => [n.id, n]));

    safeLocal.forEach((local, index) => {
        const server = serverMap.get(local.id);

        // [优化] 根据节点类型和索引生成更友好的标题
        let displayTitle = local.title || '未命名';
        if (local.type === 'volume') {
            displayTitle = `第${index + 1}卷 ${displayTitle}`;
        } else if (local.type === 'chapter') {
            displayTitle = `第${index + 1}章 ${displayTitle}`;
        }

        const nodePath = path ? `${path} > ${displayTitle}` : displayTitle;

        if (!server) {
            // [新增] 本地新增的节点，不算冲突（直接上传）
            // 只有当本地版本号 < 服务器版本号 才是真正冲突
            // 新增节点没有服务器版本，不冲突
        } else if (
            (local.version || 0) < (server.version || 0) &&  // [关键] 只有本地版本 < 服务器版本才冲突
            (normalize(local.title) !== normalize(server.title) ||
                normalize(local.content) !== normalize(server.content))
        ) {
            // [重构] 真正的冲突：本地版本落后于服务器，且内容不同
            conflicts.push({
                id: local.id, type: 'outline_node', nodeType: local.type,
                path: `[${novelTitle}] ${nodePath}`,
                local: { title: local.title, content: local.content, summary: local.summary, version: local.version },
                server: { title: server.title, content: server.content, summary: server.summary, version: server.version }
            });
        }

        if (local.children?.length > 0) {
            conflicts.push(...compareOutlineNodes(local.children, server?.children || [], novelTitle, nodePath));
        }
    });
    return conflicts;
};

/**
 * 对比通用列表数据（角色/场景/设定）
 */
export const compareListItems = (localItems, serverItems, novelTitle, type, nameKey = 'name') => {
    const conflicts = [];
    const safeLocal = Array.isArray(localItems) ? localItems : [];
    const safeServer = Array.isArray(serverItems) ? serverItems : [];

    for (const local of safeLocal) {
        const server = safeServer.find(s => s.id === local.id);
        const typeLabel = type === 'character' ? '角色' : type === 'scene' ? '场景' : '设定';

        if (!server) {
            // [新增] 本地新增的项目，不算冲突（直接上传）
        } else if (
            (local.version || 0) < (server.version || 0) &&  // [关键] 只有本地版本 < 服务器版本才冲突
            (normalize(local[nameKey]) !== normalize(server[nameKey]) ||
                normalize(local.desc) !== normalize(server.desc))
        ) {
            // [重构] 真正的冲突：本地版本落后于服务器，且内容不同
            conflicts.push({
                id: local.id, type,
                path: `[${novelTitle}] ${typeLabel}: ${local[nameKey] || '未命名'}`,
                local: { name: local[nameKey], desc: local.desc, version: local.version },
                server: { name: server[nameKey], desc: server.desc, version: server.version }
            });
        }
    }
    return conflicts;
};

/**
 * 解析服务器返回的小说内容
 */
// [修复] 引入常量以确保默认值正确
// [修复] 引入常量已移至顶部

export const parseNovelContent = (content) => {
    const ensureCats = (cats, defaultFn) => (cats && cats.length > 0) ? cats : defaultFn();

    // [修复] 按 name 去重分类，保留第一个（防止重复分类）
    const deduplicateCats = (cats) => {
        const seen = new Set();
        return cats.filter(cat => {
            const key = cat.name;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    };

    // [重构] 接收数据转换：后端下划线 -> 前端驼峰
    const transformToFrontend = (item) => ({
        ...item,
        categoryId: item.category_id ?? item.categoryId,
        sortOrder: item.sort_order ?? item.sortOrder ?? 0,
        extra_fields: item.extra_fields ?? {},
        // 统一使用 name/desc
        name: item.name,
        desc: item.desc,
        id: item.id,
        // Category 特有
        categoryType: item.category_type ?? item.categoryType
    });

    const normalizeList = (list) => {
        const arr = Array.isArray(list) ? list : (list?.items || []);
        return arr.map(transformToFrontend);
    };


    const categories = content.categories || [];
    const charCatsFromUnified = categories.filter(c => c.category_type === 'character');
    const sceneCatsFromUnified = categories.filter(c => c.category_type === 'scene');
    const setCatsFromUnified = categories.filter(c => c.category_type === 'setting');

    // 确保分类也经过转换
    const safeCharCats = normalizeList(content.char_cats || charCatsFromUnified);

    const safeSceneCats = normalizeList(content.scene_cats || sceneCatsFromUnified);
    const safeSetCats = normalizeList(content.set_cats || setCatsFromUnified);

    return {
        data: content.data || [],
        chars: normalizeList(content.characters),
        // [修复] 对分类应用去重
        charCats: deduplicateCats(ensureCats(safeCharCats, INITIAL_CHAR_CATS)),
        scenes: normalizeList(content.scenes),
        sceneCats: deduplicateCats(ensureCats(safeSceneCats, INITIAL_SCENE_CATS)),
        world: normalizeList(content.world_settings),
        setCats: deduplicateCats(ensureCats(safeSetCats, INITIAL_SETTING_CATS)),
        templates: content.chapter_templates?.items || (Array.isArray(content.chapter_templates) ? content.chapter_templates : []) || [],
        charFields: content.char_fields?.items || (Array.isArray(content.char_fields) ? content.char_fields : []) || []
    };
};

/**
 * 将小说详情保存到 IndexedDB
 * @param {string} prefix - 已废弃，保留兼容
 * @param {Object} content - 小说内容
 * @param {Object} meta - 元数据 (需包含 novel_id)
 */
export const saveNovelToStorage = async (prefix, content, meta, serverTimestampRef, versionRef) => {
    const parsed = parseNovelContent(content);

    // 使用 dbService 保存所有内容
    if (meta?.novel_id) {
        await dbService.saveNovelContent(meta.novel_id, {
            data: parsed.data,
            characters: parsed.chars,
            charCats: parsed.charCats,
            scenes: parsed.scenes,
            sceneCats: parsed.sceneCats,
            worldSettings: parsed.world,
            settingCats: parsed.setCats,
            chapterTemplates: parsed.templates,
            charFields: parsed.charFields,
            version: meta.version || 0  // [关键修复] 保存版本号到 IndexedDB
        });
    } else {
        console.error('[Sync] saveNovelToStorage called without novel_id!', meta);
    }

    // 元数据仍存 LocalStorage (时间戳/版本号) 作为轻量级索引
    if (meta?.novel_id) {
        if (meta.updated_at) {
            serverTimestampRef.current[meta.novel_id] = meta.updated_at;
            localStorage.setItem('novel_server_timestamps', JSON.stringify(serverTimestampRef.current));
        }
        if (meta.version) {
            versionRef.current[meta.novel_id] = meta.version;
            localStorage.setItem('novel_versions', JSON.stringify(versionRef.current));
        }
    }
};

/**
 * 从 IndexedDB 读取本地小说数据
 * @param {string} novelId - 小说 ID
 */
export const loadLocalNovelData = async (novelId) => {
    const content = await dbService.getNovelContent(novelId);
    if (!content) return null;

    return {
        data: content.data || [],
        chars: content.characters || [],
        charCats: content.charCats || [],
        scenes: content.scenes || [],
        sceneCats: content.sceneCats || [],
        world: content.worldSettings || [],
        setCats: content.settingCats || [],
        templates: content.chapterTemplates || [],
        charFields: content.charFields || [],
        version: content.version // [修复] 返回本地存储的版本号
    };
};

// ===========================
// 增量同步合并函数 (Delta Sync)
// ===========================

/**
 * 应用增量同步数据
 * @param {string} novelId
 * @param {Object} delta - { latest_version, is_snapshot, updated, deleted }
 * @param {Object} localContent - 本地现有数据
 * @param {Object} dirtyMap - { entityId: true } 标记哪些实体有未保存修改
 * @returns {Object} { success: boolean, conflicts: Array, merged: Object }
 */
// [新增] 解析增量接口的快照响应 (标准化字段)
export function parseSnapshotResponse(delta) {

    const normalize = (list) => (list || []).map(item => ({
        ...item,
        categoryId: item.category_id ?? item.categoryId,
        sortOrder: item.sort_order ?? item.sortOrder ?? 0,
        categoryType: item.category_type ?? item.categoryType,
        extra_fields: item.extra_fields ?? {},
    }));

    const flatNodes = (delta.updated?.nodes || []).map(n => {
        // [修复] 过滤 UI 状态，只取业务数据
        const { isExpanded, isContentExpanded, is_expanded, is_content_expanded, ...rest } = n;
        return {
            ...rest,
            parentId: n.parent_id ?? n.parentId,
            sortOrder: n.sort_order ?? n.sortOrder ?? 0
        };
    });
    const treeData = rebuildTreeFromFlat(flatNodes);

    return {
        data: treeData,
        characters: normalize(delta.updated.characters),
        scenes: normalize(delta.updated.scenes),
        worldSettings: normalize(delta.updated.settings),
        relations: normalize(delta.updated.relations),
        charCats: normalize((delta.updated.categories || []).filter(c => c.category_type === 'character')),
        sceneCats: normalize((delta.updated.categories || []).filter(c => c.category_type === 'scene')),
        settingCats: normalize((delta.updated.categories || []).filter(c => c.category_type === 'setting')),
        chapterTemplates: delta.chapter_templates || [],
        charFields: delta.char_fields || [],
        version: delta.latest_version
    };
}

// [修复] 添加 updateUI 参数，允许后台静默同步
export async function applyDeltaSync(novelId, delta, localContent, dirtyMap = {}, updateUI = true) {
    const { dbService } = await import('../services/db.js');
    const { useEntityStore } = await import('../stores/entityStore.js');
    const conflicts = [];





    // 如果是全量快照，直接使用服务器数据
    if (delta.is_snapshot) {
        const merged = parseSnapshotResponse(delta);

        // 保存到 IndexedDB
        await dbService.saveNovelContent(novelId, {
            ...merged,
            updated_at: Date.now()
        });

        // 更新 UI Store
        if (updateUI) {
            useEntityStore.getState().syncFromNovel(merged);
        }
        return { success: true, conflicts: [], merged };
    }

    // 增量合并
    const merged = {
        // 大纲节点需要特殊的树形合并
        data: mergeNodeTree(localContent?.data || [], delta.updated.nodes || [], dirtyMap, conflicts),
        // 其他实体使用带冲突检测的合并
        characters: mergeWithConflictCheck(localContent?.characters || [], delta.updated.characters || [], dirtyMap, conflicts, 'character'),
        scenes: mergeWithConflictCheck(localContent?.scenes || [], delta.updated.scenes || [], dirtyMap, conflicts, 'scene'),
        worldSettings: mergeWithConflictCheck(localContent?.worldSettings || [], delta.updated.settings || [], dirtyMap, conflicts, 'setting'),
        relations: mergeWithConflictCheck(localContent?.relations || [], delta.updated.relations || [], dirtyMap, conflicts, 'relation'),
        // 分类处理
        charCats: mergeWithConflictCheck(
            localContent?.charCats || [],
            (delta.updated.categories || []).filter(c => c.category_type === 'character'),
            dirtyMap, conflicts, 'charCat'
        ),
        sceneCats: mergeWithConflictCheck(
            localContent?.sceneCats || [],
            (delta.updated.categories || []).filter(c => c.category_type === 'scene'),
            dirtyMap, conflicts, 'sceneCat'
        ),
        settingCats: mergeWithConflictCheck(
            localContent?.settingCats || [],
            (delta.updated.categories || []).filter(c => c.category_type === 'setting'),
            dirtyMap, conflicts, 'settingCat'
        ),
    };

    // 如果有冲突，返回冲突列表供 UI 处理
    if (conflicts.length > 0) {
        return { success: false, conflicts, merged: null };
    }

    // 移除 deleted 数据
    merged.data = removeDeletedFromTree(merged.data, delta.deleted?.nodes || []);
    merged.characters = merged.characters.filter(c => !(delta.deleted?.characters || []).includes(c.id));
    merged.scenes = merged.scenes.filter(s => !(delta.deleted?.scenes || []).includes(s.id));
    merged.worldSettings = merged.worldSettings.filter(w => !(delta.deleted?.settings || []).includes(w.id));
    merged.relations = merged.relations.filter(r => !(delta.deleted?.relations || []).includes(r.id));
    merged.charCats = merged.charCats.filter(c => !(delta.deleted?.categories || []).includes(c.id));
    merged.sceneCats = merged.sceneCats.filter(c => !(delta.deleted?.categories || []).includes(c.id));
    merged.settingCats = merged.settingCats.filter(c => !(delta.deleted?.categories || []).includes(c.id));

    // 保存到 IndexedDB
    await dbService.saveNovelContent(novelId, {
        ...merged,
        version: delta.latest_version,
        updated_at: Date.now()
    });

    // 更新 UI Store
    if (updateUI) {
        useEntityStore.getState().syncFromNovel(merged);
    }
    return { success: true, conflicts: [], merged };
}

/**
 * 树形节点合并：处理节点移动、层级变化
 * 策略：将更新的节点扁平化合并后重建树
 */
function mergeNodeTree(localTree, updatedNodes, dirtyMap, conflicts) {
    if (!updatedNodes || updatedNodes.length === 0) {
        return localTree;
    }

    // 1. 将本地树扁平化
    const flatLocal = flattenTreeForMerge(localTree);
    const localMap = new Map(flatLocal.map(n => [n.id, n]));

    // 2. 合并更新（带冲突检测）
    for (const updatedNode of updatedNodes) {
        const localNode = localMap.get(updatedNode.id);
        if (localNode && dirtyMap[updatedNode.id]) {
            // 冲突：本地有未保存修改
            conflicts.push({
                type: 'node',
                id: updatedNode.id,
                local: localNode,
                server: updatedNode
            });
        } else {
            // 无冲突，合并（服务器数据优先，但保留本地 children 引用以便重建）
            // [修复] 过滤 UI 状态字段，防止服务器覆盖本地 UI (Task 2.11)
            // 即便服务器发送了这些状态，本地也忽略，坚持使用 localNode 的状态
            const { isExpanded, isContentExpanded, is_expanded, is_content_expanded, ...cleanUpdate } = updatedNode;

            localMap.set(updatedNode.id, {
                ...localNode,
                ...cleanUpdate,
                // 转换后端字段名到前端
                parentId: updatedNode.parent_id ?? updatedNode.parentId,
                sortOrder: updatedNode.sort_order ?? updatedNode.sortOrder ?? 0
            });
        }
    }

    // 3. 重建树结构（基于 parentId）
    return rebuildTreeFromFlat(Array.from(localMap.values()));
}

/**
 * 带冲突检测的列表合并
 */
function mergeWithConflictCheck(local, updates, dirtyMap, conflicts, type) {
    if (!updates || updates.length === 0) {
        return local;
    }

    const map = new Map(local.map(item => [item.id, item]));
    for (const item of updates) {
        const localItem = map.get(item.id);
        if (localItem && dirtyMap[item.id]) {
            conflicts.push({ type, id: item.id, local: localItem, server: item });
        } else {
            // 转换后端字段名到前端
            map.set(item.id, {
                ...item,
                categoryId: item.category_id ?? item.categoryId,
                sortOrder: item.sort_order ?? item.sortOrder ?? 0,
                categoryType: item.category_type ?? item.categoryType
            });
        }
    }
    return Array.from(map.values());
}

/**
 * 从树中递归移除已删除节点
 */
function removeDeletedFromTree(tree, deletedIds) {
    if (!deletedIds || deletedIds.length === 0) {
        return tree;
    }
    const deletedSet = new Set(deletedIds);
    function recurse(nodes) {
        return (nodes || [])
            .filter(n => !deletedSet.has(n.id))
            .map(n => ({ ...n, children: n.children ? recurse(n.children) : [] }));
    }
    return recurse(tree);
}

/**
 * 扁平化树结构（用于增量合并）
 */
function flattenTreeForMerge(tree, parentId = null) {
    const result = [];
    for (const node of (tree || [])) {
        result.push({ ...node, parentId: parentId, _originalChildren: node.children });
        if (node.children?.length) {
            result.push(...flattenTreeForMerge(node.children, node.id));
        }
    }
    return result;
}

/**
 * 根据 parentId 重建树
 */
function rebuildTreeFromFlat(flatNodes) {
    const map = new Map();
    // 1. 预处理：去重与初始化
    flatNodes.forEach(n => {
        // 过滤无效 ID
        if (n.id === undefined || n.id === null) return;

        // 使用字符串 Key 确保唯一性 (解决 1 vs '1' 重复问题)
        const key = String(n.id);

        // 保留最后出现的节点数据，初始化 children
        map.set(key, { ...n, children: [] });
    });

    const roots = [];

    // 2. 构建树结构
    for (const node of map.values()) {
        const rawPid = node.parentId ?? node.parent_id ?? node.ParentId;
        // 任何非真值或 '0' 视为根节点
        const parentId = (rawPid && rawPid !== 0 && rawPid !== '0') ? String(rawPid) : null;

        if (!parentId) {
            roots.push(node);
        } else {
            const parent = map.get(parentId);
            if (parent) {
                parent.children.push(node);
            } else {
                // 如果父节点不存在（孤儿），提升为根节点
                roots.push(node);
            }
        }
    }

    // 3. 排序
    const sortChildren = (nodes) => {
        nodes.sort((a, b) => (a.sortOrder || a.sort_order || 0) - (b.sortOrder || b.sort_order || 0));
        nodes.forEach(n => n.children && sortChildren(n.children));
    };
    sortChildren(roots);

    // 4. 清理内部字段
    const cleanNode = (n) => {
        delete n.parentId;
        delete n.parent_id;
        delete n.ParentId;
        delete n._originalChildren;
        if (n.children) n.children.forEach(cleanNode);
        return n;
    };

    return roots.map(cleanNode);
}
