// src/hooks/useNovelSync.js
import { useCallback } from 'react';
import { useNovel } from '../contexts';
import { fetchAPI } from '../services/api';
import { mergeList } from '../utils/novelUtils'; // [新增]
import {
    INITIAL_CHAR_CATS, INITIAL_SCENE_CATS, INITIAL_SETTING_CATS,
    CLEAN_DATA_TEMPLATE, DEFAULT_CHAPTER_TEMPLATES, DEFAULT_CHAR_FIELDS
} from '../constants';
import { dbService } from '../services/db';
import { useEntityStore } from '../stores/entityStore'; // [修复] 引入 Store

/**
 * 将原来 App.jsx 中的 syncNovelsFromDB 逻辑抽离为 Hook。
 * 该 Hook 返回一个同步函数，供组件在需要时调用。
 * 

 */
export function useNovelSync() {
    const {
        currentNovelId,
        setNovels,
        setCurrentNovelId,
        // setData, setCharacters... removed (using entityStore)
        setDbSyncStatus,
        serverTimestampRef,
        versionRef,
        getStorageKey,
        isAuthenticated,
        setIsConfigLoading,

        currentNovelIdRef,
        lastSnapshotRef,
        createEmptyNovel,
    } = useNovel();

    const sync = useCallback(async () => {
        try {
            // 1. 获取服务器列表
            const res = await fetchAPI('/api/novel/list');
            if (!res || !Array.isArray(res.data)) return;
            const dbNovels = res.data;

            // 以服务器数据为准
            const serverNovels = dbNovels || [];

            // [逻辑还原] 如果服务器列表为空，自动触发"新建小说"功能
            // createEmptyNovel 在 NovelContext 内部已有并发锁，无需额外处理
            if (serverNovels.length === 0) {
                await createEmptyNovel(true, true); // isReset=true, silent=true
                return;
            }

            // 仅更新列表
            setNovels(serverNovels);
            localStorage.setItem(getStorageKey('index'), JSON.stringify(serverNovels));

            // 检查当前选中小说是否存在
            const lastId = localStorage.getItem(getStorageKey('last_active'));
            // 修正：newIndex 变量名之前未定义，这里应该是 serverNovels
            const targetId = serverNovels.find(n => n.id === lastId) ? lastId : (serverNovels[0] ? serverNovels[0].id : null);

            if (targetId && targetId !== currentNovelId) {
                // 如果当前选中的 ID 不在列表里，切换到第一个有效的
                // 或者如果是初次加载，设置 ID
                // 这里的逻辑主要交给后面的 if (targetId && !currentNovelId) 处理
            }

            if (targetId && !currentNovelId) {
                setCurrentNovelId(targetId);
            }

            setDbSyncStatus('idle');

            // Dirty Check & Conflict Resolution
            // 只针对 Server 这一侧存在的书进行检查
            const dirtyNovelIds = dbNovels
                .filter(n => localStorage.getItem(`novel_dirty_${n.id}`) === 'true')
                .map(n => n.id);

            if (dirtyNovelIds.length > 0) {
                const { syncPullNovel } = await import('../services/api.js');
                const detailsPromises = dirtyNovelIds.map(id => syncPullNovel(id, 0).catch(() => null));
                const detailsResults = await Promise.all(detailsPromises);
                const { compareOutlineNodes, compareListItems, parseSnapshotResponse, loadLocalNovelData } = await import('../utils/syncUtils.js');
                const allConflicts = [];
                for (let i = 0; i < dirtyNovelIds.length; i++) {
                    const novelId = dirtyNovelIds[i];
                    const serverRes = detailsResults[i];
                    if (!serverRes || !serverRes.data?.is_snapshot) continue;

                    // [修复] loadLocalNovelData 是异步的
                    const local = await loadLocalNovelData(novelId); // 注意: loadLocalNovelData 期望 novelId 而非 key
                    // Wait, syncUtils export says: loadLocalNovelData(novelId). It calls dbService.getNovelContent(novelId).
                    // Original code passed getStorageKey? "novel_id_"?
                    // dbService.getNovelContent expects novelId. getStorageKey returns prefix+novelId?
                    // Let's assume novelId is clearer.

                    if (!local) continue;

                    const snapshot = parseSnapshotResponse(serverRes.data);
                    const server = {
                        ...snapshot,
                        chars: snapshot.characters,
                        world: snapshot.worldSettings
                    };

                    const novelTitle = dbNovels.find(n => n.id === novelId)?.title || '未知';
                    allConflicts.push(...compareOutlineNodes(local.data, server.data, novelTitle));
                    allConflicts.push(...compareListItems(local.chars, server.chars, novelTitle, 'character'));
                    allConflicts.push(...compareListItems(local.scenes, server.scenes, novelTitle, 'scene'));
                    allConflicts.push(...compareListItems(local.world, server.world, novelTitle, 'setting'));
                }
                if (allConflicts.length > 0) {
                    return { conflicts: allConflicts, dirtyNovelIds };
                } else {
                    dirtyNovelIds.forEach(id => localStorage.removeItem(`novel_dirty_${id}`));
                }
            }

            // Check if current target is dirty
            if (!targetId) return;

            const isDirty = localStorage.getItem(`novel_dirty_${targetId}`) === 'true';

            // [重构] 基于版本号判定，移除时间戳逻辑
            const targetNovel = dbNovels.find(n => n.id === targetId);
            const serverVersion = targetNovel?.version || 0;
            const localVersion = versionRef.current[targetId] || 0;

            let shouldFetch = false;

            // 判定拉取条件（基于版本号）
            // 1. 本地没有数据 → 必须拉取
            // 2. 服务器版本 > 本地版本 → 拉取（其他设备同步过来的新数据）
            // 3. 本地有未同步的修改（isDirty 或 localVersion >= serverVersion）→ 保留本地，稍后触发同步
            const { dbService } = await import('../services/db.js');
            const localContent = await dbService.getNovelContent(targetId);
            const hasLocalContent = !!(localContent && localContent.data && localContent.data.length > 0);


            if (!hasLocalContent) {
                // 本地没有数据，必须从服务器拉取
                shouldFetch = true;
            } else {
                // [关键修复] 本地有数据时，必须校验版本号，不能盲目信任本地缓存
                const localVer = localContent.version || 0;
                const serverVer = serverVersion; // 来自 /api/novel/list 的响应

                if (serverVer > localVer) {
                    // 服务器版本更新（其他设备同步过来的新数据），必须拉取
                    shouldFetch = true;
                } else if (isDirty) {
                    // 本地有未同步的修改，保留本地，稍后触发同步
                    shouldFetch = false;
                    setDbSyncStatus('unsaved');
                } else {
                    // 本地版本 >= 服务器版本，使用本地缓存
                    shouldFetch = false;
                    setDbSyncStatus('synced');
                }
            }

            let parsedContent = null;

            if (shouldFetch) {
                // [重构] 使用增量拉取替代全量 /details
                const { syncPullNovel } = await import('../services/api.js');
                const { applyDeltaSync } = await import('../utils/syncUtils.js');

                // 使用本地版本号，0 表示首次拉取（返回全量快照）
                const res = await syncPullNovel(targetId, localVersion);

                if (res?.code === 200 && res?.data) {
                    // 获取本地数据（可能为空）
                    const { dbService } = await import('../services/db.js');
                    const localContent = await dbService.getNovelContent(targetId);

                    // 应用增量同步（或全量快照）
                    const result = await applyDeltaSync(targetId, res.data, localContent, {});

                    if (result.success) {
                        parsedContent = {
                            data: result.merged?.data || [],
                            chars: result.merged?.characters || [],
                            charCats: result.merged?.charCats || [],
                            scenes: result.merged?.scenes || [],
                            sceneCats: result.merged?.sceneCats || [],
                            world: result.merged?.worldSettings || [],
                            setCats: result.merged?.settingCats || [],
                            templates: result.merged?.chapterTemplates || [],
                            charFields: result.merged?.charFields || [],
                            version: res.data.latest_version
                        };
                        // 更新版本号
                        versionRef.current[targetId] = res.data.latest_version;
                        localStorage.setItem('novel_versions', JSON.stringify(versionRef.current));
                    }
                }
            } else {
                // Cache Path - 直接使用已经读取的 localContent，无需再次读取
                if (hasLocalContent) {
                    // [修复] 将 localContent 转换为 parsedContent 格式
                    parsedContent = {
                        data: localContent.data || [],
                        chars: localContent.characters || [],
                        charCats: localContent.charCats || [],
                        scenes: localContent.scenes || [],
                        sceneCats: localContent.sceneCats || [],
                        world: localContent.worldSettings || [],
                        setCats: localContent.settingCats || [],
                        templates: localContent.chapterTemplates || [],
                        charFields: localContent.charFields || [],
                        version: localContent.version // [修复] 恢复版本号
                    };
                    // [关键修复] 加载本地缓存时，必须同步更新内存中的 versionRef，否则会导致版本冲突
                    if (localContent.version) {
                        versionRef.current[targetId] = localContent.version;
                    }
                } else if (targetNovel) {
                    // [重构] Cache empty, 使用增量拉取 (base_version=0 返回全量快照)
                    const { syncPullNovel } = await import('../services/api.js');
                    const { applyDeltaSync } = await import('../utils/syncUtils.js');

                    const res = await syncPullNovel(targetId, 0); // base_version=0 → 全量
                    if (res?.code === 200 && res?.data) {
                        const result = await applyDeltaSync(targetId, res.data, null, {});
                        if (result.success) {
                            parsedContent = {
                                data: result.merged?.data || [],
                                chars: result.merged?.characters || [],
                                charCats: result.merged?.charCats || [],
                                scenes: result.merged?.scenes || [],
                                sceneCats: result.merged?.sceneCats || [],
                                world: result.merged?.worldSettings || [],
                                setCats: result.merged?.settingCats || [],
                                templates: result.merged?.chapterTemplates || [],
                                charFields: result.merged?.charFields || [],
                                version: res.data.latest_version
                            };
                            versionRef.current[targetId] = res.data.latest_version;
                            localStorage.setItem('novel_versions', JSON.stringify(versionRef.current));
                        }
                    }
                }
            }

            // Unified State Update
            if (parsedContent && (targetId === currentNovelIdRef.current || !currentNovelIdRef.current)) {

                // 直接使用服务器返回的数据，后端会确保有默认卷

                // [Refactor] Single Source of Truth: Sync to Zustand Store ONLY
                // We no longer call setData/setCharacters on Context.
                useEntityStore.getState().syncFromNovel({
                    data: parsedContent.data || [],
                    characters: parsedContent.chars || [],
                    scenes: parsedContent.scenes || [],
                    worldSettings: parsedContent.world || [],
                    charCats: parsedContent.charCats || [],
                    sceneCats: parsedContent.sceneCats || [],
                    settingCats: parsedContent.setCats || [],
                    relations: parsedContent.relations || [],
                    chapterTemplates: parsedContent.templates || [],
                    charFields: parsedContent.charFields || []
                });

                // [关键修复] 同步到 Zustand Store，防止 UI 显示旧数据
                // [Moved syncFromNovel above]
                // [优化] 移除从小说数据覆盖模版的逻辑，始终优先使用 User Config 中的全局/用户模版
                // if (parsedContent.templates) setChapterTemplates(parsedContent.templates);
                // if (parsedContent.charFields) setCharFields(parsedContent.charFields);

                // [关键修复] Snapshot 初始化逻辑：
                // - 从服务器拉取 (shouldFetch=true)：设置 Snapshot = 服务器数据
                // - 从本地缓存 (shouldFetch=false)：不设置 Snapshot → AutoSave 会检测到变化并同步
                if (lastSnapshotRef && shouldFetch) {
                    const { createSnapshot } = await import('../utils/syncUtils.js');
                    const snapshotState = {
                        data: parsedContent.data,
                        characters: parsedContent.chars || [],
                        charCats: parsedContent.charCats || [],
                        scenes: parsedContent.scenes || [],
                        sceneCats: parsedContent.sceneCats || [],
                        worldSettings: parsedContent.world || [],
                        settingCats: parsedContent.setCats || []
                    };
                    lastSnapshotRef.current = createSnapshot(snapshotState);
                } else if (!shouldFetch && parsedContent) {
                    // [修复] Local-First 模式下也必须初始化 Snapshot，否则 AutoSave 无法工作
                    const { createSnapshot } = await import('../utils/syncUtils.js');
                    const snapshotState = {
                        data: parsedContent.data,
                        characters: parsedContent.chars || [],
                        charCats: parsedContent.charCats || [],
                        scenes: parsedContent.scenes || [],
                        sceneCats: parsedContent.sceneCats || [],
                        worldSettings: parsedContent.world || [],
                        settingCats: parsedContent.setCats || []
                    };
                    lastSnapshotRef.current = createSnapshot(snapshotState);
                }
            }
        } catch (e) {
            console.error('Sync error', e);
        }
    }, [
        currentNovelId,
        setNovels,
        setCurrentNovelId,
        // Removed setters (setData etc)
        setDbSyncStatus,
        serverTimestampRef,
        versionRef,
        getStorageKey,
        isAuthenticated,

        createEmptyNovel
    ]);

    return { sync };
}
