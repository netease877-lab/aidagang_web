// ==================================================
// File: frontend/src/contexts/UserContext.jsx
// 用户状态和权限管理
// ==================================================
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { apiClient } from '../services/api';
import { useEntityStore } from '../stores/entityStore';

const UserContext = createContext(null);

// [新增] 缓存上一次登录的用户 ID，用于快速加载配置
const LAST_USER_KEY = 'novel_studio_last_user_id';

/**
 * User Provider 组件
 * 管理用户认证状态、权限和配置
 */
export function UserProvider({ children }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoginOpen, setIsLoginOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [permissions, setPermissions] = useState({});
    const [isConfigLoading, setIsConfigLoading] = useState(true);

    /**
     * 获取用户资料
     */
    const fetchUserProfile = useCallback(async () => {
        try {
            const user = await apiClient.get('/api/users/me');
            setCurrentUser(user);
            setPermissions({
                ai_outline: user.enable_ai_base,
                ai_chapter: user.enable_ai_advanced,
                ai_toxic: user.enable_ai_toxic,
                ai_prompt: user.enable_ai_prompt,
                ai_chat: user.enable_ai_chat, // [新增] AI 对话权限
                webdav: user.enable_webdav,
                admin: user.is_superuser
            });

            // [新增] 缓存用户 ID，下次刷新时可直接使用
            if (user?.id) {
                const cachedId = localStorage.getItem(LAST_USER_KEY);
                if (cachedId !== String(user.id)) {
                    localStorage.setItem(LAST_USER_KEY, String(user.id));
                }
            }

            return user;
        } catch (e) {
            console.error("Fetch profile error", e);
            return null;
        }
    }, []);

    /**
     * 登出
     */
    const logout = useCallback(() => {
        localStorage.removeItem('novel_token');
        localStorage.removeItem(LAST_USER_KEY); // [新增] 登出时清除缓存的用户 ID
        setIsAuthenticated(false);
        setCurrentUser(null);
        setPermissions({});

        // [关键修复] 清空 entityStore 中的实体缓存，防止切换账号时数据残留
        useEntityStore.getState().reset();
    }, []);

    /**
     * [新增] 更新用户配置
     * 同时更新本地状态和后端
     */
    const updateConfig = useCallback(async (configUpdates) => {
        if (!currentUser) return;

        const newConfig = { ...(currentUser.config || {}), ...configUpdates };

        // 乐观更新本地状态
        setCurrentUser(prev => ({
            ...prev,
            config: newConfig
        }));

        // 异步保存到后端
        try {
            await apiClient.request('/api/users/me', 'PATCH', { config: newConfig });
        } catch (e) {
            console.error('[UserContext] 更新配置失败:', e);
        }
    }, [currentUser]);

    /**
     * 初始化认证状态
     */
    /**
     * 初始化认证状态与全局拦截器
     */
    useEffect(() => {
        // [新增] 注册 401 过期回调：自动登出
        apiClient.setUnauthorizedCallback(() => {
            logout();
            // [修复] 不跳转到 /login，AppUI 会自动显示 WelcomePage + 登录弹窗
        });

        const token = localStorage.getItem('novel_token');
        if (token) {
            setIsAuthenticated(true);
            fetchUserProfile().then(() => {
                setIsConfigLoading(false);
            });
        } else {
            setIsAuthenticated(false);
            localStorage.removeItem(LAST_USER_KEY); // [新增] 无 token 时也清除缓存
            setIsConfigLoading(false);
        }
    }, [fetchUserProfile, logout]);

    /**
     * 获取存储键（带用户 ID 前缀）
     * [优化] 优先使用 currentUser.id，其次使用缓存的 last_user_id，最后才用 guest
     * 这样刷新页面时可以立即从正确的 key 读取配置，无需等待后端验证
     */
    const userId = currentUser?.id; // [修复] 提取原始值，避免对象引用变化触发重建
    const getStorageKey = useCallback((key) => {
        // 优先使用已验证的用户 ID
        if (userId) {
            return `novel_studio_${userId}_${key}`;
        }
        // 其次使用缓存的用户 ID（刷新时后端验证还未完成）
        const cachedId = localStorage.getItem(LAST_USER_KEY);
        if (cachedId) {
            return `novel_studio_${cachedId}_${key}`;
        }
        // 最后使用 guest
        return `novel_studio_guest_${key}`;
    }, [userId]); // [关键修复] 只依赖 userId 而非整个 currentUser 对象

    const value = React.useMemo(() => ({
        // 状态
        isAuthenticated,
        isLoginOpen,
        currentUser,
        config: currentUser?.config || {}, // [修复] 导出用户配置，供 Layout 使用
        permissions,
        isConfigLoading,
        // 方法
        setIsAuthenticated,
        setIsLoginOpen,
        setCurrentUser,
        fetchUserProfile,
        logout,
        updateConfig, // [新增] 更新配置方法
        getStorageKey,
        setIsConfigLoading
    }), [
        isAuthenticated, isLoginOpen, currentUser, permissions, isConfigLoading,
        fetchUserProfile, logout, updateConfig, getStorageKey
    ]);

    return (
        <UserContext.Provider value={value}>
            {children}
        </UserContext.Provider>
    );
}

/**
 * 使用 User 上下文的 Hook
 * @returns {Object} 用户相关状态和方法
 */
export function useUser() {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
}

export default UserContext;
