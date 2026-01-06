// ==================================================================
// frontend/src/hooks/useAutoSave.js
// [正确实现] 增量同步 Hook
// 设计原则：
//   1. 增量同步：通过 Snapshot 对比，只同步修改的数据
//   2. 防抖 + 本地优先：立即写入 IndexedDB，延迟批量同步服务器
//   3. 清晰状态机：idle → unsaved → syncing → success/error
// ==================================================================

import { useEffect, useRef, useCallback, useState } from 'react';
import { useNovel, useUser, useToast } from '../contexts';
import { fetchAPI } from '../services/api';
import { useWebDAV } from './useWebDAV';
import { useWsStore } from '../stores'; // [新增] WebDAV 状态存入 Store
import { extractChapters } from '../utils/novelUtils';
import { computeSyncPayload, computeChapterChanges, hasChanges, createSnapshot } from '../utils/syncUtils';
import { dbService } from '../services/db';

import { useEntityStore } from '../stores/entityStore'; // [Refactor] Import Store
import { useUIStore } from '../stores/uiStore'; // [新增] 用于检测编辑模式

/**
 * 自动保存 Hook（增量同步版）
 * 
 * 核心逻辑：
 * 1. 任何数据变化 → 立即写入 IndexedDB（乐观更新）
 * 2. 通过 Snapshot 对比，计算出变化的数据
 * 3. 防抖 3 秒后 → 只发送变化的数据到服务器
 * 4. 同步成功 → 更新 Snapshot 作为新基准
 */
export function useAutoSave(interval = 3000) {
    // ==================== Context ====================
    // [方案A回退] 所有数据统一从 NovelContext 获取，确保切换书籍时数据同步
    const {
        currentNovelId, novelsRef, novels,
        // Removed data, characters... from Context
        dbSyncStatus, setDbSyncStatus,
        lastSnapshotRef, serverTimestampRef, versionRef,
        getStorageKey,
        setConflictDialogOpen, setConflictData,
        operationLog, isLoading, isLoadingRef,  // [关键修复] 获取同步的 ref
        updateAllState
    } = useNovel();

    // [Refactor] Get Entity Data from Zustand Store
    // Using granular selectors to avoid unnecessary re-renders (though we need them all for sync)
    const data = useEntityStore(state => state.data);
    const characters = useEntityStore(state => state.characters);
    const charCats = useEntityStore(state => state.charCats);
    const scenes = useEntityStore(state => state.scenes);
    const sceneCats = useEntityStore(state => state.sceneCats);
    const worldSettings = useEntityStore(state => state.worldSettings);
    const settingCats = useEntityStore(state => state.settingCats);
    const chapterTemplates = useEntityStore(state => state.chapterTemplates);
    const charFields = useEntityStore(state => state.charFields);
    const relations = useEntityStore(state => state.relations);

    const { permissions } = useUser();
    const { addToast, showToast } = useToast();

    // ==================== State ====================
    const [isSaving, setIsSaving] = useState(false);

    // [重构] 使用全局 Store 管理 WebDAV 状态
    const setWebdavStatus = useWsStore(state => state.setWebdavStatus);
    const webdavStatus = useWsStore(state => state.webdavStatus);
    const [lastSaved, setLastSaved] = useState(null);

    // ==================== Refs ====================
    const syncTimerRef = useRef(null);
    const isSyncingRef = useRef(false);
    const performSyncRef = useRef(null);
    const successTimerRef = useRef(null); // [优化] 绿灯自动消失定时器
    const syncingTimeoutRef = useRef(null); // [兜底] syncing 状态 10 秒超时保护
    const hasPendingChangesRef = useRef(false); // [新增] 排队机制：标记是否有待处理的变更

    // 最新状态的引用（解决闭包问题）
    const stateRef = useRef({
        data, characters, charCats, scenes, sceneCats,
        worldSettings, settingCats, chapterTemplates, charFields, relations
    });
    stateRef.current = {
        data, characters, charCats, scenes, sceneCats,
        worldSettings, settingCats, chapterTemplates, charFields, relations
    };

    // ==================== 页面卸载/失焦时合并临时表到主表 ====================
    useEffect(() => {
        if (!currentNovelId) return;

        // 将临时表数据同步到主表
        const flushPendingToMain = async () => {
            try {
                const pending = await dbService.getPendingEdit(currentNovelId);
                if (pending) {
                    await dbService.saveNovelContent(currentNovelId, pending);
                    await dbService.deletePendingEdit(currentNovelId);
                }
            } catch (e) {
            }
        };

        // 页面隐藏时（切换Tab、锁屏等）触发
        const handleVisibilityChange = () => {
            if (document.hidden) {
                flushPendingToMain();
            }
        };

        // 页面卸载前触发
        const handleBeforeUnload = () => {
            flushPendingToMain();
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [currentNovelId]);

    // ==================== WebDAV Hook ====================
    const webdavHook = useWebDAV({
        getStorageKey, currentNovelId, novels, data, characters, charCats,
        scenes, sceneCats, worldSettings, settingCats, chapterTemplates,
        charFields, relations, permissions, operationLog, addToast, showToast
    });

    const syncToWebDAV = useCallback(async (isManual = false) => {
        const result = await webdavHook.backup(isManual);
        if (result.success) {
            setWebdavStatus('success', '');
        } else if (result.error) {
            if (isManual) showToast({ message: `WebDAV 备份失败: ${result.error}`, type: 'error' });
            setWebdavStatus('error', result.error);
        }
    }, [webdavHook, setWebdavStatus, showToast]);

    // ==================== 核心：增量同步函数 ====================
    const performSync = useCallback(async (isManual = false) => {
        // 防止并发 - [修复] 不再丢弃，而是标记待处理
        if (isSyncingRef.current) {
            hasPendingChangesRef.current = true;
            return;
        }

        // 前置检查
        const token = localStorage.getItem('novel_token');
        if (!token) {
            if (isManual) showToast('请先登录', 'error');
            setDbSyncStatus('idle');
            return;
        }

        if (!currentNovelId) {
            setDbSyncStatus('idle');
            return;
        }

        isSyncingRef.current = true;
        setDbSyncStatus('syncing');

        // [兜底] 10 秒超时保护：防止 syncing 指示灯卡住
        if (syncingTimeoutRef.current) clearTimeout(syncingTimeoutRef.current);
        syncingTimeoutRef.current = setTimeout(() => {
            if (isSyncingRef.current) {
                console.warn('[AutoSave] syncing 状态超时 10 秒，重置为 idle');
                setDbSyncStatus('idle');
            }
        }, 10000);

        try {
            // 从 ref 读取最新状态
            const state = stateRef.current;

            // 清理数据：移除临时标记
            const cleanData = JSON.parse(JSON.stringify(state.data, (k, v) => {
                if (k === 'isNew' || k === 'isContentUpdated') return undefined;
                return v;
            }));

            // 构建当前状态对象（用于对比）
            const currentState = {
                data: cleanData,
                characters: state.characters,
                charCats: state.charCats,
                scenes: state.scenes,
                sceneCats: state.sceneCats,
                worldSettings: state.worldSettings,
                settingCats: state.settingCats,
                chapterTemplates: state.chapterTemplates,
                charFields: state.charFields,
                relations: state.relations  // [修复] 添加 relations
            };

            // [核心] 计算增量：与上次 Snapshot 对比，找出变化的数据
            const snapshot = lastSnapshotRef.current;
            const syncPayload = computeSyncPayload(snapshot, currentState);
            const chapterChanges = computeChapterChanges(
                extractChapters(snapshot?.data || []),
                extractChapters(cleanData)
            );

            // 无变化则跳过
            // 无变化则跳过
            if (!hasChanges(syncPayload) && chapterChanges.length === 0) {
                // [修复] 无论自动还是手动，无变化都应重置状态为 success，防止卡在 syncing (蓝色) (Task 2.9)
                if (syncingTimeoutRef.current) clearTimeout(syncingTimeoutRef.current); // [兜底] 清除超时定时器
                setDbSyncStatus('success');

                // [优化] 3 秒后绿灯自动变灰
                if (successTimerRef.current) clearTimeout(successTimerRef.current);
                successTimerRef.current = setTimeout(() => {
                    setDbSyncStatus('idle');
                }, 3000);

                if (isManual) {
                    showToast('已是最新，无需同步', 'success');
                }
                isSyncingRef.current = false;
                return;
            }

            // 获取当前小说标题
            const currentTitle = novelsRef.current?.find(n => n.id === currentNovelId)?.title || '未命名';

            // 构建请求体（只包含变化的数据）
            const payload = {
                novel_id: currentNovelId,
                title: currentTitle,
                ...syncPayload,  // nodes, characters, scenes, settings, categories, deleted_ids
                chapters: chapterChanges,
                base_version: versionRef.current?.[currentNovelId] || null
            };

            // 发送请求（30秒超时）
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // [修复] 缩短超时时间

            const res = await fetchAPI('/api/novel/sync', 'POST', payload, {
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            // 处理响应
            if (res && !res.error && !res.detail) {
                // 同步成功
                if (syncingTimeoutRef.current) clearTimeout(syncingTimeoutRef.current); // [兜底] 清除超时定时器
                setDbSyncStatus('success');

                // [优化] 3 秒后绿灯自动变灰
                if (successTimerRef.current) clearTimeout(successTimerRef.current);
                successTimerRef.current = setTimeout(() => {
                    setDbSyncStatus('idle');
                }, 3000);

                // [关键修复] 使用服务器返回的 updated_versions 更新 currentState 中的版本号
                // 确保快照中的版本号与服务器一致，防止 diffByVersion 误判变化
                if (res.updated_versions) {
                    const applyVersions = (list, updates, isTree = false) => {
                        if (!list || !updates) return;
                        const verMap = new Map(updates.map(u => [u.id, u.version]));

                        if (isTree) {
                            const updateTree = (items) => {
                                items.forEach(item => {
                                    if (verMap.has(item.id)) item.version = verMap.get(item.id);
                                    if (item.children) updateTree(item.children);
                                });
                            };
                            updateTree(list);
                        } else {
                            list.forEach(item => {
                                if (verMap.has(item.id)) item.version = verMap.get(item.id);
                            });
                        }
                    };

                    applyVersions(currentState.data, res.updated_versions.nodes, true);
                    applyVersions(currentState.characters, res.updated_versions.characters);
                    applyVersions(currentState.scenes, res.updated_versions.scenes);
                    applyVersions(currentState.worldSettings, res.updated_versions.settings);
                    applyVersions(currentState.charCats, res.updated_versions.categories); // 分类通常混在一起，这里假设后端分开了
                    applyVersions(currentState.sceneCats, res.updated_versions.categories);
                    applyVersions(currentState.settingCats, res.updated_versions.categories);
                    applyVersions(currentState.relations, res.updated_versions.relations);
                }

                // [关键] 更新 Snapshot 为当前状态（作为下次对比的基准）
                lastSnapshotRef.current = createSnapshot(currentState);

                // 更新服务器时间戳和版本号
                if (res.updated_at) {
                    serverTimestampRef.current[currentNovelId] = res.updated_at;
                    localStorage.setItem('novel_server_timestamps', JSON.stringify(serverTimestampRef.current));
                }
                if (res.version !== undefined) {
                    versionRef.current[currentNovelId] = res.version;
                    localStorage.setItem('novel_versions', JSON.stringify(versionRef.current));
                    // [新增] 同步成功后删除临时表，并将数据持久化到主表
                    dbService.deletePendingEdit(currentNovelId).catch(console.warn);
                    dbService.saveNovelContent(currentNovelId, {
                        ...currentState,
                        version: res.version,
                        updated_at: Date.now()
                    }).catch(console.warn);
                }

                if (isManual) showToast('同步成功', 'success');

            } else if (res?.status === 409 || res?.error === 'VERSION_CONFLICT') {
                // 409 冲突处理
                if (syncingTimeoutRef.current) clearTimeout(syncingTimeoutRef.current); // [兜底] 清除超时定时器
                setDbSyncStatus('idle');

                try {
                    // 1. 获取服务器最新数据 (增量接口全量模式)
                    const { syncPullNovel } = await import('../services/api.js');
                    const serverRes = await syncPullNovel(currentNovelId, 0); // Force snapshot
                    if (!serverRes || !serverRes.data || !serverRes.data.is_snapshot) throw new Error('Failed to fetch server snapshot');

                    // 2. 动态导入 Diff 工具
                    const { parseSnapshotResponse, compareOutlineNodes, compareListItems, createSnapshot } = await import('../utils/syncUtils.js');

                    // 3. 解析服务器数据 (适配 legacy 字段名)
                    const snapshot = parseSnapshotResponse(serverRes.data);
                    const parsedServer = {
                        ...snapshot,
                        chars: snapshot.characters,
                        world: snapshot.worldSettings,
                        setCats: snapshot.settingCats,
                        templates: snapshot.chapterTemplates
                    };

                    // 3.5 [核心修复] 判断本地是否有未同步的修改
                    let isLocalDirty = true;
                    // 3.6 [新增] 判断服务器是否相对于我们的快照发生了变化 (3-way merge base check)
                    let isServerDirty = true;

                    // [新增] 尝试从 DB 恢复快照（应对刷新页面导致的内存丢失）
                    if (!lastSnapshotRef.current) {
                        try {
                            const savedSnapshot = await dbService.getSnapshot(currentNovelId);
                            if (savedSnapshot) {
                                // 移除 novel_id 字段以符合内存格式
                                const { novel_id, ...rest } = savedSnapshot;
                                lastSnapshotRef.current = createSnapshot(rest);
                            }
                        } catch (e) {
                        }
                    }

                    if (lastSnapshotRef.current) {
                        const localChanges = computeSyncPayload(lastSnapshotRef.current, {
                            data, characters, scenes, worldSettings,
                            charCats, sceneCats, settingCats,
                            chapterTemplates, charFields
                        });
                        isLocalDirty = hasChanges(localChanges);
                        if (!isLocalDirty) {
                        }

                        // [关键新增] 检查服务器是否真的变了（相对于我们上次已知的状态）
                        const serverChanges = computeSyncPayload(lastSnapshotRef.current, {
                            data: parsedServer.data,
                            characters: parsedServer.chars,
                            scenes: parsedServer.scenes,
                            worldSettings: parsedServer.world,
                            charCats: parsedServer.charCats,
                            sceneCats: parsedServer.sceneCats,
                            settingCats: parsedServer.setCats,
                            chapterTemplates: parsedServer.templates,
                            charFields: parsedServer.charFields
                        });
                        isServerDirty = hasChanges(serverChanges);
                    } else {
                        // [修复] 没有快照时，根据服务器版本号判断
                        // 服务器版本=1 说明是初始状态，本地数据应该直接覆盖
                        isServerDirty = (serverRes.data.latest_version || 1) > 1;
                    }

                    // [新增] 初始版本检测：服务器版本=1 表示刚创建的默认数据
                    // 这种情况下本地有实际内容，应该直接上传覆盖，不弹冲突
                    const isServerInitialState = (serverRes.data.latest_version || 1) === 1;
                    const localVersion = versionRef.current?.[currentNovelId] || 0;
                    const serverVersion = serverRes.data.latest_version || 1;


                    // [重构] 两阶段版本号比较策略：
                    // 阶段1: 大版本号判断
                    // - 服务器是初始状态（v1）→ 直接静默上传
                    // - 本地版本 >= 服务器版本 → 直接静默上传（本地优先）
                    // - 本地版本 < 服务器版本 → 进入阶段2（小版本号比较）

                    if (isServerInitialState && data && data.length > 0) {
                        versionRef.current[currentNovelId] = 1;
                        localStorage.setItem('novel_versions', JSON.stringify(versionRef.current));
                        setDbSyncStatus('unsaved');
                        isSyncingRef.current = false; // [修复] 提前 return 时释放锁
                        return;
                    }

                    // [修复] 删除 localVersion >= serverVersion 的快速返回路径
                    // 原因：既然收到了 409，说明服务器版本与本地不一致
                    // 此时应该始终进入阶段2进行数据对比和合并
                    // 而不是基于可能已过期的本地版本号判断

                    // 阶段2: 小版本号比较（本地版本落后于服务器）

                    // 4. 计算差异 (Local vs Server) - 只标记真正冲突的项（item.version < server.version）
                    const conflicts = [
                        ...compareOutlineNodes(data, parsedServer.data || [], 'Server', '大纲'),
                        ...compareListItems(characters, parsedServer.chars || [], 'Character', 'character'),
                        ...compareListItems(scenes, parsedServer.scenes || [], 'Scene', 'scene'),
                        ...compareListItems(worldSettings, parsedServer.world || [], 'Setting', 'setting')
                    ];

                    // [重构] 决策逻辑：
                    // - conflicts.length = 0 → 所有单项本地版本都不落后，静默更新到服务器版本
                    // - conflicts.length > 0 → 存在真正冲突，弹窗让用户选择


                    // [修复] 核心逻辑修正：如果本地是干净的 (无未保存修改)，则不论版本差距多大，都视为 Fast-forward
                    // 直接静默接受服务器的所有变更，不报冲突。
                    if (!isLocalDirty) {
                        conflicts.length = 0;
                    }

                    if (conflicts.length > 0) {
                        // 存在真正冲突：部分单项本地版本落后且内容不同
                        setConflictData({
                            conflicts: conflicts,
                            localVersion: localVersion,
                            serverVersion: serverVersion
                        });
                        setConflictDialogOpen(true);
                    } else {
                        // [关键修正] 静默升级：不仅更新版本号，还要更新本地数据！

                        const newState = {
                            data: parsedServer.data,
                            characters: parsedServer.chars,
                            charCats: parsedServer.charCats,
                            scenes: parsedServer.scenes,
                            sceneCats: parsedServer.sceneCats,
                            worldSettings: parsedServer.world,
                            settingCats: parsedServer.setCats,
                            chapterTemplates: parsedServer.templates,
                            charFields: parsedServer.charFields,
                            updated_at: Date.now(),
                            version: serverRes.data.latest_version
                        };

                        // 1. 更新 React 状态 (Hot Reload)
                        // 注意：这里需要拿到 context 的 setter，但 useAutoSave 里没有这些 setter
                        // 这是一个 hook，数据是外部传进来的。
                        // 此时我们处于 409 错误处理流程中。
                        // 由于 useAutoSave 没有 setData 等方法，我们只能更新 DB，并触发强制刷新或通知用户刷新。
                        // 或者：如果这是一个完全自动的过程，且用户正在操作，突然变了有点吓人。
                        // 但既然是“静默升级”，且本地没改，那么变化是可以接受的。

                        // 修正：useAutoSave 确实没有 setter。
                        // 方案 A: 写入 DB，然后 window.location.reload() (最稳妥，防止状态不一致)
                        // 方案 B: 仅更新 ref 和 DB，等待用户下次手动刷新 (会导致依然显示旧内容)

                        await dbService.saveNovelContent(currentNovelId, newState);

                        if (serverRes.data.latest_version) {
                            versionRef.current[currentNovelId] = serverRes.data.latest_version;
                            localStorage.setItem('novel_versions', JSON.stringify(versionRef.current));
                        }
                        const newSnapshot = createSnapshot(newState);
                        lastSnapshotRef.current = newSnapshot;
                        // [新增] 每次更新快照时也持久化一份，作为未来的"证人"
                        dbService.saveSnapshot(currentNovelId, newSnapshot).catch(e => console.warn('Snapshot save failed', e));

                        // [修复] 静默同步成功：刷新 EntityStore，确保界面更新
                        useEntityStore.getState().syncFromNovel(newState);

                        setDbSyncStatus('success'); // [修复] 静默更新成功后设置状态

                        // [优化] 3 秒后绿灯自动变灰
                        if (successTimerRef.current) clearTimeout(successTimerRef.current);
                        successTimerRef.current = setTimeout(() => {
                            setDbSyncStatus('idle');
                        }, 3000);
                    }

                } catch (fetchErr) {
                    console.error('[AutoSave] Failed to resolve conflict:', fetchErr);
                    showToast('版本冲突且无法获取最新数据，请刷新页面', 'error');
                }

            } else if (res?.conflicts?.length > 0) {
                // 字段级冲突：使用原有的 ConflictDialog
                setConflictData({
                    conflicts: res.conflicts,
                    localVersion: versionRef.current?.[currentNovelId] || null,
                    serverVersion: res.server_version
                });
                setConflictDialogOpen(true);
                if (syncingTimeoutRef.current) clearTimeout(syncingTimeoutRef.current); // [兜底] 清除超时定时器
                setDbSyncStatus('idle');

            } else {
                // 同步失败
                if (syncingTimeoutRef.current) clearTimeout(syncingTimeoutRef.current); // [兜底] 清除超时定时器
                setDbSyncStatus('error');
                console.error('[AutoSave] Sync failed:', res?.detail || res?.error);
                if (isManual) showToast('同步失败: ' + (res?.detail || '未知错误'), 'error');
            }

        } catch (e) {
            if (e.name === 'AbortError') {
                console.error('[AutoSave] 同步超时');
                if (isManual) showToast('同步超时，请检查网络', 'error');
            } else {
                console.error('[AutoSave] 同步出错:', e);
                if (isManual) showToast('同步出错: ' + e.message, 'error');
            }
            if (syncingTimeoutRef.current) clearTimeout(syncingTimeoutRef.current); // [兜底] 清除超时定时器
            setDbSyncStatus('error');

        } finally {
            isSyncingRef.current = false;

            // [新增] 排队机制：如果有待处理的变更，立即再次同步
            if (hasPendingChangesRef.current) {
                hasPendingChangesRef.current = false;
                // 使用 setTimeout 避免同步调用导致的栈溢出
                setTimeout(() => performSyncRef.current?.(false), 100);
            }

            // 静默执行 WebDAV 备份
            syncToWebDAV(false);
        }
    }, [
        currentNovelId, novelsRef, showToast, syncToWebDAV,
        lastSnapshotRef, versionRef, serverTimestampRef,
        setDbSyncStatus, setConflictData, setConflictDialogOpen
    ]);

    // [修复] 更新 ref，供 useEffect 调用（避免依赖项循环）
    performSyncRef.current = performSync;

    // ==================== 核心：自动保存 Effect ====================
    // [Fix] 增加首次加载标记
    const isFirstLoadRef = useRef(true);

    useEffect(() => {
        // [关键修复] 使用同步的 ref 检查，而不是异步的状态
        // isLoadingRef 在 loadLocalData 开始时立即设为 true，在结束时设为 false
        // 这样可以避免在数据加载期间触发保存
        if (isLoadingRef?.current) {
            return;
        }
        if (isLoading) return;
        if (!currentNovelId) return;

        // [修复 BUG 3 - 强化版] 防止空数据覆盖本地 DB
        // 如果 data 为空，直接跳过保存 - 不依赖 novelsRef（可能还没加载）
        // 空数据永远不应该写入 IndexedDB
        if (!data || data.length === 0) {
            return;
        }

        const currentState = {
            data, characters, charCats, scenes, sceneCats,
            worldSettings, settingCats, chapterTemplates, charFields, relations
        };

        // [关键修复] 当从 Loading 变为完成时，如果是第一次运行且没有基准快照
        // 说明这是刚从 IndexedDB 加载出来的初始数据
        // 直接将其作为 Snapshot，不要标记为"Unsaved"
        if (isFirstLoadRef.current && !lastSnapshotRef.current) {
            // console.log('[AutoSave] First load complete, initializing snapshot without save');
            lastSnapshotRef.current = createSnapshot(currentState);
            isFirstLoadRef.current = false;
            return;
        }
        // 即便不是 firstLoad，如果快照丢失了，也应该补上而不是报错变黄
        if (!lastSnapshotRef.current) {
            lastSnapshotRef.current = createSnapshot(currentState);
            return;
        }

        // [修复] 仅 UI 状态变化（如 isExpanded）时，跳过同步
        // 这样折叠/展开分类不会触发自动保存和服务器同步
        const syncPayload = computeSyncPayload(lastSnapshotRef.current, currentState);
        const chapterChanges = computeChapterChanges(
            extractChapters(lastSnapshotRef.current?.data || []),
            extractChapters(data)
        );
        if (!hasChanges(syncPayload) && chapterChanges.length === 0) {
            // 无业务数据变化，跳过同步（可能只是 isExpanded 变化）
            return;
        }

        // 标记后续不再是首次加载
        isFirstLoadRef.current = false;

        // Step 1: 立即标记为未保存 (响应用户指令：只要进入此逻辑即视为变化，立即变灯)
        setDbSyncStatus('unsaved');



        // Step 1: 立即写入本地 IndexedDB（乐观更新）
        const cleanData = JSON.parse(JSON.stringify(data, (k, v) => {
            if (k === 'isNew' || k === 'isContentUpdated') return undefined;
            return v;
        }));

        const contentToSave = {
            data: cleanData,
            characters, charCats, scenes, sceneCats,
            worldSettings, settingCats, chapterTemplates, charFields, relations,
            updated_at: Date.now(),
            version: versionRef.current?.[currentNovelId]
        };

        // [重构] 编辑时写入临时表，而非主表
        // 这样避免同步回调时更新主表导致 UI 重渲染
        dbService.savePendingEdit(currentNovelId, contentToSave)
            .then(() => {
                setLastSaved(new Date().toLocaleTimeString());
            })
            .catch(err => console.error('[AutoSave] PendingEdit Error:', err));

        // Step 2: 标记为未保存 (已前置到 Step 1)
        // setDbSyncStatus('unsaved');

        // Step 3: 防抖 - 延迟同步到服务器
        if (syncTimerRef.current) {
            clearTimeout(syncTimerRef.current);
        }
        // [修复] 使用 ref 调用，避免 performSync 作为依赖项导致循环
        syncTimerRef.current = setTimeout(() => {
            // [优化] 编辑模式下延迟同步：仅保留本地 DB 写如，暂不推送到服务器
            // 避免用户打字过程中产生大量中间版本号
            if (useUIStore.getState().isEditing) {
                // console.log('[AutoSave] Edit mode active, delaying server sync');
                return;
            }
            performSyncRef.current?.(false);
        }, interval);

        // 清理函数
        return () => {
            if (syncTimerRef.current) {
                clearTimeout(syncTimerRef.current);
            }
            // [修复] 清理成功状态定时器，防止内存泄漏
            if (successTimerRef.current) {
                clearTimeout(successTimerRef.current);
            }
        };
    }, [
        // [方案A回退] 所有数据统一从 NovelContext 获取，包含 currentNovelId
        data, characters, charCats, scenes, sceneCats,
        worldSettings, settingCats, relations, chapterTemplates, charFields,
        currentNovelId, interval, setDbSyncStatus, isLoading
    ]);

    // [新增] 监听网络恢复，自动重试同步
    // [修复] 添加延迟，避免与 useWebSocket 的 online 处理竞态
    const onlineTimerRef = useRef(null);
    useEffect(() => {
        const handleOnline = () => {
            // 清除之前的定时器（防抖）
            if (onlineTimerRef.current) {
                clearTimeout(onlineTimerRef.current);
            }

            // [关键] 延迟 2 秒执行，让 WebSocket 先完成重连
            // 这样可以避免：
            // 1. 与 useWebSocket 的 online 处理竞态
            // 2. WebSocket 重连后的版本检测与本地上传冲突
            onlineTimerRef.current = setTimeout(() => {
                // console.log('[AutoSave] Network online, retrying sync after delay...');
                performSyncRef.current?.(false);
            }, 2000);
        };

        window.addEventListener('online', handleOnline);
        return () => {
            window.removeEventListener('online', handleOnline);
            if (onlineTimerRef.current) {
                clearTimeout(onlineTimerRef.current);
            }
        };
    }, []);

    // [新增] 监听退出编辑模式，立即触发因编辑而延迟的同步
    const isEditing = useUIStore(state => state.isEditing);
    const isEditingPrevRef = useRef(isEditing); // [修复] 记录上一次的值，避免初始化误触发
    useEffect(() => {
        // [修复] 只有从 true 变为 false 才视为"退出编辑模式"
        const wasEditing = isEditingPrevRef.current;
        isEditingPrevRef.current = isEditing;

        // 当从编辑模式(true)变为浏览模式(false)，且处于未保存状态时
        // 立即执行同步 (isManual=false)
        if (wasEditing && !isEditing) {
            if (dbSyncStatus === 'unsaved') {
                if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
                performSyncRef.current?.(false);
            }

            // [新增] 检查是否有挂起的远程更新（编辑期间收到但被忽略的）
            const { hasPendingRemoteUpdates, setHasPendingRemoteUpdates } = useUIStore.getState();
            if (hasPendingRemoteUpdates) {
                // [修复] 空值检查：如果没有当前选中的小说，跳过同步
                if (!currentNovelId) {
                    console.warn('[AutoSave] 无当前小说 ID，跳过挂起更新拉取');
                    setHasPendingRemoteUpdates(false);
                    return;
                }

                console.log('[AutoSave] 退出编辑模式，检测到挂起的远程更新，开始拉取...');
                import('../services/api.js').then(({ syncPullNovel }) => {
                    import('../utils/syncUtils.js').then(({ applyDeltaSync }) => {
                        import('../services/db.js').then(({ dbService }) => {
                            const nid = currentNovelId;
                            const currentVer = versionRef.current[nid] || 0;

                            // 拉取最新变化 (从当前版本開始)
                            syncPullNovel(nid, currentVer).then(async res => {
                                if (res?.code === 200 && res.data) {
                                    const localContent = await dbService.getNovelContent(nid);

                                    // 强制应用 Deltas (updateUI = true)
                                    await applyDeltaSync(nid, res.data, localContent, {}, true);

                                    // 更新版本号
                                    if (res.data.latest_version !== undefined) {
                                        versionRef.current[nid] = res.data.latest_version;
                                        localStorage.setItem('novel_versions', JSON.stringify(versionRef.current));
                                    }

                                    // 清除标记
                                    setHasPendingRemoteUpdates(false);
                                    console.log('[AutoSave] 挂起更新已应用，当前版本:', res.data.latest_version);
                                }
                            }).catch(e => console.error('[AutoSave] 挂起更新拉取失败:', e));
                        });
                    });
                });
            }
        }
    }, [isEditing, dbSyncStatus, currentNovelId]);

    // ==================== 手动触发（Ctrl+S）====================
    const triggerSave = useCallback(() => {
        // 清除现有定时器，立即同步
        if (syncTimerRef.current) {
            clearTimeout(syncTimerRef.current);
            syncTimerRef.current = null;
        }
        performSyncRef.current?.(true);
    }, []);

    // ==================== 返回值 ====================
    return {
        triggerSave,
        syncToWebDAV,  // [修复] 导出 WebDAV 手动备份函数
        lastSaved,
        // webdavSyncStatus, // [Removed] Use Store directly
        // webdavLastMsg
    };
}
