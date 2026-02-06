/**
 * WebSocket Store - 网络连接状态管理
 * [新增] 专门用于管理 WebSocket 连接状态、延迟等网络指标
 */
import { create } from 'zustand';

export const useWsStore = create((set) => ({
    // 状态：'disconnected' | 'connecting' | 'connected'
    status: 'disconnected',

    // WebDAV 状态：'idle' | 'syncing' | 'success' | 'error'
    webdavStatus: 'idle',
    webdavLastMsg: '',

    // 扩展性：未来可以放延迟数据
    latency: 0,

    // WebDAV 状态 (既然是网络状态，也许适合放这里，但目前保持现状，只关注 WS)

    // Actions
    setStatus: (status) => set({ status }),
    setWebdavStatus: (status, msg = '') => set({ webdavStatus: status, webdavLastMsg: msg }),
    setLatency: (latency) => set({ latency }),
}));
