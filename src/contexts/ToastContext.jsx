// ==================================================
// File: frontend/src/contexts/ToastContext.jsx
// 全局 Toast 通知管理
// ==================================================
import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

/**
 * Toast Provider 组件
 * 提供全局 Toast 通知功能
 */
export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    /**
     * 添加 Toast 通知
     * @param {string} message - 消息内容
     * @param {string} type - 通知类型 (success, error, info, warning)
     */
    const addToast = useCallback((message, type = 'info') => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, message, type }]);
        // 自动移除
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    }, []);

    /**
     * 移除指定 Toast
     * @param {number} id - Toast ID
     */
    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    /**
     * 显示成功通知的快捷方法
     */
    const showToast = useCallback((message, type = 'success') => {
        addToast(message, type);
    }, [addToast]);

    const value = {
        toasts,
        addToast,
        removeToast,
        showToast
    };

    return (
        <ToastContext.Provider value={value}>
            {children}
        </ToastContext.Provider>
    );
}

/**
 * 使用 Toast 上下文的 Hook
 * @returns {Object} Toast 相关方法
 */
export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

export default ToastContext;
