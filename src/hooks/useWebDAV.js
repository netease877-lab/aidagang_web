/**
 * useWebDAV.js - WebDAV 操作 Hook
 * 集中管理所有 WebDAV 相关功能：备份、恢复、测试连接、文件列表等
 * [Refactor] 使用 settingsStore 获取配置，移除 localStorage 依赖
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { STORAGE_PREFIX } from '../constants.js';
import { buildBackupJSON } from '../utils/backupUtils.js';
import { useSettingsStore } from '../stores/settingsStore.js'; // [Refactor] Import store
import { apiClient } from '../services/api.js'; // [新增] 支持跨域 baseUrl

// ==================== 工具函数 ====================

/**
 * 安全的 Base64 编码（支持 Unicode）
 */
export const safeBtoa = (str) => {
    try {
        // [修复] 标准 Unicode Base64 编码，确保特殊字符正确处理
        return btoa(unescape(encodeURIComponent(str)));
    } catch (e) {
        console.error('safeBtoa error:', e);
        return btoa(str);
    }
};

/**
 * 获取 WebDAV 代理 URL（后端兜底）
 * [修复] 支持跨域 baseUrl
 */
export const getWebDAVProxyUrl = (targetUrl) => {
    const base64Url = btoa(targetUrl);
    return `${apiClient.baseUrl}/api/webdav_proxy/${base64Url}`;
};

/**
 * 简易 TOTP 生成（基于 HMAC-SHA1，30秒周期）
 * 注意：浏览器环境需要 SubtleCrypto，这里使用简化版本
 */
const generateTOTP = (secret) => {
    // 简化版 TOTP：使用当前时间戳 + 密钥生成 6 位数字
    // 完整实现需要 HMAC-SHA1，这里用简化算法
    const timeStep = Math.floor(Date.now() / 30000); // 30秒周期
    let hash = 0;
    const combined = secret + timeStep.toString();
    for (let i = 0; i < combined.length; i++) {
        const char = combined.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash % 1000000).toString().padStart(6, '0');
};

/**
 * CF Worker 配置缓存（短期缓存，TOTP 30秒刷新）
 */
let cachedSyncConfig = null;
let syncConfigFetchedAt = 0;
const SYNC_CONFIG_CACHE_TTL = 25000; // 25 秒缓存（比 TOTP 30秒周期略短）

/**
 * 获取同步配置（CF Worker + WebDAV 凭证）
 * [重构] 使用新的凭证分发接口 /api/system/sync-config
 * 返回: { cf_worker_enabled, worker_urls, totp_code, webdav_auth, webdav_url }
 */
const getSyncConfig = async () => {
    const now = Date.now();
    if (cachedSyncConfig && (now - syncConfigFetchedAt) < SYNC_CONFIG_CACHE_TTL) {
        return cachedSyncConfig;
    }

    try {
        cachedSyncConfig = await apiClient.get('/api/system/sync-config');
        syncConfigFetchedAt = now;
        return cachedSyncConfig;
    } catch (e) {
    }
    return null;
};

/**
 * 获取带负载均衡的 WebDAV 代理 URL（后端处理 CF Worker 负载均衡）
 * [重构] 负载均衡逻辑已移至后端
 * [修复] 支持跨域 baseUrl
 */
export const getWebDAVLBProxyUrl = (targetUrl) => {
    const base64Url = btoa(targetUrl);
    return `${apiClient.baseUrl}/api/webdav_lb/${base64Url}`;
};

/**
 * 构建 CF Worker 直连 URL
 */
const getCfWorkerDirectUrl = (workerUrl, targetUrl) => {
    const base64Url = btoa(targetUrl);
    // [修复] 移除 workerUrl 末尾的斜杠，避免双斜杠
    const cleanWorkerUrl = workerUrl.replace(/\/+$/, '');
    return `${cleanWorkerUrl}/${base64Url}`;
};

/**
 * 智能 WebDAV 请求函数
 * [重构] 使用凭证分发接口获取 TOTP 暗号和 WebDAV 凭证
 * 模式:
 *   - CF Worker 启用: 前端直连 Worker，携带 TOTP 暗号和后端解密的凭证
 *   - CF Worker 未启用: 走后端代理（后端自动处理凭证解密）
 */
const smartWebDAVRequest = async (targetUrl, options = {}) => {
    const syncConfig = await getSyncConfig();

    // 如果未启用 CF Worker，使用后端代理（后端自动解密凭证）
    if (!syncConfig?.cf_worker_enabled || !syncConfig.worker_urls?.length) {
        console.log('[WebDAV] 路由: 后端代理 (CF Worker 未启用)');
        const backendUrl = getWebDAVProxyUrl(targetUrl);
        const token = localStorage.getItem('novel_token');
        const headers = { ...(options.headers || {}) };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        return fetch(backendUrl, { ...options, headers });
    }

    // CF Worker 模式: 直连 Worker
    const workerUrl = syncConfig.worker_urls[0]; // 简单取第一个，后续可轮询
    const directUrl = getCfWorkerDirectUrl(workerUrl, targetUrl);
    console.log('[WebDAV] 路由: CF Worker 直连 →', workerUrl);

    // [修复] 复制 headers，但移除可能加密的凭证，强制使用后端解密的凭证
    const headers = { ...(options.headers || {}) };
    delete headers['X-WebDAV-Authorization']; // 移除调用方传的（可能是加密的）

    // 添加 TOTP 暗号
    if (syncConfig.totp_code) {
        headers['X-Proxy-Secret'] = syncConfig.totp_code;
    }
    // [修复] 强制使用后端解密的 WebDAV 凭证
    if (syncConfig.webdav_auth) {
        headers['X-WebDAV-Authorization'] = syncConfig.webdav_auth;
    }

    try {
        const res = await fetch(directUrl, { ...options, headers });
        if (res.ok || res.status === 207) {
            console.log('[WebDAV] CF Worker 请求成功');
            return res;
        }
        console.warn('[WebDAV] CF Worker 请求失败:', res.status, '- 回退到后端代理');
        // Worker 失败，回退到后端代理
    } catch (err) {
        console.warn('[WebDAV] CF Worker 请求异常:', err.message, '- 回退到后端代理');
    }

    // 回退到后端代理（后端自动解密凭证）
    console.log('[WebDAV] 路由: 后端代理 (CF Worker 回退)');
    const backendUrl = getWebDAVProxyUrl(targetUrl);
    const token = localStorage.getItem('novel_token');
    const fallbackHeaders = { ...(options.headers || {}) };
    if (token) fallbackHeaders['Authorization'] = `Bearer ${token}`;
    return fetch(backendUrl, { ...options, headers: fallbackHeaders });
};


// ==================== WebDAV Hook ====================

export const useWebDAV = ({
    getStorageKey,
    currentNovelId,
    novels,
    data,
    characters,
    charCats,
    scenes,
    sceneCats,
    worldSettings,
    settingCats,
    chapterTemplates,
    charFields,
    relations,  // [修复] 添加角色关系参数
    permissions,
    operationLog,
    addToast,
    showToast
}) => {
    const [webdavStatus, setWebdavStatus] = useState('idle'); // idle | testing | success | error | syncing
    const [webdavLastMsg, setWebdavLastMsg] = useState('');
    const [cloudFiles, setCloudFiles] = useState([]);
    const [isCloudLoading, setIsCloudLoading] = useState(false);
    const webdavSyncingTimeoutRef = useRef(null); // [兜底] syncing 状态 10 秒超时保护

    // [修复] 监听 WebDAV 配置变化，清除 syncConfig 缓存，确保下次请求获取最新凭证
    const storeWebdavConfig = useSettingsStore(state => state.webdavConfig);
    useEffect(() => {
        cachedSyncConfig = null;
        syncConfigFetchedAt = 0;
    }, [storeWebdavConfig]);

    /**
     * 获取 WebDAV 配置
     * [Refactor] 直接从 settingsStore 获取全局配置 (源自后端同步)
     */
    const getWebdavConfig = useCallback(() => {
        // [Refactor] 移除所有 localStorage/sessionStorage 自行读取逻辑
        // 直接使用 Store 中的最新配置
        const config = useSettingsStore.getState().webdavConfig;

        // 如果 Store 中没有配置，返回 null
        if (!config || !config.url) return null;

        return config;
    }, []);

    /**
     * 测试 WebDAV 连接
     */
    const testConnection = useCallback(async (config) => {
        setWebdavStatus('testing');
        const { url, username, password } = config;

        if (!url) {
            setWebdavStatus('error');
            return { success: false, error: '请输入 WebDAV 地址' };
        }

        try {
            const proxyUrl = getWebDAVProxyUrl(url.endsWith('/') ? url : url + '/');
            // [修复] 使用 PROPFIND 方法（与原实现一致），添加 Depth 头和 Bearer Token
            const token = localStorage.getItem('novel_token');
            const headers = {
                'X-WebDAV-Authorization': 'Basic ' + safeBtoa(`${username}:${password}`),
                'Depth': '0'
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(proxyUrl, {
                method: 'PROPFIND',
                headers: headers
            });

            if (response.status === 401) {
                setWebdavStatus('error');
                return { success: false, error: '账号或密码错误' };
            }

            if (response.ok || response.status === 207) {
                setWebdavStatus('success');
                operationLog?.logSync?.('WebDAV测试', '连接成功');
                return { success: true };
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('WebDAV test error:', error);
            setWebdavStatus('error');
            return { success: false, error: error.message };
        }
    }, [operationLog]);

    /**
     * 获取 WebDAV 文件列表
     */
    const fetchFileList = useCallback(async () => {
        const config = getWebdavConfig();
        if (!config?.url) {
            return [];
        }

        setIsCloudLoading(true);
        const { url, username, password } = config;

        try {
            const proxyUrl = getWebDAVProxyUrl(url.endsWith('/') ? url : url + '/');
            // [修复] 添加 Bearer Token
            const token = localStorage.getItem('novel_token');
            const headers = {
                'X-WebDAV-Authorization': 'Basic ' + safeBtoa(`${username}:${password}`),
                'Depth': '1'
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            const response = await fetch(proxyUrl, {
                method: 'PROPFIND',
                headers: headers
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const xmlText = await response.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

            const files = [];
            const responses = xmlDoc.querySelectorAll('response, d\\:response, D\\:response');

            responses.forEach((resp, index) => {
                if (index === 0) return; // 跳过根目录

                const hrefEl = resp.querySelector('href, d\\:href, D\\:href');
                const href = hrefEl?.textContent || '';
                const fileName = decodeURIComponent(href.split('/').filter(Boolean).pop() || '');

                // [修改] 支持两种格式：新格式（书名.json）和旧格式（Novel_ID_书名.json）
                if (fileName.endsWith('.json')) {
                    const lastModEl = resp.querySelector('getlastmodified, d\\:getlastmodified, D\\:getlastmodified');
                    const lastMod = lastModEl?.textContent || '';

                    // 尝试解析旧格式 Novel_ID_书名.json
                    const oldMatch = fileName.match(/Novel_([^_]+)_(.+)\.json/);
                    // 新格式直接使用文件名（去除 .json）
                    const title = oldMatch ? oldMatch[2] : fileName.replace('.json', '');
                    const novelId = oldMatch ? oldMatch[1] : '';  // 新格式不含 ID

                    files.push({
                        name: fileName,
                        title,
                        novelId,
                        lastModified: lastMod ? new Date(lastMod).toLocaleString() : ''
                    });
                }
            });

            setCloudFiles(files);
            return files;
        } catch (error) {
            console.error('Fetch WebDAV files error:', error);
            addToast?.(`获取文件列表失败: ${error.message}`, 'error');
            return [];
        } finally {
            setIsCloudLoading(false);
        }
    }, [getStorageKey, getWebdavConfig, addToast]);

    /**
     * 删除 WebDAV 文件
     */
    const deleteFile = useCallback(async (fileName) => {
        const config = getWebdavConfig();
        if (!config?.url) return false;

        const { url, username, password } = config;
        const rawUrl = url.endsWith('/') ? url : url + '/';
        const fileUrl = rawUrl + encodeURIComponent(fileName);
        const proxyUrl = getWebDAVProxyUrl(fileUrl);

        try {
            // [修复] 添加 Bearer Token
            const token = localStorage.getItem('novel_token');
            const headers = {
                'X-WebDAV-Authorization': 'Basic ' + safeBtoa(`${username}:${password}`)
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            const response = await fetch(proxyUrl, {
                method: 'DELETE',
                headers: headers
            });

            if (response.ok || response.status === 204 || response.status === 404) {
                operationLog?.logSync?.('WebDAV删除', fileName);
                addToast?.(`已删除: ${fileName}`, 'success');
                await fetchFileList();
                return true;
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('Delete WebDAV file error:', error);
            addToast?.(`删除失败: ${error.message}`, 'error');
            return false;
        }
    }, [getWebdavConfig, fetchFileList, operationLog, addToast]);

    /**
     * 备份到 WebDAV
     */
    const backup = useCallback(async (isManual = false) => {
        if (!permissions?.webdav) return { success: false, error: '无 WebDAV 权限' };

        const config = getWebdavConfig();
        if (!config) return { success: false, error: '未配置 WebDAV' };

        const { url, username, password, enabled } = config;
        if (!enabled && !isManual) return { success: false, error: '自动备份未启用' };
        if (!url || !username) return { success: false, error: '配置不完整' };

        try {
            setWebdavStatus('syncing');

            // [兜底] 10 秒超时保护：防止 syncing 指示灯卡住
            if (webdavSyncingTimeoutRef.current) clearTimeout(webdavSyncingTimeoutRef.current);
            webdavSyncingTimeoutRef.current = setTimeout(() => {
                console.warn('[WebDAV] syncing 状态超时 10 秒，重置为 idle');
                setWebdavStatus('idle');
            }, 10000);

            if (isManual) showToast?.('正在备份到 WebDAV...', 'success');

            const currentTitle = novels?.find(n => n.id === currentNovelId)?.title || 'Unknown';

            // 使用公共函数构建备份 JSON
            const exportData = buildBackupJSON({
                novelId: currentNovelId,
                title: currentTitle,
                data,
                chapterTemplates,
                charFields,
                charCats,
                characters,
                sceneCats,
                scenes,
                settingCats,
                worldSettings,
                relations: relations || []
            });

            const safeTitle = currentTitle.replace(/[\\/:*?"<>|]/g, '_');
            // [修改] 文件名只使用书名，ID 保留在 meta 中用于恢复时匹配
            const fileName = `${safeTitle}.json`;
            const rawUrl = url.endsWith('/') ? url : url + '/';
            const fileUrl = rawUrl + encodeURIComponent(fileName);

            // [修复] 需要同时发送 WebDAV 凭证和用户 Bearer Token
            const token = localStorage.getItem('novel_token');
            const headers = {
                'X-WebDAV-Authorization': 'Basic ' + safeBtoa(`${username}:${password}`),
                'Content-Type': 'application/json'
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            // [新增] 使用智能分流请求（CF Worker 优先，后端兜底）
            const response = await smartWebDAVRequest(fileUrl, {
                method: 'PUT',
                headers: headers,
                body: JSON.stringify(exportData)
            });

            if (response.ok || response.status === 201 || response.status === 204) {
                if (webdavSyncingTimeoutRef.current) clearTimeout(webdavSyncingTimeoutRef.current); // [兜底] 清除超时定时器
                setWebdavStatus('success');
                if (isManual) {
                    showToast?.('WebDAV 备份成功!', 'success');
                    operationLog?.logSync?.('WebDAV备份', `《${currentTitle}》`);
                }
                return { success: true };
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('WebDAV backup error:', error);
            if (webdavSyncingTimeoutRef.current) clearTimeout(webdavSyncingTimeoutRef.current); // [兜底] 清除超时定时器
            setWebdavStatus('error');
            setWebdavLastMsg(error.message);
            if (isManual) {
                showToast?.(`备份失败: ${error.message}`, 'error');
                operationLog?.logSync?.('WebDAV备份失败', error.message);
            }
            return { success: false, error: error.message };
        }
    }, [
        permissions, getWebdavConfig, currentNovelId, novels,
        data, chapterTemplates, charFields, charCats, characters,
        sceneCats, scenes, settingCats, worldSettings, relations, // [修复] 添加 relations 依赖
        showToast, operationLog
    ]);

    /**
     * 从 WebDAV 恢复（下载 JSON 数据）
     */
    const downloadFile = useCallback(async (fileName) => {
        const config = getWebdavConfig();
        if (!config?.url) return null;

        const { url, username, password } = config;
        const rawUrl = url.endsWith('/') ? url : url + '/';
        const fileUrl = rawUrl + encodeURIComponent(fileName);
        const proxyUrl = getWebDAVProxyUrl(fileUrl);

        try {
            // [修复] 添加 Bearer Token
            const token = localStorage.getItem('novel_token');
            const headers = {
                'X-WebDAV-Authorization': 'Basic ' + safeBtoa(`${username}:${password}`)
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            const response = await fetch(proxyUrl, {
                method: 'GET',
                headers: headers
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const jsonData = await response.json();
            return jsonData;
        } catch (error) {
            console.error('Download WebDAV file error:', error);
            addToast?.(`下载失败: ${error.message}`, 'error');
            return null;
        }
    }, [getWebdavConfig, addToast]);

    return {
        // 状态
        webdavStatus,
        setWebdavStatus,
        webdavLastMsg,
        setWebdavLastMsg,
        cloudFiles,
        isCloudLoading,
        setIsCloudLoading,

        // 方法
        getWebdavConfig,
        testConnection,
        fetchFileList,
        deleteFile,
        backup,
        downloadFile
    };
};

export default useWebDAV;
