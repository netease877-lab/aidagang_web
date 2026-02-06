// ==================================================
// File: frontend/src/hooks/useErrorBoundary.js
// 统一错误处理Hook
// ==================================================
import { useState, useCallback } from 'react';
import { useToast } from '../contexts';

/**
 * 统一错误处理Hook
 * 提供标准化的错误捕获、显示和恢复机制
 */
export function useErrorBoundary() {
    const toast = useToast();
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    /**
     * 包装异步操作，自动处理错误
     * @param {Function} asyncFn - 异步函数
     * @param {Object} options - 配置选项
     */
    const withErrorHandling = useCallback(async (asyncFn, options = {}) => {
        const {
            successMessage = null,
            errorMessage = '操作失败',
            showLoading = true,
            onSuccess = null,
            onError = null,
        } = options;

        try {
            if (showLoading) setIsLoading(true);
            setError(null);

            const result = await asyncFn();

            if (successMessage) {
                toast.showToast(successMessage, 'success');
            }
            if (onSuccess) onSuccess(result);

            return result;
        } catch (err) {
            const message = err.message || errorMessage;
            setError(err);
            toast.showToast(message, 'error');
            console.error('[ErrorBoundary]', err);

            if (onError) onError(err);
            return null;
        } finally {
            if (showLoading) setIsLoading(false);
        }
    }, [toast]);

    /**
     * 手动报告错误
     */
    const reportError = useCallback((err, message = '发生错误') => {
        setError(err);
        toast.showToast(message, 'error');
        console.error('[ErrorBoundary] Manual report:', err);
    }, [toast]);

    /**
     * 清除错误状态
     */
    const clearError = useCallback(() => {
        setError(null);
    }, []);

    return {
        error,
        isLoading,
        withErrorHandling,
        reportError,
        clearError,
    };
}

export default useErrorBoundary;
