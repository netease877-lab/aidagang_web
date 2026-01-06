// ==================================================
// File: frontend/src/hooks/useAuth.js
// 认证相关状态和方法（重构：移除配置加载，只负责认证）
// ==================================================
import { useState, useCallback, useEffect } from 'react';
import { STORAGE_PREFIX } from '../constants';
import { apiClient } from '../services/api';

/**
 * 认证相关 Hook（纯认证，配置加载由 useEditorState 负责）
 * @returns {Object} 认证相关状态和方法
 */
export function useAuth() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [permissions, setPermissions] = useState({});
    const [isConfigLoading, setIsConfigLoading] = useState(true);
    const [isLoginOpen, setIsLoginOpen] = useState(false);

    // 生成存储键
    const getStorageKey = useCallback((key) => {
        const uid = currentUser?.id || 'guest';
        return `${STORAGE_PREFIX}${uid}_${key}`;
    }, [currentUser]);

    // 统一的 API 请求函数
    // [Refactor] 使用全局 apiClient
    const fetchAPI = useCallback(async (url, method = 'GET', body = null) => {
        return apiClient.request(url, method, body);
    }, []);

    // 获取用户资料（仅认证信息，配置加载由 EditorPage 中的 loadUserConfig 负责）
    const fetchUserProfile = useCallback(async () => {
        try {
            const user = await fetchAPI('/api/users/me');
            setCurrentUser(user);
            setPermissions({
                ai_outline: user.enable_ai_base,
                ai_chapter: user.enable_ai_advanced,
                webdav: user.enable_webdav,
                admin: user.is_superuser
            });
            setIsConfigLoading(false);
        } catch (e) {
            console.error("Fetch profile error", e);
            setIsConfigLoading(false);
        }
    }, [fetchAPI]);

    // 登出
    const logout = useCallback(() => {
        localStorage.removeItem('novel_token');
        setIsAuthenticated(false);
        setCurrentUser(null);
        setPermissions({});
    }, []);

    // 初始化检查登录状态
    useEffect(() => {
        const token = localStorage.getItem('novel_token');
        if (token) {
            setIsAuthenticated(true);
            fetchUserProfile();
        } else {
            setIsAuthenticated(false);
            setIsConfigLoading(false);
        }
    }, []);

    // 未登录时设置 isConfigLoading 为 false
    useEffect(() => {
        if (!isAuthenticated) {
            setIsConfigLoading(false);
        }
    }, [isAuthenticated]);

    return {
        // 状态
        isAuthenticated,
        setIsAuthenticated,
        currentUser,
        setCurrentUser,
        permissions,
        isConfigLoading,
        setIsConfigLoading,
        isLoginOpen,
        setIsLoginOpen,

        // 方法
        fetchAPI,
        fetchUserProfile,
        logout,
        getStorageKey
    };
}

export default useAuth;
