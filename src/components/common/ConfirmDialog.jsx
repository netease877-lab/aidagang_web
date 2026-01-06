/**
 * ConfirmDialog - 通用确认对话框组件
 * 从 SettingsPanel.jsx 提取的通用组件
 */
import React from 'react';
import { ShieldAlert } from 'lucide-react';

/**
 * @param {Object} props
 * @param {boolean} props.visible - 是否显示
 * @param {string} props.message - 确认信息
 * @param {Function} props.onConfirm - 点击确定回调
 * @param {Function} props.onCancel - 点击取消回调
 * @param {string} [props.title] - 标题，默认"需要确认"
 * @param {string} [props.confirmText] - 确定按钮文本，默认"确定"
 * @param {string} [props.cancelText] - 取消按钮文本，默认"取消"
 */
const ConfirmDialog = ({
    visible,
    message,
    onConfirm,
    onCancel,
    title = '需要确认',
    confirmText = '确定',
    cancelText = '取消'
}) => {
    if (!visible) return null;

    return (
        <div className="absolute inset-0 z-[100] bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-[var(--panel-bg)] border border-[var(--border)] rounded-lg shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-4">
                    <div className="flex items-center gap-3 mb-3 text-[var(--text-main)]">
                        <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600 shrink-0">
                            <ShieldAlert size={20} />
                        </div>
                        <div className="font-bold text-sm">{title}</div>
                    </div>
                    <p className="text-xs text-[var(--text-sub)] leading-relaxed">{message}</p>
                </div>
                <div className="bg-[var(--app-bg)] px-4 py-3 flex justify-end gap-2 border-t border-[var(--border)]">
                    <button
                        onClick={onCancel}
                        className="px-3 py-1.5 rounded text-xs font-bold text-[var(--text-sub)] hover:bg-[var(--hover-bg)] transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-3 py-1.5 rounded text-xs font-bold bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 transition-colors shadow-sm"
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;
