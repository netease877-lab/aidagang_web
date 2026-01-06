/**
 * useConflictResolution - 数据冲突处理 Hook
 * [重构] 从 NovelContext 抽离冲突处理逻辑
 */
import { useState, useCallback, useRef } from 'react';
// import { fetchAPI } from '../services/api'; // Removed unused import
import { dbService } from '../services/db';
import { createSnapshot } from '../utils/syncUtils';

/**
 * 冲突处理 Hook
 * @param {Object} options - 配置项
 * @param {Function} options.showToast - 提示函数
 * @param {Function} options.getCurrentNovelId - 获取当前小说ID
 * @param {Function} options.getLocalData - 获取本地数据 { data, characters, scenes, worldSettings, ... }
 * @param {Function} options.setAllData - 设置所有数据的函数
 * @returns {Object} 冲突处理状态和方法
 */
export function useConflictResolution(options) {
    const {
        showToast,
        getCurrentNovelId,
        getLocalData,
        setAllData,
        versionRef,
        lastSnapshotRef,
    } = options;

    // 冲突对话框状态
    const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
    const [conflictData, setConflictData] = useState({});

    // 辅助函数：在节点树中更新节点
    const updateNodeInTree = useCallback((nodes, targetId, updates) => {
        return nodes.map(node => {
            if (node.id === targetId) {
                return { ...node, ...updates };
            }
            if (node.children) {
                return { ...node, children: updateNodeInTree(node.children, targetId, updates) };
            }
            return node;
        });
    }, []);

    // 辅助函数：查找本地节点
    const findLocalNode = useCallback((nodes, id) => {
        for (const node of nodes) {
            if (node.id === id) return node;
            if (node.children) {
                const found = findLocalNode(node.children, id);
                if (found) return found;
            }
        }
        return null;
    }, []);

    // 处理冲突合并
    const handleMergeConflict = useCallback(async (selections) => {
        const novelId = getCurrentNovelId();
        if (!novelId) return;


        try {
            // 1. 获取服务器最新全量数据
            // 1. 获取服务器最新全量数据 (增量接口全量模式)
            const { syncPullNovel } = await import('../services/api.js');
            const res = await syncPullNovel(novelId, 0); // Force snapshot

            if (!res || !res.data || !res.data.is_snapshot) {
                showToast('合并失败：无法获取服务器数据', 'error');
                return;
            }

            // 更新本地记录的服务器版本
            if (res.data.latest_version && versionRef) {
                versionRef.current[novelId] = res.data.latest_version;
                localStorage.setItem('novel_versions', JSON.stringify(versionRef.current));
            }

            // 解析服务器数据
            const { parseSnapshotResponse } = await import('../utils/syncUtils.js');
            const sContent = parseSnapshotResponse(res.data);
            const localData = getLocalData();

            // 2. 初始化合并基准（默认为服务器数据）
            let newNodes = sContent.data || [];
            let newChars = Array.isArray(sContent.characters)
                ? sContent.characters
                : (sContent.characters?.items || []);
            let newScenes = Array.isArray(sContent.scenes)
                ? sContent.scenes
                : (sContent.scenes?.items || []);
            let newSettings = Array.isArray(sContent.world_settings)
                ? sContent.world_settings
                : (sContent.world_settings?.items || []);

            // 3. 应用用户选择的"Local"版本
            Object.entries(selections).forEach(([id, choice]) => {
                if (choice !== 'local') return;

                const conflict = conflictData.conflicts?.find(c => c.id === id);
                if (!conflict) return;

                if (conflict.type === 'outline_node') {
                    const localNode = findLocalNode(localData.data || [], id);
                    if (localNode) {
                        newNodes = updateNodeInTree(newNodes, id, {
                            title: localNode.title,
                            content: localNode.content,
                            isExpanded: localNode.isExpanded
                        });
                    }
                } else if (conflict.type === 'character') {
                    const local = localData.characters?.find(c => c.id === id);
                    if (local) {
                        const idx = newChars.findIndex(c => c.id === id);
                        if (idx >= 0) newChars[idx] = local;
                        else newChars.push(local);
                    }
                } else if (conflict.type === 'scene') {
                    const local = localData.scenes?.find(c => c.id === id);
                    if (local) {
                        const idx = newScenes.findIndex(c => c.id === id);
                        if (idx >= 0) newScenes[idx] = local;
                        else newScenes.push(local);
                    }
                } else if (conflict.type === 'setting') {
                    const local = localData.worldSettings?.find(c => c.id === id);
                    if (local) {
                        const idx = newSettings.findIndex(c => c.id === id);
                        if (idx >= 0) newSettings[idx] = local;
                        else newSettings.push(local);
                    }
                }
            });

            // 4. 构造最终数据包并更新状态
            const mergedState = {
                data: newNodes,
                characters: newChars,
                charCats: sContent.char_cats || [],
                scenes: newScenes,
                sceneCats: sContent.scene_cats || [],
                worldSettings: newSettings,
                settingCats: sContent.setting_cats || [],
                chapterTemplates: sContent.chapter_templates || [],
                charFields: sContent.char_fields || [],
                relations: sContent.relations || [],
            };

            // 5. 更新所有状态
            setAllData(mergedState);

            // 6. 持久化并更新快照
            await dbService.saveNovelContent(novelId, mergedState);
            if (lastSnapshotRef) {
                lastSnapshotRef.current = createSnapshot(mergedState);
            }

            // 7. 关闭对话框
            setConflictDialogOpen(false);
            setConflictData({});
            showToast('合并完成', 'success');

        } catch (e) {
            console.error('[ConflictResolution] Merge error:', e);
            showToast('合并失败: ' + e.message, 'error');
        }
    }, [
        getCurrentNovelId, getLocalData, setAllData, showToast,
        conflictData, findLocalNode, updateNodeInTree,
        versionRef, lastSnapshotRef
    ]);

    // 显示冲突对话框
    const showConflictDialog = useCallback((conflicts) => {
        setConflictData({ conflicts });
        setConflictDialogOpen(true);
    }, []);

    // 关闭冲突对话框
    const closeConflictDialog = useCallback(() => {
        setConflictDialogOpen(false);
        setConflictData({});
    }, []);

    return {
        // 状态
        conflictDialogOpen,
        conflictData,

        // 方法
        handleMergeConflict,
        showConflictDialog,
        closeConflictDialog,
        setConflictDialogOpen,
        setConflictData,
    };
}

export default useConflictResolution;
