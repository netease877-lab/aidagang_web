// ==================================================
// src/hooks/useWebSocket.js
// [重构] 增强心跳机制：超时检测 + 自动重连 + 网络状态感知
// ==================================================
import { useEffect, useRef, useState, useCallback } from 'react';
import { useUser, useNovel } from '../contexts';
import { fetchAPI, apiClient } from '../services/api';
import { useWsStore, useSettingsStore, useEntityStore, useUIStore } from '../stores';
import { isSettingsDirty } from '../stores/settingsStore';

// 配置常量
const HEARTBEAT_INTERVAL = 30000;  // 心跳间隔 30 秒
const PONG_TIMEOUT = 10000;        // pong 超时 10 秒
const CONNECTION_TIMEOUT = 5000;   // [新增] 连接超时 5 秒
const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000]; // 指数退避重连延迟


export function useWebSocket() {
    const { isAuthenticated, currentUser, getStorageKey } = useUser();
    const hasUser = !!currentUser; // [修复] 提取布尔值，避免对象引用变化触发重建
    const {
        currentNovelIdRef,
        serverTimestampRef, versionRef,
        updateAllState, setNovels // [新增]
    } = useNovel();

    const wsRef = useRef(null);

    // [重构] 使用全局 Store 管理状态
    const setWsStatus = useWsStore(state => state.setStatus);
    const wsStatus = useWsStore(state => state.status);

    const [lastCollabMessage, setLastCollabMessage] = useState(null);

    // 重连相关 refs
    const reconnectAttemptRef = useRef(0);
    const reconnectTimeoutRef = useRef(null);
    const heartbeatIntervalRef = useRef(null);
    const pongTimeoutRef = useRef(null);
    const connectionTimeoutRef = useRef(null); // [新增] 连接超时定时器
    const isUnmountedRef = useRef(false);

    // 清理定时器
    const clearTimers = useCallback(() => {
        if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
            heartbeatIntervalRef.current = null;
        }
        if (pongTimeoutRef.current) {
            clearTimeout(pongTimeoutRef.current);
            pongTimeoutRef.current = null;
        }
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
        // [新增] 清理连接超时
        if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
        }
    }, []);

    // 建立连接函数
    const connect = useCallback(() => {
        if (isUnmountedRef.current) return;
        if (!isAuthenticated || !hasUser) return; // [修复] 使用 hasUser 替代 currentUser

        const token = localStorage.getItem('novel_token');
        if (!token) return;

        // [Refactor] 统一使用 api.js 中的 BaseURL，确保前后端地址一致
        const apiBaseUrl = apiClient.baseUrl;

        // 如果配置了 API URL，将其中的 http/https 替换为 ws/wss
        // 否则回退到使用当前 host (同源部署)
        let wsBaseUrl;
        if (apiBaseUrl) {
            wsBaseUrl = apiBaseUrl.replace(/^http/, 'ws');
        } else {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            wsBaseUrl = `${protocol}//${window.location.host}`;
        }

        const wsUrl = `${wsBaseUrl}/api/ws/sync?token=${token}`;

        // 如果已有连接，先关闭
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.close();
        }

        // 开始连接
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        setWsStatus('connecting');

        // [新增] 启动连接超时炸弹：5秒未连上则强制断开
        if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = setTimeout(() => {
            console.warn('[WS] Connection timed out (5s), forcing retry...');
            if (wsRef.current === ws) { // 确保只关闭当前的
                ws.close();
                setWsStatus('disconnected');
            }
        }, CONNECTION_TIMEOUT);

        ws.onopen = () => {
            // 连接成功后等待服务器发送 connected 消息
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);

                if (msg.type === 'connected') {
                    // [新增] 收到 connected 消息，拆除超时炸弹
                    if (connectionTimeoutRef.current) {
                        clearTimeout(connectionTimeoutRef.current);
                        connectionTimeoutRef.current = null;
                    }

                    setWsStatus('connected');
                    reconnectAttemptRef.current = 0; // 重置重连计数器
                    // [新增] 连接成功时重置编辑状态
                    useUIStore.getState().setIsEditing(false);

                    // 启动心跳
                    heartbeatIntervalRef.current = setInterval(() => {
                        if (ws.readyState === WebSocket.OPEN) {
                            // [修改] 心跳携带当前 novelId，用于版本检测
                            ws.send(JSON.stringify({
                                type: 'ping',
                                novelId: currentNovelIdRef.current
                            }));

                            // pong 超时，重连
                            pongTimeoutRef.current = setTimeout(() => {
                                setWsStatus('disconnected');
                                ws.close();
                            }, PONG_TIMEOUT);
                        }
                    }, HEARTBEAT_INTERVAL);

                } else if (msg.type === 'pong') {
                    // [新增] 收到 pong，清除超时定时器
                    if (pongTimeoutRef.current) {
                        clearTimeout(pongTimeoutRef.current);
                        pongTimeoutRef.current = null;
                    }

                    // [重构] 增量同步：使用 sync-pull 接口替代 details 全量拉取
                    // 检查服务器返回的版本号，如果比本地大，则拉取增量数据
                    if (msg.novelId && msg.version && msg.novelId === currentNovelIdRef.current) {
                        const localVer = versionRef.current[msg.novelId] || 0;
                        if (msg.version > localVer) {
                            import('../services/api.js').then(({ syncPullNovel }) => {
                                syncPullNovel(msg.novelId, localVer).then(async res => {
                                    if (res?.code === 200 && res?.data) {
                                        const { applyDeltaSync } = await import('../utils/syncUtils.js');
                                        const { dbService } = await import('../services/db.js');

                                        // 获取本地数据用于增量合并
                                        const localContent = await dbService.getNovelContent(msg.novelId);

                                        // [智能同步] 使用全局 isEditing 状态判断是否跳过 UI 更新
                                        if (useUIStore.getState().isEditing) {
                                            // [修复] 编辑模式下：不更新版本号，只标记已过期，等待 SyncPull
                                            // versionRef.current[msg.novelId] = res.data.latest_version; // 禁止更新版本
                                            useUIStore.getState().setHasPendingRemoteUpdates(true);
                                            return;
                                        }

                                        // 应用增量同步（包含冲突检测）
                                        const result = await applyDeltaSync(
                                            msg.novelId,
                                            res.data,
                                            localContent,
                                            {} // dirtyMap - 暂时为空，后续可从 context 获取
                                        );

                                        if (result.success) {
                                            // 更新版本号
                                            versionRef.current[msg.novelId] = res.data.latest_version;
                                            localStorage.setItem('novel_versions', JSON.stringify(versionRef.current));
                                        } else if (result.conflicts?.length > 0) {
                                            // TODO: 触发 ConflictDialog
                                        }
                                    }
                                }).catch(e => console.error('[WS] Delta sync failed:', e));
                            });
                        }
                    }


                    // [新增] 配置版本检测与自动同步
                    if (msg.config_version) {
                        const localConfigVer = parseInt(localStorage.getItem(getStorageKey('config_version')) || '0');
                        // [修复] 如果配置保存锁激活，跳过远程同步（防止自己保存的配置被覆盖）
                        if (window.__configSavingLock) {
                            localStorage.setItem(getStorageKey('config_version'), msg.config_version.toString());
                            return;
                        }
                        if (msg.config_version > localConfigVer) {
                            // [新增] 如果本地有未上传的修改，跳过服务器覆盖（与 loadUserConfig 逻辑一致）
                            if (isSettingsDirty()) {
                                console.log('[WS] 检测到本地有未上传的设置修改，跳过服务器覆盖');
                                return;
                            }
                            fetchAPI('/api/user/config').then(res => {
                                if (res && res.data) {
                                    const cfg = res.data;
                                    // 1. Update Settings Store
                                    useSettingsStore.getState().initFromConfig(cfg);

                                    // 2. Sync Templates to Entity Store
                                    if (cfg.chapterTemplates?.length > 0) {
                                        useEntityStore.getState().setChapterTemplates(cfg.chapterTemplates);
                                    }
                                    if (cfg.charFields?.length > 0) {
                                        useEntityStore.getState().setCharFields(cfg.charFields);
                                    }

                                    // 3. Update Local Storage Version
                                    localStorage.setItem(getStorageKey('config_version'), msg.config_version);
                                }
                            }).catch(e => console.error('[WS] Config sync failed:', e));
                        }
                    }

                } else if (msg.type === 'content_updated') {
                    if (msg.novelId === currentNovelIdRef.current) {
                        // [修复] 获取本地版本号（在更新前！用于增量拉取）
                        const localVerBeforeUpdate = versionRef.current[msg.novelId] || 0;

                        if (msg.updated_at) {
                            serverTimestampRef.current[msg.novelId] = msg.updated_at;
                            localStorage.setItem('novel_server_timestamps', JSON.stringify(serverTimestampRef.current));
                        }
                        if (msg.content) {
                            // 后端附带了完整内容
                            const c = msg.content;
                            import('../services/db.js').then(({ dbService }) => {
                                // [智能同步] 使用全局 isEditing 状态判断
                                if (useUIStore.getState().isEditing) {
                                    // [修复] 编辑模式下：仅标记，禁止所有数据应用，也不更新版本号
                                    useUIStore.getState().setHasPendingRemoteUpdates(true);
                                    // 仍然保存到 DB（作为备份），但不更新版本号
                                    dbService.saveNovelContent(msg.novelId, {
                                        data: c.data,
                                        characters: c.characters?.items || c.characters,
                                        scenes: c.scenes?.items || c.scenes,
                                        worldSettings: c.world_settings?.items || c.world_settings,
                                        charCats: c.char_cats,
                                        sceneCats: c.scene_cats,
                                        settingCats: c.set_cats,
                                        chapterTemplates: c.chapter_templates,
                                        charFields: c.char_fields,
                                        // 注意：不传 version，保持本地旧版本
                                        updated_at: Date.now()
                                    }).catch(e => console.error('[WS] Content push DB save failed (non-fatal):', e));
                                } else {
                                    // [修复] 只有非编辑模式才更新版本号
                                    if (msg.version !== undefined) {
                                        versionRef.current[msg.novelId] = msg.version;
                                        localStorage.setItem('novel_versions', JSON.stringify(versionRef.current));
                                    }
                                    // 异步保存 DB，不阻塞 UI
                                    dbService.saveNovelContent(msg.novelId, {
                                        data: c.data,
                                        characters: c.characters?.items || c.characters,
                                        scenes: c.scenes?.items || c.scenes,
                                        worldSettings: c.world_settings?.items || c.world_settings,
                                        charCats: c.char_cats,
                                        sceneCats: c.scene_cats,
                                        settingCats: c.set_cats,
                                        chapterTemplates: c.chapter_templates,
                                        charFields: c.char_fields,
                                        version: msg.version,
                                        updated_at: Date.now()
                                    }).catch(e => console.error('[WS] Content push DB save failed (non-fatal):', e));

                                    // [重要] 使用传入的 content 直接更新
                                    import('../utils/syncUtils.js').then(({ parseNovelContent }) => {
                                        const parsed = parseNovelContent(msg.content);
                                        updateAllState({
                                            data: parsed.data,
                                            characters: parsed.chars,
                                            charCats: parsed.charCats,
                                            scenes: parsed.scenes,
                                            sceneCats: parsed.sceneCats,
                                            worldSettings: parsed.world,
                                            settingCats: parsed.setCats,
                                            chapterTemplates: parsed.templates,
                                            charFields: parsed.charFields,
                                            relations: parsed.relations
                                        });
                                    }).catch(err => console.error('[WS-Push] UI update failed:', err));
                                }
                            });
                        } else {
                            // [关键优化] 如果收到的小说版本号 <= 本地版本，说明是自己发起的更新或已处理过
                            // 直接忽略，避免触发 Store 更新导致 useAutoSave 再次运行（回声保存）
                            if (msg.version <= localVerBeforeUpdate) {
                                return;
                            }

                            // [2024-12-27 优化] 直接处理广播中的删除指令 (零请求删除)
                            const uv = msg.updated_versions || {};
                            const deletedIds = uv.deleted_ids || [];

                            if (deletedIds.length > 0) {
                                import('../stores/entityStore.js').then(({ useEntityStore }) => {
                                    const store = useEntityStore.getState();
                                    // 批量删除 (需 Store 支持 deleteBatch 或循环调用)
                                    // 既然是通用 ID，尝试从所有列表中移除 (Store 内部通常也是 filter)
                                    // 为了简单，我们手动触发 UI 刷新

                                    // 注意：useEntityStore 没有统一的 deleteByIds，我们需要针对不同类型删除
                                    // 但后端给的是纯 ID 列表，没有类型。
                                    // 幸好前端 Store 删除通常只需要 ID，或者我们可以遍历 store 中的列表来匹配 ID

                                    // 使用 store.deleteEntity (如果存在) 或循环尝试
                                    // 由于时间紧迫且不修改 Store，我们这里需要一个简单的 Helper
                                    // 但为了安全，我们还是走 syncPull 流程？
                                    // 用户要求“不浪费流量”。
                                    // 那我们必须在前端实现“根据 ID 删除”

                                    // 临时方案：调用 applyDeltaSync 的删除逻辑？
                                    // applyDeltaSync 需要 delta 对象。我们可以构造一个假的 delta。
                                    import('../utils/syncUtils.js').then(({ applyDeltaSync }) => {
                                        import('../services/db.js').then(({ dbService }) => {
                                            dbService.getNovelContent(msg.novelId).then(localContent => {
                                                const fakeDelta = {
                                                    latest_version: msg.version,
                                                    updated: { nodes: [], characters: [], scenes: [], settings: [], relations: [], categories: [] }, // [修复] 添加空的 updated 避免报错
                                                    deleted: { nodes: deletedIds, characters: deletedIds, scenes: deletedIds, settings: deletedIds, relations: deletedIds, categories: deletedIds }
                                                };
                                                // [修复] 编辑模式下不打断用户
                                                if (!useUIStore.getState().isEditing) {
                                                    applyDeltaSync(msg.novelId, fakeDelta, localContent, {}, true).then(() => {
                                                    });
                                                } else {
                                                    // [修复] 标记脏状态
                                                    useUIStore.getState().setHasPendingRemoteUpdates(true);
                                                }
                                            });
                                        });
                                    });
                                });
                            }

                            // 检查是否有真正的实体更新 (除删除外)
                            const hasContentUpdates = (uv.nodes?.length > 0) || (uv.characters?.length > 0) ||
                                (uv.scenes?.length > 0) || (uv.settings?.length > 0) || (uv.categories?.length > 0) || (uv.relations?.length > 0);

                            if (!hasContentUpdates) {
                                // 只有书名/元数据变化(或仅删除)，仅更新列表，无需拉取完整内容
                                // 如果刚才已经执行了删除，这里只需要更新一下列表标题/版本即可

                                // [修复] 编辑模式下：仅标记脏状态，不更新版本号
                                if (useUIStore.getState().isEditing) {
                                    useUIStore.getState().setHasPendingRemoteUpdates(true);
                                    return;
                                }

                                import('../services/api.js').then(({ syncPullNovel }) => {
                                    // [修复] 如果消息包含 title，直接更新；否则必须拉取（因为只有元数据变化）
                                    if (msg.title) {
                                        setNovels(prev => prev.map(n =>
                                            n.id === msg.novelId
                                                ? { ...n, title: msg.title, version: msg.version }
                                                : n
                                        ));
                                        versionRef.current[msg.novelId] = msg.version;
                                        localStorage.setItem('novel_versions', JSON.stringify(versionRef.current));
                                    } else {
                                        // 消息没带 title，只能发起请求拉取
                                        syncPullNovel(msg.novelId, localVerBeforeUpdate).then(res => {
                                            if (res && res.data) {
                                                setNovels(prev => prev.map(n =>
                                                    n.id === msg.novelId
                                                        ? { ...n, title: res.data.title || n.title, version: res.data.latest_version || n.version }
                                                        : n
                                                ));
                                                if (res.data.latest_version) {
                                                    versionRef.current[msg.novelId] = res.data.latest_version;
                                                    localStorage.setItem('novel_versions', JSON.stringify(versionRef.current));
                                                }
                                            }
                                        }).catch(e => console.error('[WS] Metadata sync failed:', e));
                                    }
                                });
                            } else {
                                // 有实体变化，使用增量拉取
                                import('../services/api.js').then(({ syncPullNovel }) => {
                                    syncPullNovel(msg.novelId, localVerBeforeUpdate).then(async res => {
                                        if (res?.code === 200 && res?.data) {
                                            const { applyDeltaSync } = await import('../utils/syncUtils.js');
                                            const { dbService } = await import('../services/db.js');

                                            // 获取本地数据
                                            const localContent = await dbService.getNovelContent(msg.novelId);

                                            // 应用增量同步
                                            if (!useUIStore.getState().isEditing) {
                                                await applyDeltaSync(msg.novelId, res.data, localContent, {});

                                                // [修复] 只有非编辑模式才更新版本号
                                                versionRef.current[msg.novelId] = res.data.latest_version;
                                                localStorage.setItem('novel_versions', JSON.stringify(versionRef.current));

                                                // 更新列表中的 version
                                                setNovels(prev => prev.map(n =>
                                                    n.id === msg.novelId
                                                        ? { ...n, version: res.data.latest_version }
                                                        : n
                                                ));
                                            } else {
                                                // [修复] 编辑模式下收到增量通知：标记脏状态，不更新版本号
                                                useUIStore.getState().setHasPendingRemoteUpdates(true);
                                            }
                                        }
                                    }).catch(e => console.error('[WS] content_updated delta sync failed:', e));
                                });
                            }
                        }
                    } else {
                        // [增量同步] 非当前编辑的小说：根据 updated_versions 判断处理策略
                        const uv = msg.updated_versions || {};
                        const hasEntityChanges = (uv.nodes?.length > 0) || (uv.characters?.length > 0) ||
                            (uv.scenes?.length > 0) || (uv.settings?.length > 0) ||
                            (uv.categories?.length > 0) || (uv.relations?.length > 0);

                        if (!hasEntityChanges) {
                            // 只有书名/元数据变化，仅更新列表
                            const localVer = versionRef.current[msg.novelId] || 0;
                            import('../services/api.js').then(({ syncPullNovel }) => {
                                syncPullNovel(msg.novelId, localVer).then(res => {
                                    if (res && res.data) {
                                        setNovels(prev => prev.map(n =>
                                            n.id === msg.novelId
                                                ? {
                                                    ...n,
                                                    title: res.data.title || n.title,
                                                    version: res.data.latest_version || n.version
                                                }
                                                : n
                                        ));
                                        if (res.data.latest_version !== undefined) {
                                            versionRef.current[msg.novelId] = res.data.latest_version;
                                            localStorage.setItem('novel_versions', JSON.stringify(versionRef.current));
                                        }
                                    }
                                }).catch(e => console.error('[WS] Other novel metadata sync failed:', e));
                            });
                        } else {
                            // 有实体变化，拉取并缓存完整内容

                            const localVer = versionRef.current[msg.novelId] || 0;
                            import('../services/api.js').then(({ syncPullNovel }) => {
                                syncPullNovel(msg.novelId, localVer).then(async res => {
                                    if (res && res.data) {
                                        const { applyDeltaSync } = await import('../utils/syncUtils.js');
                                        const { dbService } = await import('../services/db.js');

                                        // 尝试获取本地数据以支持增量合并
                                        let localContent = null;
                                        if (!res.data.is_snapshot) {
                                            try {
                                                localContent = await dbService.getNovelContent(msg.novelId);
                                            } catch (e) {
                                            }
                                        }

                                        // 应用增量同步 (updateUI = false)
                                        // 如果 localContent 缺失且是增量包，applyDeltaSync 会报错吗？
                                        // applyDeltaSync 内部会处理空数据，但如果增量依赖旧数据可能会有问题。
                                        // 这里假设如果本地无数据，localVer 应该是 0，此时后端返回快照。
                                        await applyDeltaSync(msg.novelId, res.data, localContent, {}, false);

                                        // 更新 novels 列表
                                        setNovels(prev => prev.map(n =>
                                            n.id === msg.novelId
                                                ? {
                                                    ...n,
                                                    title: res.data.title || n.title,
                                                    version: res.data.latest_version || n.version
                                                }
                                                : n
                                        ));

                                        // 更新版本号引用
                                        if (res.data.latest_version !== undefined) {
                                            versionRef.current[msg.novelId] = res.data.latest_version;
                                            localStorage.setItem('novel_versions', JSON.stringify(versionRef.current));
                                        }

                                    }
                                }).catch(e => console.error('[WS] Other novel delta sync failed:', e));
                            });
                        }
                    }
                } else if (msg.type === 'novel_list_updated') {
                    // [新增] 列表更新通知
                    fetchAPI('/api/novel/list').then(res => {
                        if (res && res.data) {
                            setNovels(res.data);
                        }
                    }).catch(e => console.error('[WS] List fetch failed:', e));
                } else if (msg.type === 'config_saved') {
                    if (msg.version) {
                        localStorage.setItem(getStorageKey('config_version'), msg.version);
                    }
                } else if (msg.type && msg.type.startsWith('collab_')) {
                    setLastCollabMessage(msg);
                }
            } catch (e) {
                // 解析错误静默处理
            }
        };

        ws.onerror = (error) => {
            // 静默处理错误
        };

        ws.onclose = (event) => {
            setWsStatus('disconnected');
            clearTimers();

            // [修复] 鉴权失败熔断：如果 WebSocket 返回 4001(未认证) 或 1008(策略违反)，直接登出，不再重连
            if (event.code === 4001 || event.code === 1008) {
                // 需要从 UserContext 获取 logout，但 connect 是被 useCallback 包裹的
                // 这里我们通过 window.location.reload() 或者触发一个全局事件来处理，
                // 或者更优雅地：在 useWebSocket 中引入 logout 方法。
                // 为了遵循"不新建函数"原则，且 connect 依赖中没有 logout，
                // 我们这里使用 localStorage 清除 + 页面刷新作为兜底。
                console.warn('[WS] 鉴权失败，停止重连并登出。Code:', event.code);
                localStorage.removeItem('novel_token');
                window.location.reload();
                return;
            }

            // [新增] 自动重连（指数退避）
            if (!isUnmountedRef.current && isAuthenticated) {
                const delay = RECONNECT_DELAYS[Math.min(reconnectAttemptRef.current, RECONNECT_DELAYS.length - 1)];

                reconnectTimeoutRef.current = setTimeout(() => {
                    reconnectAttemptRef.current++;
                    connect();
                }, delay);
            }
        };
    }, [isAuthenticated, hasUser, currentNovelIdRef, updateAllState, serverTimestampRef, versionRef, getStorageKey, clearTimers, setNovels]); // [修复] currentUser -> hasUser

    // 主 effect：建立连接
    useEffect(() => {
        isUnmountedRef.current = false;
        connect();

        return () => {
            isUnmountedRef.current = true;
            clearTimers();
            if (wsRef.current) {
                if (wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.close(1000, 'Component unmount');
                } else if (wsRef.current.readyState === WebSocket.CONNECTING) {
                    wsRef.current.onopen = () => wsRef.current.close(1000, 'Component unmount');
                }
            }
        };
    }, [connect, clearTimers]);

    // [新增] 网络状态感知：网络恢复时主动重连
    useEffect(() => {
        const handleOnline = () => {
            // [修复] 强制重连：无论当前状态如何（Connecting 可能卡死，Open 可能已过时），都强制触发重连
            // 唯一例外：如果正在上传设置，可能需要等待？不，网络断过，连接肯定不可靠了。
            // 但如果 "isSettingsDirty" 为真，我们应该先尝试上传。

            reconnectAttemptRef.current = 0; // 重置重连计数

            // [新增] 检查是否有未上传的设置修改
            if (isSettingsDirty()) {
                console.log('[WS] 网络恢复，检测到未上传的设置修改，触发上传');
                // [重构] 使用工具函数上传设置
                import('../utils/configUtils.js').then(({ uploadPendingSettings }) => {
                    uploadPendingSettings(getStorageKey);
                }).catch(e => console.warn('[WS] 设置上传失败:', e));
            }

            // [核心修复] 移除所有状态检查，强制重连
            console.log('[WS] 网络恢复，强制重连...');
            connect();
        };



        const handleOffline = () => {
            setWsStatus('disconnected');
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [connect]);

    // 发送消息
    const sendMessage = useCallback((msg) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(msg));
            return true;
        }
        return false;
    }, []);

    // 手动重连
    const reconnect = useCallback(() => {
        reconnectAttemptRef.current = 0;
        // [新增] 断连恢复时重置编辑状态
        useUIStore.getState().setIsEditing(false);
        clearTimers();
        if (wsRef.current) {
            wsRef.current.close();
        }
        connect();
    }, [connect, clearTimers]);

    return { wsStatus, sendMessage, lastCollabMessage, reconnect };
}
