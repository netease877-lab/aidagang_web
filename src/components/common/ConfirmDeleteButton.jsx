// ==================================================
// File: frontend/src/components/ConfirmDeleteButton.jsx
// 统一的删除确认按钮组件
// ==================================================
import React from 'react';
import { Trash2, X } from 'lucide-react';
import { useDeleteConfirm } from '../../hooks/useDeleteConfirm';

/**
 * 可复用的删除确认按钮组件
 * 
 * @param {Function} onDelete - 确认删除时的回调
 * @param {string} size - 按钮大小: 'sm' | 'md' (默认 'md')
 * @param {string} icon - 图标类型: 'trash' | 'x' (默认 'trash')
 * @param {string} confirmText - 确认文字 (默认 '确定?')
 * @param {number} resetDelay - 自动重置延迟 (默认 3000ms)
 * @param {string} className - 额外的 className
 * @param {Function} onClick - 额外的点击事件处理（用于 stopPropagation 等）
 */
export function ConfirmDeleteButton({
    onDelete,
    size = 'md',
    icon = 'trash',
    confirmText = '确定?',
    resetDelay = 3000,
    className = '',
    onClick,
    title = '删除'
}) {
    const [isConfirming, requestConfirm] = useDeleteConfirm(resetDelay);

    const handleClick = (e) => {
        if (onClick) onClick(e);
        if (isConfirming) {
            onDelete();
        } else {
            requestConfirm();
        }
    };

    // 根据 size 确定样式
    const sizeStyles = {
        sm: {
            padding: 'p-1',
            iconSize: 12,
            textSize: 'text-[9px]',
            minWidth: 'min-w-[20px]',
            confirmPadding: 'px-1.5'
        },
        md: {
            padding: 'p-2',
            iconSize: 14,
            textSize: 'text-[10px]',
            minWidth: 'min-w-[28px]',
            confirmPadding: 'px-2'
        }
    };

    const s = sizeStyles[size] || sizeStyles.md;
    const IconComponent = icon === 'x' ? X : Trash2;

    const baseClass = `${s.padding} rounded transition-all flex items-center justify-center ${s.minWidth}`;
    const stateClass = isConfirming
        ? `bg-red-500 text-white hover:bg-red-600 ${s.confirmPadding}`
        : 'text-[var(--text-sub)] hover:text-red-500 hover:bg-[var(--hover-bg)]';

    return (
        <button
            onClick={handleClick}
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
            className={`${baseClass} ${stateClass} ${className}`}
            title={title}
        >
            {isConfirming
                ? <span className={`${s.textSize} font-bold whitespace-nowrap`}>{confirmText}</span>
                : <IconComponent size={s.iconSize} />
            }
        </button>
    );
}

export default ConfirmDeleteButton;
