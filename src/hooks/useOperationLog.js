// ==================================================
// File: frontend/src/hooks/useOperationLog.js
// 操作日志 Hook - 记录用户编辑操作到 localStorage
// ==================================================
import { useState, useCallback, useEffect, useRef } from 'react';

const MAX_LOG_ENTRIES = 100;
const STORAGE_KEY = 'novel_operation_logs';

/**
 * 操作日志 Hook
 * @param {string} novelId - 当前小说 ID
 * @returns {Object} 日志操作方法
 */
export const useOperationLog = (novelId) => {
    const [logs, setLogs] = useState([]);

    // [修复] 使用 ref 跟踪最新值，避免闭包问题
    const logsRef = useRef(logs);
    const novelIdRef = useRef(novelId);

    useEffect(() => {
        logsRef.current = logs;
    }, [logs]);

    useEffect(() => {
        novelIdRef.current = novelId;
    }, [novelId]);

    // 加载日志
    useEffect(() => {
        if (!novelId) return;

        try {
            const stored = localStorage.getItem(`${STORAGE_KEY}_${novelId}`);
            if (stored) {
                setLogs(JSON.parse(stored));
            } else {
                setLogs([]);
            }
        } catch (e) {
            setLogs([]);
        }
    }, [novelId]);

    // 保存日志到 localStorage
    const saveLogs = useCallback((newLogs) => {
        const currentNovelId = novelIdRef.current;
        if (!currentNovelId) return;

        try {
            // 只保留最新的 100 条
            const trimmed = newLogs.slice(-MAX_LOG_ENTRIES);
            localStorage.setItem(`${STORAGE_KEY}_${currentNovelId}`, JSON.stringify(trimmed));
            setLogs(trimmed);
        } catch (e) {
        }
    }, []);

    /**
     * 添加日志条目
     * @param {string} type - 操作类型: 'create' | 'update' | 'delete' | 'move' | 'sync'
     * @param {string} target - 操作目标，如 "章节: 第一章"
     * @param {string} detail - 操作详情
     */
    const addLog = useCallback((type, target, detail = '') => {
        const entry = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
            timestamp: Date.now(),
            type,
            target,
            detail
        };

        // [修复] 使用 ref 获取最新的 logs
        const currentLogs = logsRef.current;
        const newLogs = [...currentLogs, entry];
        saveLogs(newLogs);

        return entry;
    }, [saveLogs]);

    /**
     * 记录节点创建
     */
    const logCreate = useCallback((nodeType, nodeName) => {
        // [修复] 直接显示完整路径 + 操作，如“第二卷 下新建”
        return addLog('create', nodeName || '未命名', '新建');
    }, [addLog]);

    /**
     * 记录节点更新
     */
    const logUpdate = useCallback((nodeType, nodeName, field) => {
        // [修复] 直接显示完整路径，不加类型前缀
        return addLog('update', `${nodeName || '未命名'} ${field || '内容更新'}`, '编辑');
    }, [addLog]);

    /**
     * 记录节点删除
     */
    const logDelete = useCallback((nodeType, nodeName) => {
        // [修复] 直接显示“第二卷 第一章 被删除”
        return addLog('delete', nodeName || '未命名', '删除');
    }, [addLog]);

    /**
     * 记录节点移动
     */
    const logMove = useCallback((nodeType, nodeName, from, to) => {
        // [修复] 直接显示路径
        return addLog('move', `${nodeName || '未命名'} 从 ${from} 移动到 ${to}`, '移动');
    }, [addLog]);

    /**
     * [新增] 记录重命名
     */
    const logRename = useCallback((nodeType, oldName, newName) => {
        // [修复] 直接显示“旧名 -> 新名”，不加类型前缀
        return addLog('update', `${oldName || '未命名'} -> ${newName || '未命名'}`, '重命名');
    }, [addLog]);

    /**
     * 记录同步操作
     */
    const logSync = useCallback((action, result) => {
        return addLog('sync', action, result);
    }, [addLog]);

    /**
     * 清空日志
     */
    const clearLogs = useCallback(() => {
        if (!novelId) return;
        localStorage.removeItem(`${STORAGE_KEY}_${novelId}`);
        setLogs([]);
    }, [novelId]);

    /**
     * 获取格式化的日志列表
     */
    const getFormattedLogs = useCallback(() => {
        return logs.map(log => ({
            ...log,
            formattedTime: new Date(log.timestamp).toLocaleString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }),
            typeIcon: {
                'create': '➕',
                'update': '✏️',
                'delete': '🗑️',
                'move': '↔️',
                'sync': '🔄'
            }[log.type] || '📝',
            typeLabel: {
                'create': '新建',
                'update': '编辑',
                'delete': '删除',
                'move': '移动',
                'sync': '同步'
            }[log.type] || '操作'
        })).reverse(); // 最新的在前
    }, [logs]);

    return {
        logs,
        addLog,
        logCreate,
        logUpdate,
        logRename, // [New]
        logDelete,
        logMove,
        logSync,
        clearLogs,
        getFormattedLogs,
        logCount: logs.length
    };
};

export default useOperationLog;
