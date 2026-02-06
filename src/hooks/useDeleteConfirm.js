// ==================================================
// File: frontend/src/hooks/useDeleteConfirm.js
// 统一的删除确认 Hook 和按钮组件
// ==================================================
import { useState, useEffect } from 'react';

/**
 * 自定义 Hook: 管理删除确认状态
 * @param {number} resetDelay - 自动重置延迟时间（毫秒），默认 3000
 * @returns {[boolean, () => void, () => void]} - [isConfirming, requestConfirm, resetConfirm]
 */
export function useDeleteConfirm(resetDelay = 3000) {
    const [isConfirming, setIsConfirming] = useState(false);

    useEffect(() => {
        if (isConfirming) {
            const timer = setTimeout(() => setIsConfirming(false), resetDelay);
            return () => clearTimeout(timer);
        }
    }, [isConfirming, resetDelay]);

    const requestConfirm = () => setIsConfirming(true);
    const resetConfirm = () => setIsConfirming(false);

    return [isConfirming, requestConfirm, resetConfirm];
}

export default useDeleteConfirm;
