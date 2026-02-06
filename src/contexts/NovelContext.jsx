// ==================================================
// File: frontend/src/contexts/NovelContext.jsx
// 小说数据状态管理 (包含数据操作、同步、冲突处理)
// ==================================================
import React, { createContext, useContext, useState, useCallback, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { fetchAPI } from '../services/api';
import {
    CLEAN_DATA_TEMPLATE, DEFAULT_CHAPTER_TEMPLATES, DEFAULT_CHAR_FIELDS,
    INITIAL_CHAR_CATS, INITIAL_SCENE_CATS, INITIAL_SETTING_CATS, generateId,
    toChineseNum // [新增]
} from '../constants';
import { useUser } from './UserContext';
import { useToast } from './ToastContext';
import {
    updateNode, deleteNode, addSibling, addChild,
    toggleAccordion, collapseAllNodes,
    mergeList, getNodeInfo
} from '../utils/novelUtils';
import { createSnapshot } from '../utils/syncUtils';
import { useOperationLog } from '../hooks/useOperationLog';
import { dbService } from '../services/db'; // [重构] 导入拆分后的 utils (包含恢复功能)
import { exportNovelText, exportNovelMindmap } from '../utils/ioUtils'; // [修复] 导入导出函数
import { buildBackupJSON, restoreFromBackup, handleRestoreSuccess } from '../utils/backupUtils'; // [新增] 导出备份功能
import { useEntityStore } from '../stores/entityStore'; // [修复] 导入 entityStore 用于同步
import { useUIStore } from '../stores/uiStore'; // [新增] 导入 uiStore 用于插入模式管理
import { useSettingsStore } from '../stores/settingsStore'; // [修复] 导入 settingsStore 获取全局模版

const NovelContext = createContext(null);

export function NovelProvider({ children }) {
    const { isAuthenticated, getStorageKey } = useUser();
    const { showToast } = useToast();

    // --- State ---
    const [novels, setNovels] = useState([]);
    const novelsRef = useRef(novels);
    useEffect(() => { novelsRef.current = novels; }, [novels]);

    const [currentNovelId, setCurrentNovelId] = useState(null);
    const currentNovelIdRef = useRef(currentNovelId);
    useEffect(() => { currentNovelIdRef.current = currentNovelId; }, [currentNovelId]);

    // [修复] Loading 状态：初始为 true，确保数据加载完成前不触发 AutoSave
    const [isLoading, setIsLoading] = useState(true);
    // [关键修复] 同步的 ref 标记，React 状态更新是异步的，ref 是同步的
    // 这样 useAutoSave 可以立即检测到正在加载，不会在数据更新前保存
    const isLoadingRef = useRef(true);

    // [同步] 将 loading 状态同步到 EntityStore 供 RightPanel 等组件使用
    useEffect(() => {
        isLoadingRef.current = isLoading; // [Fix] 同步 Ref
        useEntityStore.getState().setLoading(isLoading);
    }, [isLoading]);

    // [兜底] 强制同步用户模板：确保 Store 中的模板始终与 Settings 中的一致
    const userSettingsTemplates = useSettingsStore(state => state.chapterTemplates);
    const storeTemplates = useEntityStore(state => state.chapterTemplates);
    useEffect(() => {
        if (isLoading) return; // 加载中不进行检查
        if (!userSettingsTemplates || userSettingsTemplates.length === 0) return; // 用户无设置则忽略

        // 对比并强制覆盖 (JSON.stringify 足够处理简单对象)
        if (JSON.stringify(userSettingsTemplates) !== JSON.stringify(storeTemplates)) {
            useEntityStore.getState().setChapterTemplates(userSettingsTemplates);
        }
    }, [userSettingsTemplates, storeTemplates, isLoading]);

    // [Refactor] Removed local state for entities. All data is now managed by entityStore.
    // template/fields state is kept for now as they are arguably configuration, but optimally should move to store too.
    // [Refactor] Removed local state for entities. All data is now managed by entityStore.
    // [Refactor] Removed redundant config state (chapterTemplates, charFields). Now in entityStore.

    // Removed: data, characters, scenes, worldSettings, cats, relations...

    const [dbSyncStatus, setDbSyncStatus] = useState('idle');

    const lastSnapshotRef = useRef(null);

    const serverTimestampRef = useRef(() => {
        try { return JSON.parse(localStorage.getItem('novel_server_timestamps') || '{}'); } catch { return {}; }
    });
    const versionRef = useRef(() => {
        try { return JSON.parse(localStorage.getItem('novel_versions') || '{}'); } catch { return {}; }
    });
    if (typeof serverTimestampRef.current === 'function') serverTimestampRef.current = serverTimestampRef.current();
    if (typeof versionRef.current === 'function') versionRef.current = versionRef.current();

    // 冲突处理状态
    const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
    const [conflictData, setConflictData] = useState({});

    // 监听 currentNovelId 变化并持久化到 localStorage
    useEffect(() => {
        if (currentNovelId) {
            localStorage.setItem(getStorageKey('last_active'), currentNovelId);
        }
    }, [currentNovelId, getStorageKey]);

    // [修复] 持久化模板/字段到 localStorage（区分用户）
    // [Refactor] Removed redundant localStorage effects. Persistence handled by DB/Store.

    // 操作日志
    const operationLog = useOperationLog(currentNovelId);

    // --- Core Methods ---

    // [重构] 异步加载本地数据 (IndexedDB优先)
    const loadLocalData = useCallback(async (novelId) => {
        if (!novelId) return;
        // [关键修复] 同步设置 ref，立即阻止 AutoSave
        isLoadingRef.current = true;
        setIsLoading(true);

        // [新增关键代码 1]: 切换瞬间，立即清空 Zustand Store，防止残影
        useEntityStore.getState().syncFromNovel({
            data: [], // [Refactor] Sync outline data
            chapterTemplates: [],
            characters: [], scenes: [], worldSettings: [],
            charCats: [], sceneCats: [], settingCats: [],
            relations: [], charFields: []
        });

        // 同时清空 Context 本地状态 (双保险)
        // 同时清空 Context 本地状态 (双保险)
        // [Refactor] Setters removed as they are no longer in scope
        // setData([]); setCharacters([]); setScenes([]); setWorldSettings([]);
        // setCharCats([]); setSceneCats([]); setSettingCats([]); setRelations([]);

        try {
            // [新增] 启动时检查临时表，恢复未完成的编辑
            const pendingEdit = await dbService.getPendingEdit(novelId);
            if (pendingEdit) {
                await dbService.saveNovelContent(novelId, pendingEdit);
                await dbService.deletePendingEdit(novelId);
            }

            // 1. 优先尝试从 IndexedDB 加载
            let content = await dbService.getNovelContent(novelId);

            // [新增] 双重验证：确保缓存 ID 与请求 ID 一致，防止新书用旧缓存
            if (content && content.novel_id !== novelId) {
                await dbService.deleteNovel(novelId);
                content = null;
            }

            // [修复] 不仅检测 content 存在，还要检测 content.data 是否有数据
            // 避免 DB 有空壳记录（data=[]）时误判为"已有本地数据"
            if (content && content.data && content.data.length > 0) {
                // [新增] 统一转换函数：确保 category_id -> categoryId
                const normalizeItem = (item) => ({
                    ...item,
                    categoryId: item.category_id ?? item.categoryId,
                    sortOrder: item.sort_order ?? item.sortOrder ?? 0,
                });
                const normalizeList = (list) => {
                    // [修复] 处理多种格式：数组、{ items: [...] }、null/undefined
                    const arr = Array.isArray(list) ? list : (list?.items || []);
                    return arr.map(normalizeItem);
                };

                // [新增关键代码 2]: DB 读取成功后，转换字段后推送到 Store
                useEntityStore.getState().syncFromNovel({
                    data: content.data || [], // [Refactor] Sync outline data
                    // [修复] 强制使用全局配置覆盖本地模版 (Task 2.7)
                    chapterTemplates: (useSettingsStore.getState().chapterTemplates?.length > 0)
                        ? useSettingsStore.getState().chapterTemplates
                        : (content.chapterTemplates || []),
                    characters: normalizeList(content.characters),
                    scenes: normalizeList(content.scenes),
                    worldSettings: normalizeList(content.worldSettings),
                    charCats: normalizeList(content.charCats),
                    sceneCats: normalizeList(content.sceneCats),
                    settingCats: normalizeList(content.settingCats),
                    relations: content.relations || [],
                    // [修复] 强制使用全局配置覆盖本地字段 (Task 2.7)
                    charFields: (useSettingsStore.getState().charFields?.length > 0)
                        ? useSettingsStore.getState().charFields
                        : (content.charFields || [])
                });

                // [修复] 初次加载后默认展开第一级节点（卷），确保用户可以看到内容
                const dataVal = content.data || [];
                const uiState = useUIStore.getState();
                if (uiState.expandedNodeIds.size === 0 && dataVal.length > 0) {
                    const volumeIds = dataVal.map(vol => vol.id);
                    uiState.setNodesExpanded(volumeIds, true);
                }

                // [修复] 从本地 DB 恢复版本号
                versionRef.current[novelId] = content.version || 1;

                // [修复] 恢复 Snapshot
                lastSnapshotRef.current = createSnapshot(content);

                // [新增] 后台版本校验：使用增量接口检查更新
                import('../services/api.js').then(({ syncPullNovel }) => {
                    const localVer = versionRef.current[novelId] || 0;
                    syncPullNovel(novelId, localVer).then(async res => {
                        if (res?.code === 200 && res.data) {
                            const { latest_version, title } = res.data;

                            // 更新书名（如果变化）
                            if (title && novelsRef.current) {
                                const currentTitle = novelsRef.current.find(n => n.id === novelId)?.title;
                                if (currentTitle !== title) {
                                    setNovels(prev => prev.map(n => n.id === novelId ? { ...n, title } : n));
                                }
                            }

                            // 检查版本更新
                            if (latest_version > localVer) {

                                const { applyDeltaSync } = await import('../utils/syncUtils.js');
                                // 获取当前 Store 数据作为基准（因刚加载完，DB 数据即为最新）
                                const { useEntityStore } = await import('../stores/entityStore.js');
                                const localContent = useEntityStore.getState().getSnapshot(); // 需确保 store 已 sync

                                const result = await applyDeltaSync(novelId, res.data, localContent);
                                if (result.success) {
                                    versionRef.current[novelId] = latest_version;
                                }
                            } else {
                            }
                        }
                    }).catch(e => console.warn('[Load] Background check failed:', e));
                });
            } else {
                // [修复] 本地无数据时从服务器拉取

                // 先清空 entityStore (已经在上面统一做过了，这里不再赘述，或者可以保留作为双重保险，但上面已经有了布局副作用)

                lastSnapshotRef.current = null;

                // 从服务器拉取数据
                try {
                    // [优化] 使用增量接口的全量模式 (统一逻辑)
                    const { syncPullNovel } = await import('../services/api.js');
                    const res = await syncPullNovel(novelId, 0);

                    if (res && res.data && res.data.is_snapshot) {
                        const { applyDeltaSync, createSnapshot } = await import('../utils/syncUtils.js');

                        // 使用 applyDeltaSync 处理全量数据
                        const result = await applyDeltaSync(novelId, res.data, null);

                        if (result.success) {
                            // 更新 Refs
                            if (res.data.latest_version) versionRef.current[novelId] = res.data.latest_version;

                            // 更新快照
                            lastSnapshotRef.current = createSnapshot(result.merged);

                            // 更新书名
                            if (res.data.title && novelsRef.current) {
                                setNovels(prev => prev.map(n => n.id === novelId ? { ...n, title: res.data.title } : n));
                            }

                            // 默认展开
                            const uiState = useUIStore.getState();
                            if (uiState.expandedNodeIds.size === 0 && result.merged.data?.length > 0) {
                                const volumeIds = result.merged.data.map(vol => vol.id);
                                uiState.setNodesExpanded(volumeIds, true);
                            }

                        }
                    }
                } catch (fetchErr) {
                    console.error('[Load] Failed to fetch from server:', fetchErr);
                }
            }
        } catch (e) {
            console.error('[Load] Error loading local data', e);
            showToast('加载失败', 'error');
        } finally {
            // [关键修复] 同步设置 ref，允许 AutoSave
            isLoadingRef.current = false;
            setIsLoading(false);
        }
    }, [getStorageKey, showToast]);

    // [重构] 监听 currentNovelId 变化并加载数据
    // 使用 useLayoutEffect 确保在浏览器绘制前执行 loadLocalData (进而清空 Store)，彻底消除残影
    useLayoutEffect(() => {
        if (currentNovelId) {
            loadLocalData(currentNovelId);
        }
    }, [currentNovelId, loadLocalData]);

    // [修复] 并发锁：防止同时多次调用（例如 StrictMode 下 useNovelSync 触发两次）
    const isCreatingNovelRef = useRef(false);

    const createEmptyNovel = useCallback(async (isReset = false, silent = false) => {
        // 并发保护
        if (isCreatingNovelRef.current) {
            return null;
        }
        isCreatingNovelRef.current = true;

        let newNovel = null;
        try {
            const res = await fetchAPI('/api/novel/create', 'POST', { title: '未命名作品' });
            if (res && res.data) {
                const { id, title, updated_at, content, version } = res.data;
                newNovel = { id, title, lastModified: updated_at };

                const nextNovels = isReset ? [newNovel] : [...novelsRef.current, newNovel];
                setNovels(nextNovels);

                // 准备初始内容
                // [修复] 优先使用后端返回的分类（ID 由后端生成），确保前后端 ID 一致
                // 只有当后端未返回分类时才使用前端 fallback
                const serverCharCats = content?.char_cats || [];
                const serverSceneCats = content?.scene_cats || [];
                const serverSettingCats = content?.set_cats || [];

                const initialContent = {
                    data: content?.data || CLEAN_DATA_TEMPLATE(id),
                    characters: content?.characters?.items || [],
                    charCats: serverCharCats.length > 0 ? serverCharCats : INITIAL_CHAR_CATS(),
                    scenes: content?.scenes?.items || [],
                    sceneCats: serverSceneCats.length > 0 ? serverSceneCats : INITIAL_SCENE_CATS(),
                    worldSettings: content?.world_settings?.items || [],
                    settingCats: serverSettingCats.length > 0 ? serverSettingCats : INITIAL_SETTING_CATS(),
                    // [修复] 优先使用全局设置的模版，解决"设置的角色模版没有同步到小说"问题
                    chapterTemplates: content?.chapter_templates || (useSettingsStore.getState().chapterTemplates?.length > 0 ? useSettingsStore.getState().chapterTemplates : DEFAULT_CHAPTER_TEMPLATES),
                    charFields: content?.char_fields || (useSettingsStore.getState().charFields?.length > 0 ? useSettingsStore.getState().charFields : DEFAULT_CHAR_FIELDS),
                    relations: content?.relations || [],
                    version: version || 1 // [修复] 初始版本号写入 DB
                };

                // 存入 DB
                await dbService.saveNovelContent(id, initialContent);

                // [Refactor] Update Store directly, removed local setters


                // [修复] 同步到 entityStore，确保新建书籍时清空旧数据
                useEntityStore.getState().syncFromNovel({
                    data: initialContent.data, // [Refactor] Sync outline data
                    chapterTemplates: initialContent.chapterTemplates,
                    characters: initialContent.characters,
                    scenes: initialContent.scenes,
                    worldSettings: initialContent.worldSettings,
                    charCats: initialContent.charCats,
                    sceneCats: initialContent.sceneCats,
                    settingCats: initialContent.settingCats,
                    relations: initialContent.relations,
                    charFields: initialContent.charFields
                });

                // [修复] 更新内存中的版本号
                if (version) versionRef.current[id] = version;

                setCurrentNovelId(id);
                // [修复] 初始化 Snapshot，确保第一次编辑能正常计算 diff
                lastSnapshotRef.current = createSnapshot(initialContent);

                // [修复] 系统自动创建时静默，用户手动创建时通知
                if (!silent) {
                    operationLog.logCreate('novel', title);
                    showToast('新书创建成功', 'success');
                }
            } else {
                throw new Error(res.message || 'Create failed');
            }
        } catch (e) {
            console.error('[Create] Failed:', e);
            showToast('创建失败: ' + e.message, 'error');
            return null;
        } finally {
            isCreatingNovelRef.current = false; // 释放锁
        }
        return newNovel;
    }, [getStorageKey, operationLog, showToast]);

    const deleteNovel = useCallback(async (id) => {
        const nextNovels = novelsRef.current.filter(n => n.id !== id);
        setNovels(nextNovels);
        localStorage.setItem(getStorageKey('index'), JSON.stringify(nextNovels));

        // 删除 DB 数据
        await dbService.deleteNovel(id);

        if (currentNovelIdRef.current === id) {
            if (nextNovels.length > 0) {
                localStorage.setItem(getStorageKey('last_active'), nextNovels[0].id);
            }
        }

        if (isAuthenticated) {
            try { await fetchAPI(`/api/novel/${id}`, 'DELETE'); } catch (e) { console.error(e); }
        }

        operationLog.logDelete('novel', novelsRef.current.find(n => n.id === id)?.title);
        showToast('小说已删除，正在刷新...', 'success');

        // [修复] 删除后自动刷新页面
        setTimeout(() => window.location.reload(), 500);
    }, [getStorageKey, isAuthenticated, createEmptyNovel, showToast, operationLog]);

    const loadNovelDetails = useCallback(async (novelId) => {
        if (!novelId || !isAuthenticated) return;
        try {
            // [优化] 使用 SyncPull 接口的全量模式 (base_version=0)
            const { syncPullNovel } = await import('../services/api.js');
            const res = await syncPullNovel(novelId, 0);

            if (res?.code === 200 && res.data) {
                const { applyDeltaSync } = await import('../utils/syncUtils.js');

                // [修复] 强制应用全局模版配置，防止服务器旧数据覆盖本地全局设置 (Task 2.8)
                const globalSettings = useSettingsStore.getState();
                // 注意：API 返回的数据使用 snake_case 键名
                if (globalSettings.chapterTemplates?.length > 0) {
                    res.data.chapter_templates = globalSettings.chapterTemplates;
                }
                if (globalSettings.charFields?.length > 0) {
                    res.data.char_fields = globalSettings.charFields;
                }

                // 传入 null 作为 localContent 以强制覆盖
                const result = await applyDeltaSync(novelId, res.data, null);

                if (result.success) {
                    // 更新 Refs
                    if (res.data.latest_version) versionRef.current[novelId] = res.data.latest_version;

                    // 更新快照
                    const { useEntityStore } = await import('../stores/entityStore.js');
                    const currentState = useEntityStore.getState().getSnapshot();
                    lastSnapshotRef.current = createSnapshot(currentState);

                    // 更新书名
                    if (res.data.title && novelsRef.current) {
                        setNovels(prev => prev.map(n => n.id === novelId ? { ...n, title: res.data.title } : n));
                    }

                    // [修复] 初次加载后默认展开第一级节点
                    const uiState = useUIStore.getState();
                    if (uiState.expandedNodeIds.size === 0 && currentState.data?.length > 0) {
                        const volumeIds = currentState.data.map(vol => vol.id);
                        uiState.setNodesExpanded(volumeIds, true);
                    }
                }
            } else {
            }
        } catch (e) {
            console.error("Fetch Details Error", e);
        }
    }, [isAuthenticated]); // [Refactor] Removed dependencies on deleted state variables

    // --- Conflict Handling ---
    const handleMergeConflict = useCallback(async (selections) => {
        if (!currentNovelIdRef.current) return;
        const novelId = currentNovelIdRef.current;

        try {
            // 1. 获取服务器最新全量数据
            // 1. 获取服务器最新全量数据 (增量接口全量模式)
            const { syncPullNovel } = await import('../services/api.js');
            const res = await syncPullNovel(novelId, 0);
            if (!res || !res.data || !res.data.is_snapshot) {
                showToast('合并失败：无法获取服务器快照', 'error');
                return;
            }
            // 更新本地记录的服务器版本
            if (res.data.latest_version) {
                versionRef.current[novelId] = res.data.latest_version;
                localStorage.setItem('novel_versions', JSON.stringify(versionRef.current));
            }

            const { parseSnapshotResponse } = await import('../utils/syncUtils.js');
            const snapshot = parseSnapshotResponse(res.data);

            // 2. 初始化合并基准
            let newNodes = snapshot.data || [];
            let newChars = snapshot.characters || [];
            let newScenes = snapshot.scenes || [];
            let newSettings = snapshot.worldSettings || [];

            // [Refactor] Get current local state from entityStore
            const currentState = useEntityStore.getState();
            const {
                data, characters, scenes, worldSettings,
                charCats, sceneCats, settingCats,
                chapterTemplates, charFields
            } = currentState;

            // 3. 辅助函数：查找本地节点最新数据
            const findLocalNode = (nodes, id) => {
                for (const node of nodes) {
                    if (node.id === id) return node;
                    if (node.children) {
                        const found = findLocalNode(node.children, id);
                        if (found) return found;
                    }
                }
                return null;
            };

            // 4. 应用用户选择的"Local"版本
            Object.entries(selections).forEach(([id, choice]) => {
                if (choice !== 'local') return; // Server choice is already in newNodes/newChars

                const conflict = conflictData.conflicts?.find(c => c.id === id);
                if (!conflict) return;

                if (conflict.type === 'outline_node') {
                    const localNode = findLocalNode(data, id);
                    if (localNode) {
                        // [修复] 复制本地节点的所有关键属性，而非仅部分属性
                        // 保留服务器的 version（后端控制），但覆盖内容和 UI 状态
                        newNodes = updateNode(newNodes, id, {
                            title: localNode.title,
                            content: localNode.content,
                            isExpanded: localNode.isExpanded,
                            isContentExpanded: localNode.isContentExpanded,
                            isLocked: localNode.isLocked,
                            type: localNode.type,
                            // 子节点结构也需要保留（如果本地有新增的子节点）
                            children: localNode.children
                        });
                    }
                } else if (conflict.type === 'character') {
                    const local = characters.find(c => c.id === id);
                    if (local) {
                        const idx = newChars.findIndex(c => c.id === id);
                        if (idx >= 0) newChars[idx] = local;
                        else newChars.push(local);
                    }
                } else if (conflict.type === 'scene') {
                    const local = scenes.find(c => c.id === id);
                    if (local) {
                        const idx = newScenes.findIndex(c => c.id === id);
                        if (idx >= 0) newScenes[idx] = local;
                        else newScenes.push(local);
                    }
                } else if (conflict.type === 'setting') {
                    const local = worldSettings.find(c => c.id === id);
                    if (local) {
                        const idx = newSettings.findIndex(c => c.id === id);
                        if (idx >= 0) newSettings[idx] = local;
                        else newSettings.push(local);
                    }
                }
            });

            // 5. 构造最终数据包
            // [修复] 分类采用合并策略：服务器数据 + 本地新增的分类
            // 这样既保留服务器的更新，又不丢失本地新建的分类
            const mergeCats = (serverCats, localCats) => {
                if (!serverCats || serverCats.length === 0) return localCats || [];
                if (!localCats || localCats.length === 0) return serverCats;
                const serverIds = new Set(serverCats.map(c => c.id));
                const localNewCats = localCats.filter(c => !serverIds.has(c.id));
                return [...serverCats, ...localNewCats];
            };

            const mergedCharCats = mergeCats(snapshot.charCats, charCats);
            const mergedSceneCats = mergeCats(snapshot.sceneCats, sceneCats);
            const mergedSettingCats = mergeCats(snapshot.settingCats, settingCats);

            // [修复] 验证并修正 categoryId 有效性
            // 如果角色/场景/设定的 categoryId 不存在于合并后的分类中，设为第一个分类
            const validateCategoryId = (items, cats, defaultCatId) => {
                const catIds = new Set(cats.map(c => c.id));
                return items.map(item => {
                    if (item.categoryId && !catIds.has(item.categoryId)) {
                        return { ...item, categoryId: defaultCatId };
                    }
                    return item;
                });
            };

            const validatedChars = validateCategoryId(newChars, mergedCharCats, mergedCharCats[0]?.id);
            const validatedScenes = validateCategoryId(newScenes, mergedSceneCats, mergedSceneCats[0]?.id);
            const validatedSettings = validateCategoryId(newSettings, mergedSettingCats, mergedSettingCats[0]?.id);

            // [修复] 不再前端自增版本号，版本号由后端统一控制
            const newVersion = res.data.version || 1;

            const finalState = {
                data: newNodes,
                characters: validatedChars,
                scenes: validatedScenes,
                worldSettings: validatedSettings,
                charCats: mergedCharCats,
                sceneCats: mergedSceneCats,
                settingCats: mergedSettingCats,
                chapterTemplates: chapterTemplates,
                charFields: charFields,
                updated_at: Date.now(),
                version: newVersion // 保持与服务器一致
            };

            // 6. 写入 DB 和 状态
            await dbService.saveNovelContent(novelId, finalState);

            // [Refactor] Sync to entityStore
            useEntityStore.getState().syncFromNovel(finalState);

            // 更新 ref 防止瞬间的版本回跳
            versionRef.current[novelId] = newVersion;

            // 更新快照，防止死循环
            lastSnapshotRef.current = createSnapshot(finalState);

            showToast('合并完成，正在同步覆盖服务器...', 'success'); // 提示语更新
            setConflictDialogOpen(false);
            setDbSyncStatus('unsaved'); // 标记为未保存，useAutoSave 会立即检测到 version 变化并上传

        } catch (e) {
            console.error('[Merge] Failed:', e);
            showToast('合并过程发生错误', 'error');
        }
    }, [conflictData, showToast]); // [Refactor] Removed deleted state dependencies

    // --- Node Operations Wrappers (Using EntityStore) ---
    const handleUpdateNode = useCallback((id, updates) => {
        // [DEBUG] 追踪更新源头
        if (updates.content || updates.title || updates.isContentExpanded !== undefined) {
            // 如果允许，可以打开 console.trace()
            // console.trace('[NodeUpdate Trace]');
        }

        const state = useEntityStore.getState();
        const prevData = state.data; // Get current data from store

        let nextData;

        // 辅助查找函数：同时返回节点和序号信息
        const findNodeInfo = (nodes, volIdx = -1, chapIdx = -1) => {
            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i];
                if (node.type === 'volume') {
                    if (node.id === id) return { node, label: `第${toChineseNum(i + 1)}卷` };
                    if (node.children) {
                        const found = findNodeInfo(node.children, i, -1);
                        if (found) return found;
                    }
                } else if (node.type === 'chapter') {
                    if (node.id === id) return { node, label: `第${toChineseNum(volIdx + 1)}卷 第${toChineseNum(i + 1)}章` };
                    if (node.children) {
                        const found = findNodeInfo(node.children, volIdx, i);
                        if (found) return found;
                    }
                } else {
                    // [修复] 子节点也显示完整路径 "第x卷 第x章 下的"
                    if (node.id === id) {
                        const volPrefix = volIdx >= 0 ? `第${toChineseNum(volIdx + 1)}卷 ` : '';
                        const chapPrefix = chapIdx >= 0 ? `第${toChineseNum(chapIdx + 1)}章 下的` : '';
                        return { node, label: `${volPrefix}${chapPrefix}` };
                    }
                }
            }
            return null;
        };

        const info = findNodeInfo(prevData);
        nextData = updateNode(prevData, id, updates);

        // Update Store
        state.setData(nextData);

        // Logs and Toasts
        if (info && updates.title !== undefined) {
            // [修复] 使用传入的原始标题，如果没有则从 store 获取
            const oldTitle = updates._originalTitle !== undefined ? updates._originalTitle : info.node.title;
            const isChanged = updates.title !== oldTitle;
            const shouldLog = (isChanged || updates._forceLog) && !updates._silent;

            if (shouldLog && updates.title !== oldTitle) {
                const prefix = info.label;
                operationLog.logRename(info.node.type, `${prefix} ${oldTitle || '未命名'}`, `${prefix} ${updates.title || '未命名'}`);
                showToast && showToast(`${prefix}重命名成功`, 'success');
            }
        }
        if (info && updates.content !== undefined) {
            const isChanged = updates.content !== info.node.content;
            const shouldLog = (isChanged || updates._forceLog) && !updates._silent;
            if (shouldLog) {
                const isContainer = ['volume', 'chapter'].includes(info.node.type);
                const fieldName = isContainer ? '简介' : '细纲';
                // [修复] 显示完整路径
                const nodePath = `${info.label} ${info.node.title || '未命名'}`;
                if (operationLog.logUpdate) operationLog.logUpdate(info.node.type, nodePath, `更新${fieldName}`);
                showToast && showToast(`${fieldName}已更新`, 'success');
            }
        }
    }, [operationLog, showToast]);

    const handleDeleteNode = useCallback((id) => {
        const state = useEntityStore.getState();
        if (state.data.length > 0 && state.data[0].id === id) { showToast("首卷不可删", 'error'); return; }

        // [修复] 先获取节点信息，再删除
        const nodeInfo = getNodeInfo(state.data, id);
        const nodeName = nodeInfo ? nodeInfo.path : '未命名';
        const nodeType = nodeInfo?.type || 'node';

        state.setData(deleteNode(state.data, id));
        operationLog.logDelete(nodeType, nodeName);
        showToast('节点已删除', 'success');
    }, [showToast, operationLog]);

    const handleAddChildNode = useCallback((parentId) => {
        const state = useEntityStore.getState();
        const newData = addChild(state.data, parentId, state.chapterTemplates);
        state.setData(newData);

        // [修复] 展开父卷
        useUIStore.getState().setNodeExpanded(parentId, true);
        // [修复] 找到并展开新建的子节点
        const findNewChild = (nodes, pid) => {
            for (const n of nodes) {
                if (n.id === pid) return n.children?.find(c => c.isNew)?.id;
                if (n.children) {
                    const found = findNewChild(n.children, pid);
                    if (found) return found;
                }
            }
            return null;
        };
        const newChildId = findNewChild(newData, parentId);
        if (newChildId) useUIStore.getState().setNodeExpanded(newChildId, true);

        // [修复] 获取父节点信息用于日志
        const parentInfo = getNodeInfo(newData, parentId);
        const parentPath = parentInfo ? parentInfo.path : '未命名';
        const childType = parentInfo?.type === 'volume' ? 'chapter' : 'node';
        operationLog.logCreate(childType, `${parentPath} 下新建`);
        showToast('新建章节/节点成功', 'success');
    }, [operationLog, showToast]);

    const handleAddSiblingNode = useCallback((targetId, level) => {
        const state = useEntityStore.getState();
        // [修复] 获取目标节点信息用于日志
        const targetInfo = getNodeInfo(state.data, targetId);
        const targetPath = targetInfo ? targetInfo.path : '未命名';
        const siblingType = level === 0 ? 'volume' : level === 1 ? 'chapter' : 'node';

        const newData = addSibling(state.data, targetId, level, state.chapterTemplates);
        state.setData(newData);

        // [修复] 找到并展开新建的同级节点（它在 targetId 后面，且有 isNew 标记）
        const findNewSibling = (nodes, tid) => {
            // 检查根级别
            const rootIndex = nodes.findIndex(n => n.id === tid);
            if (rootIndex !== -1 && nodes[rootIndex + 1]?.isNew) {
                return nodes[rootIndex + 1].id;
            }
            // 检查子级别
            for (const n of nodes) {
                if (n.children) {
                    const childIndex = n.children.findIndex(c => c.id === tid);
                    if (childIndex !== -1 && n.children[childIndex + 1]?.isNew) {
                        return n.children[childIndex + 1].id;
                    }
                    const found = findNewSibling(n.children, tid);
                    if (found) return found;
                }
            }
            return null;
        };
        const newSiblingId = findNewSibling(newData, targetId);
        if (newSiblingId) {
            // [优化] 展开新节点，同时折叠原节点（包括简介）
            useUIStore.getState().setNodeExpanded(newSiblingId, true);
            useUIStore.getState().setNodeExpanded(targetId, false);
            // [修复] 同时折叠原节点的简介
            state.setData(updateNode(newData, targetId, { isContentExpanded: false }));
        }

        operationLog.logCreate(siblingType, `${targetPath} 同级新建`);
        showToast('新建同级节点成功', 'success');
    }, [operationLog, showToast]);

    const handleToggleAccordion = useCallback((id) => {
        // [重构] 使用 uiStore 管理展开状态
        const uiState = useUIStore.getState();
        if (!id || typeof id === 'object') {
            // 折叠所有节点
            uiState.collapseAllNodes();
            // [修复] 同时折叠所有简介（使用现有的 collapseAllNodes 工具函数）
            const state = useEntityStore.getState();
            state.setData(collapseAllNodes(state.data));
        } else {
            // 切换单个节点
            uiState.toggleNodeExpand(id);
        }
        // [新增] 折叠时退出插入模式
        if (uiState.reorderState) uiState.exitReorderMode();
    }, []);

    const handleAddRoot = useCallback(() => {
        const state = useEntityStore.getState();
        const volumeNum = toChineseNum(state.data.length + 1);
        const volumeTitle = `第${volumeNum}卷`;
        state.setData([...state.data, { id: generateId(), type: 'volume', title: volumeTitle, children: [], expanded: true, version: 1 }]);
        operationLog.logCreate('volume', volumeTitle);
        showToast('新卷创建成功', 'success');
    }, [operationLog, showToast]);

    // ============================================================
    // 章节排序操作
    // ============================================================

    /**
     * 查找节点及其同级节点列表
     * @returns { siblings: Array, index: number, parentId: string|null } | null
     */
    const findNodeAndSiblings = useCallback((data, nodeId, nodeLevel) => {
        // 卷级别：同级就是 data 根数组
        if (nodeLevel === 0) {
            const index = data.findIndex(n => n.id === nodeId);
            if (index === -1) return null;
            return { siblings: data, index, parentId: null };
        }
        // 章节级别：在所有卷的 children 中查找
        for (const vol of data) {
            if (vol.children) {
                const index = vol.children.findIndex(n => n.id === nodeId);
                if (index !== -1) {
                    return { siblings: vol.children, index, parentId: vol.id };
                }
                // 子项级别：在章节的 children 中查找
                for (const ch of vol.children) {
                    if (ch.children) {
                        const idx = ch.children.findIndex(n => n.id === nodeId);
                        if (idx !== -1) {
                            return { siblings: ch.children, index: idx, parentId: ch.id };
                        }
                    }
                }
            }
        }
        return null;
    }, []);

    /**
     * 单步上移：与上方同级节点交换位置
     */
    const handleMoveNodeUp = useCallback((nodeId, level) => {
        const state = useEntityStore.getState();
        const data = JSON.parse(JSON.stringify(state.data)); // 深拷贝

        const result = findNodeAndSiblings(data, nodeId, level);
        if (!result || result.index <= 0) {
            showToast('已是第一个，无法上移', 'info');
            return;
        }

        // 交换位置
        const { siblings, index } = result;
        [siblings[index - 1], siblings[index]] = [siblings[index], siblings[index - 1]];

        state.setData(data);
        showToast('已上移', 'success');
    }, [findNodeAndSiblings, showToast]);

    /**
     * 插入模式：将 sourceId 节点插入到 targetId 节点的下方
     */
    const handleInsertAfter = useCallback((sourceId, targetId, sourceLevel) => {
        const state = useEntityStore.getState();
        const data = JSON.parse(JSON.stringify(state.data)); // 深拷贝

        // 找到源节点
        const sourceResult = findNodeAndSiblings(data, sourceId, sourceLevel);
        if (!sourceResult) return;

        // 找到目标节点（必须是同级）
        const targetResult = findNodeAndSiblings(data, targetId, sourceLevel);
        if (!targetResult) return;

        // 确保是同一个父容器
        if (sourceResult.parentId !== targetResult.parentId) {
            showToast('只能在同级节点间移动', 'error');
            return;
        }

        const { siblings, index: sourceIndex } = sourceResult;
        const targetIndex = targetResult.index;

        // 移除源节点
        const [movedNode] = siblings.splice(sourceIndex, 1);

        // 计算插入位置（目标节点下方）
        // 如果源在目标前面，移除后目标索引会减1
        const insertIndex = sourceIndex < targetIndex ? targetIndex : targetIndex + 1;
        siblings.splice(insertIndex, 0, movedNode);

        state.setData(data);
        showToast('已插入', 'success');
    }, [findNodeAndSiblings, showToast]);

    const fetchRelations = useCallback(async () => {
        if (!currentNovelId || !isAuthenticated) return;
        try {
            const res = await fetchAPI(`/api/relation/${currentNovelId}`);
            if (res && Array.isArray(res)) {
                // [Refactor] Use direct store update instead of context setter
                useEntityStore.setState({ relations: res });
                // 同时更新 DB 为了离线缓存 (Optional)
                // await dbService...
            }
        } catch (e) {
            console.error("Fetch Relations Error", e);
        }
    }, [currentNovelId, isAuthenticated]);

    // [新增] 热更新函数 - 用于静默同步时更新所有状态，替代 window.location.reload()
    // 设计目的：useAutoSave 检测到云端更新时，调用此函数直接更新 React 状态，避免页面刷新
    // [新增] 热更新函数 - 用于静默同步时更新所有状态，替代 window.location.reload()
    // 设计目的：useAutoSave 检测到云端更新时，调用此函数直接更新 React 状态，避免页面刷新
    const updateAllState = useCallback((newState) => {
        useEntityStore.getState().syncFromNovel({
            data: newState.data || [],
            characters: newState.characters || [],
            charCats: newState.charCats || [],
            scenes: newState.scenes || [],
            sceneCats: newState.sceneCats || [],
            worldSettings: newState.worldSettings || [],
            settingCats: newState.settingCats || [],
            relations: newState.relations || [],
            // [修复] 热更新时也强制应用全局模版
            chapterTemplates: (useSettingsStore.getState().chapterTemplates?.length > 0)
                ? useSettingsStore.getState().chapterTemplates
                : (newState.chapterTemplates || DEFAULT_CHAPTER_TEMPLATES),
            charFields: (useSettingsStore.getState().charFields?.length > 0)
                ? useSettingsStore.getState().charFields
                : (newState.charFields || DEFAULT_CHAR_FIELDS)
        });

        // 更新快照，防止立即触发再次同步
        if (newState) {
            lastSnapshotRef.current = createSnapshot(newState);
        }
    }, []);

    // 每当 loadNovelDetails 完成（或切换小说），也顺便拉取一次 relations
    // 注意：loadNovelDetails 返回的 content 中可能已经包含 relations (如果后端 details 接口聚合了它)
    // 目前后端 details 接口似乎还没聚合 relation，所以需要单独拉取，或者修改后端 details
    // 为了稳妥，我们在 loadNovelDetails 后，或者 currentNovelId 变化后调用 fetchRelations
    useEffect(() => {
        if (currentNovelId) fetchRelations();
    }, [currentNovelId, fetchRelations]);

    // [性能优化] 使用 useMemo 包裹 value，避免每次渲染都创建新对象导致消费者不必要的重渲染
    const value = useMemo(() => ({
        novels, setNovels,
        currentNovelId, setCurrentNovelId,
        isLoading, isLoadingRef, // [关键修复] 导出同步的 ref

        // Remove: data, setData, characters... logic moved to entityStore

        fetchRelations, // [新增] 导出给组件手动刷新
        dbSyncStatus, setDbSyncStatus,
        lastSnapshotRef,
        serverTimestampRef, versionRef,

        conflictDialogOpen, setConflictDialogOpen,
        conflictData, setConflictData,
        operationLog,

        createEmptyNovel, deleteNovel, loadNovelDetails,
        handleMergeConflict,

        handleUpdateNode, handleDeleteNode, handleAddChildNode, handleAddSiblingNode, handleToggleAccordion, handleAddRoot,
        handleMoveNodeUp, handleInsertAfter, // [新增] 章节排序
        getStorageKey,
        novelsRef, currentNovelIdRef,
        updateAllState, // [新增] 导出热更新函数

        // [修复] 导出备份功能 - 复用 buildBackupJSON
        handleExportJSON: () => {
            const currentTitle = novels.find(n => n.id === currentNovelId)?.title || 'Backup';
            const state = useEntityStore.getState();
            const exportData = buildBackupJSON({
                novelId: currentNovelId,
                title: currentTitle,
                data: state.data,
                chapterTemplates: state.chapterTemplates,
                charFields: state.charFields,
                charCats: state.charCats,
                characters: state.characters,
                sceneCats: state.sceneCats,
                scenes: state.scenes,
                settingCats: state.settingCats,
                worldSettings: state.worldSettings,
                relations: state.relations || []
            });
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${currentTitle}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showToast?.('已导出备份文件', 'success');
        },

        // handleImportJSON can stay as is (it calls restoreFromBackup which uses store sync ?)
        // restoreFromBackup likely needs to be checked if it returns data or updates Context/Store.
        // Assuming restore returns data and caller updates. 
        // Let's keep existing handleImportJSON as it calls restoreFromBackup.
        handleImportJSON: (fileOrEvent) => {
            // ... same as before but ensure restore updates Store
            const file = fileOrEvent?.target?.files?.[0] || fileOrEvent;
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const json = JSON.parse(event.target.result);
                    if (!json.content || !json.meta) {
                        showToast?.('文件格式错误：缺少 content 或 meta', 'error');
                        return;
                    }
                    // NOTE: restoreFromBackup helper should be updated to push to Store if it doesn't already
                    // Or we handle it here. 
                    // Let's assume restoreFromBackup returns result.
                    const result = await restoreFromBackup(json, getStorageKey, { showToast });
                    if (result.success) {
                        // After restore success, we should reload data
                        // If restoreFromBackup updates DB, we should reload from DB or sync to Store.
                        // Usually handleRestoreSuccess reloads the page or updates state.
                        handleRestoreSuccess(result.newId, result.newTitle, getStorageKey, { showToast });
                    } else {
                        showToast?.('导入失败: ' + result.error, 'error');
                    }
                } catch (err) {
                    showToast?.('解析 JSON 失败', 'error');
                    console.error(err);
                }
            };
            reader.readAsText(file);
        },

        // [修复] 暴露导出函数，连接 UI 按钮
        handleExportText: () => {
            const state = useEntityStore.getState();
            exportNovelText({ novelsRef, currentNovelId, data: state.data })
        },
        handleExportMindmap: () => {
            const state = useEntityStore.getState();
            exportNovelMindmap({ novelsRef, currentNovelId, data: state.data })
        },
    }), [
        novels, currentNovelId, isLoading,
        dbSyncStatus, conflictDialogOpen, conflictData,
        createEmptyNovel, deleteNovel, loadNovelDetails, handleMergeConflict,
        handleUpdateNode, handleDeleteNode, handleAddChildNode, handleAddSiblingNode,
        handleToggleAccordion, handleAddRoot, handleMoveNodeUp, handleInsertAfter,
        fetchRelations, getStorageKey, operationLog, updateAllState, showToast
    ]);

    return (
        <NovelContext.Provider value={value}>
            {children}
        </NovelContext.Provider>
    );
}

export function useNovel() {
    const context = useContext(NovelContext);
    if (!context) throw new Error('useNovel must be used within a NovelProvider');
    return context;
}

export default NovelContext;
