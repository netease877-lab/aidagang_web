// ==================================================
// useSyncWorker.js - Web Worker 封装 Hook
// 提供简洁的 API 调用后台 Worker 进行 CPU 密集型计算
// ==================================================
import { useRef, useCallback, useEffect } from 'react';

/**
 * 同步 Worker Hook
 * 将 CPU 密集型的深拷贝和 Diff 计算移至后台线程
 */
export function useSyncWorker() {
    const workerRef = useRef(null);
    const pendingCallsRef = useRef(new Map());
    const callIdRef = useRef(0);

    // 初始化 Worker
    useEffect(() => {
        try {
            workerRef.current = new Worker(
                new URL('../workers/sync.worker.js', import.meta.url),
                { type: 'module' }
            );

            workerRef.current.onmessage = (e) => {
                const { id, type, result, error } = e.data;
                const pending = pendingCallsRef.current.get(id);
                if (pending) {
                    if (error) {
                        pending.reject(new Error(error));
                    } else {
                        pending.resolve(result);
                    }
                    pendingCallsRef.current.delete(id);
                }
            };

            workerRef.current.onerror = (e) => {
                console.error('[SyncWorker] Error:', e);
            };
        } catch (err) {
        }

        return () => {
            if (workerRef.current) {
                workerRef.current.terminate();
            }
        };
    }, []);

    /**
     * 向 Worker 发送消息并等待响应
     */
    const postMessage = useCallback((type, payload) => {
        return new Promise((resolve, reject) => {
            const id = ++callIdRef.current;

            if (!workerRef.current) {
                // Worker 不可用时的降级处理
                reject(new Error('Worker not available'));
                return;
            }

            pendingCallsRef.current.set(id, { resolve, reject });
            workerRef.current.postMessage({ type, payload, id });

            // 超时处理（30秒）
            setTimeout(() => {
                if (pendingCallsRef.current.has(id)) {
                    pendingCallsRef.current.delete(id);
                    reject(new Error('Worker timeout'));
                }
            }, 30000);
        });
    }, []);

    /**
     * 创建状态快照（深拷贝）
     */
    const createSnapshot = useCallback(async (state) => {
        try {
            return await postMessage('CREATE_SNAPSHOT', { state });
        } catch {
            // 降级：主线程执行
            return JSON.parse(JSON.stringify({
                data: state.data || [],
                characters: state.characters || [],
                scenes: state.scenes || [],
                worldSettings: state.worldSettings || [],
                charCats: state.charCats || [],
                sceneCats: state.sceneCats || [],
                settingCats: state.settingCats || [],
                relations: state.relations || []
            }));
        }
    }, [postMessage]);

    /**
     * 计算同步 Payload
     */
    const computeSyncPayload = useCallback(async (oldSnapshot, newSnapshot, baseVersion, chapters = []) => {
        try {
            return await postMessage('COMPUTE_SYNC_PAYLOAD', {
                oldSnapshot,
                newSnapshot,
                baseVersion,
                chapters
            });
        } catch {
            // 降级：返回空结果（跳过本次同步）
            return { payload: {}, isEmpty: true };
        }
    }, [postMessage]);

    /**
     * 检查 Worker 是否可用
     */
    const isWorkerAvailable = useCallback(() => {
        return !!workerRef.current;
    }, []);

    return {
        createSnapshot,
        computeSyncPayload,
        isWorkerAvailable
    };
}

export default useSyncWorker;
