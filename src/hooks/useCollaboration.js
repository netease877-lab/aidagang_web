// ==================================================
// File: frontend/src/hooks/useCollaboration.js
// 实时协作功能 - 多设备同时编辑时的光标和输入同步
// ==================================================
import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * 检测设备类型
 */
const detectDeviceType = () => {
    const ua = navigator.userAgent;
    if (/mobile/i.test(ua) || /android/i.test(ua) || /iphone/i.test(ua)) {
        return 'mobile';
    }
    return 'desktop';
};

/**
 * 生成唯一设备 ID
 */
const getDeviceId = () => {
    let deviceId = localStorage.getItem('novel_device_id');
    if (!deviceId) {
        deviceId = `${detectDeviceType()}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('novel_device_id', deviceId);
    }
    return deviceId;
};

/**
 * 实时协作 Hook
 * @param {Object} options - 配置选项
 * @param {Function} options.sendMessage - WebSocket 发送消息函数
 * @param {Object} options.wsRef - WebSocket 引用
 * @returns {Object} 协作相关状态和方法
 */
export function useCollaboration(options = {}) {
    const { sendMessage, wsRef } = options;

    // 当前设备信息
    const deviceId = useRef(getDeviceId());
    const deviceType = useRef(detectDeviceType());

    // 远程编辑者状态 { chapterId: { deviceId, deviceType, cursor, text, lastUpdate } }
    const [remoteEditors, setRemoteEditors] = useState({});

    // 当前正在编辑的章节
    const [editingChapterId, setEditingChapterId] = useState(null);

    // 最后发送的光标位置（防止频繁发送）
    const lastSentCursor = useRef(null);
    const sendThrottleTimer = useRef(null);

    // 开始编辑某章节
    const startEditing = useCallback((chapterId) => {
        setEditingChapterId(chapterId);

        if (sendMessage) {
            sendMessage({
                type: 'collab_edit_start',
                chapterId,
                deviceId: deviceId.current,
                deviceType: deviceType.current
            });
        }
    }, [sendMessage]);

    // 停止编辑
    const stopEditing = useCallback(() => {
        if (editingChapterId && sendMessage) {
            sendMessage({
                type: 'collab_edit_end',
                chapterId: editingChapterId,
                deviceId: deviceId.current
            });
        }
        setEditingChapterId(null);
    }, [editingChapterId, sendMessage]);

    // 发送光标和输入更新（节流）
    const sendCursorUpdate = useCallback((chapterId, cursor, text) => {
        if (!sendMessage) return;

        // 节流：最多每 100ms 发送一次
        if (sendThrottleTimer.current) {
            clearTimeout(sendThrottleTimer.current);
        }

        sendThrottleTimer.current = setTimeout(() => {
            // 只有当光标位置变化时才发送
            const cursorKey = `${chapterId}_${cursor.start}_${cursor.end}`;
            if (lastSentCursor.current !== cursorKey || text !== undefined) {
                lastSentCursor.current = cursorKey;

                sendMessage({
                    type: 'collab_edit_update',
                    chapterId,
                    deviceId: deviceId.current,
                    deviceType: deviceType.current,
                    cursor,
                    // 只发送最近输入的几个字符（性能优化）
                    recentText: text?.slice(-20)
                });
            }
        }, 100);
    }, [sendMessage]);

    // 处理收到的协作消息
    const handleCollabMessage = useCallback((msg) => {
        // 忽略自己发送的消息
        if (msg.deviceId === deviceId.current) return;

        switch (msg.type) {
            case 'collab_edit_start':
                setRemoteEditors(prev => ({
                    ...prev,
                    [msg.chapterId]: {
                        deviceId: msg.deviceId,
                        deviceType: msg.deviceType,
                        cursor: null,
                        text: null,
                        lastUpdate: Date.now()
                    }
                }));
                break;

            case 'collab_edit_update':
                setRemoteEditors(prev => ({
                    ...prev,
                    [msg.chapterId]: {
                        deviceId: msg.deviceId,
                        deviceType: msg.deviceType,
                        cursor: msg.cursor,
                        text: msg.recentText,
                        lastUpdate: Date.now()
                    }
                }));
                break;

            case 'collab_edit_end':
                setRemoteEditors(prev => {
                    const next = { ...prev };
                    delete next[msg.chapterId];
                    return next;
                });
                // [新增] 清除该章节的远程内容
                setPendingRemoteContent(prev => {
                    const next = { ...prev };
                    delete next[msg.chapterId];
                    return next;
                });
                break;

            // [新增] 处理内容同步消息
            case 'collab_content_sync':
                setPendingRemoteContent(prev => ({
                    ...prev,
                    [msg.chapterId]: {
                        content: msg.content,
                        cursorPosition: msg.cursorPosition,
                        deviceType: msg.deviceType,
                        timestamp: Date.now()
                    }
                }));
                break;
        }
    }, []);

    // [新增] 存储远程同步的内容
    const [pendingRemoteContent, setPendingRemoteContent] = useState({});

    // [新增] 发送内容同步（节流 500ms）
    const contentSyncTimer = useRef(null);
    const lastSyncedContent = useRef({});

    const sendContentSync = useCallback((chapterId, content, cursorPosition) => {
        if (!sendMessage) return;

        // 节流：500ms 内只发送一次
        if (contentSyncTimer.current) {
            clearTimeout(contentSyncTimer.current);
        }

        contentSyncTimer.current = setTimeout(() => {
            // 只有内容变化时才发送
            if (lastSyncedContent.current[chapterId] !== content) {
                lastSyncedContent.current[chapterId] = content;
                sendMessage({
                    type: 'collab_content_sync',
                    chapterId,
                    content,
                    cursorPosition,
                    deviceId: deviceId.current,
                    deviceType: deviceType.current
                });
            }
        }, 500);
    }, [sendMessage]);

    // [新增] 获取远程内容
    const getRemoteContent = useCallback((chapterId) => {
        return pendingRemoteContent[chapterId] || null;
    }, [pendingRemoteContent]);

    // [新增] 清除已应用的远程内容
    const clearRemoteContent = useCallback((chapterId) => {
        setPendingRemoteContent(prev => {
            const next = { ...prev };
            delete next[chapterId];
            return next;
        });
    }, []);

    // [新增] 检查章节是否被锁定（有人在编辑）
    const isChapterLocked = useCallback((chapterId) => {
        const editor = remoteEditors[chapterId];
        if (!editor) return false;
        // 10秒内有更新就视为被锁定
        return Date.now() - editor.lastUpdate < 10000;
    }, [remoteEditors]);

    // 清理过期的远程编辑者（10秒没更新就移除）
    useEffect(() => {
        const timer = setInterval(() => {
            const now = Date.now();
            setRemoteEditors(prev => {
                const next = { ...prev };
                let changed = false;
                for (const chapterId in next) {
                    if (now - next[chapterId].lastUpdate > 10000) {
                        delete next[chapterId];
                        changed = true;
                    }
                }
                return changed ? next : prev;
            });
            // [新增] 同时清理过期的远程内容
            setPendingRemoteContent(prev => {
                const next = { ...prev };
                let changed = false;
                for (const chapterId in next) {
                    if (now - next[chapterId].timestamp > 10000) {
                        delete next[chapterId];
                        changed = true;
                    }
                }
                return changed ? next : prev;
            });
        }, 5000);

        return () => clearInterval(timer);
    }, []);

    // 获取某章节的远程编辑者
    const getRemoteEditor = useCallback((chapterId) => {
        return remoteEditors[chapterId] || null;
    }, [remoteEditors]);

    // 检查是否有远程编辑者
    const hasRemoteEditor = useCallback((chapterId) => {
        return !!remoteEditors[chapterId];
    }, [remoteEditors]);

    return {
        // 设备信息
        deviceId: deviceId.current,
        deviceType: deviceType.current,

        // 状态
        remoteEditors,
        editingChapterId,
        pendingRemoteContent,

        // 方法
        startEditing,
        stopEditing,
        sendCursorUpdate,
        sendContentSync,        // [新增]
        handleCollabMessage,
        getRemoteEditor,
        hasRemoteEditor,
        getRemoteContent,       // [新增]
        clearRemoteContent,     // [新增]
        isChapterLocked         // [新增]
    };
}

export default useCollaboration;

