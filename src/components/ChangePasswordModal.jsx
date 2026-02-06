// ==================================================
// File: frontend/src/components/ChangePasswordModal.jsx
// 修改用户密码对话框
// ==================================================
import React, { useState } from 'react';
import { X, Lock, Calendar, Eye, EyeOff } from 'lucide-react';
import { fetchAPI } from '../services/api';

export default function ChangePasswordModal({ isOpen, onClose, createdAt, addToast }) {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showOld, setShowOld] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const formatDate = (dateStr) => {
        if (!dateStr) return '未知';
        try {
            const date = new Date(dateStr);
            return date.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return dateStr;
        }
    };

    const handleSubmit = async () => {
        setError('');

        // 前端验证
        if (!oldPassword.trim()) {
            setError('请输入原密码');
            return;
        }
        if (!newPassword.trim()) {
            setError('请输入新密码');
            return;
        }
        if (newPassword.length < 6) {
            setError('新密码至少6位');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('两次输入的新密码不一致');
            return;
        }

        setLoading(true);
        try {
            const res = await fetchAPI('/api/users/me/password', 'PATCH', {
                old_password: oldPassword,
                new_password: newPassword
            });

            if (res?.error || res?.detail) {
                throw new Error(res.detail || res.error || '修改失败');
            }

            addToast?.('密码修改成功，即将退出登录...', 'success');
            handleClose();
            // 延迟后自动退出登录
            setTimeout(() => {
                localStorage.removeItem('novel_token');
                window.location.reload();
            }, 1500);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setError('');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[var(--panel-bg)] w-80 rounded-xl shadow-2xl border border-[var(--border)] p-6 animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="font-bold text-[var(--text-main)] text-lg">修改密码</h2>
                    <button onClick={handleClose} className="p-1 hover:bg-[var(--hover-bg)] rounded-full transition">
                        <X size={20} className="text-[var(--text-sub)]" />
                    </button>
                </div>

                <div className="space-y-4">
                    {/* 注册时间 */}
                    <div className="flex items-center gap-2 p-3 bg-[var(--app-bg)] rounded-lg border border-[var(--border)]">
                        <Calendar size={16} className="text-[var(--accent)]" />
                        <div>
                            <div className="text-[10px] text-[var(--text-sub)]">注册时间</div>
                            <div className="text-sm font-bold text-[var(--text-main)]">{formatDate(createdAt)}</div>
                        </div>
                    </div>

                    {/* 原密码 */}
                    <div className="relative">
                        <Lock size={16} className="absolute left-3 top-3 text-[var(--text-sub)]" />
                        <input
                            type={showOld ? 'text' : 'password'}
                            className="w-full pl-9 pr-10 p-2.5 rounded-lg border border-[var(--border)] bg-[var(--app-bg)] text-[var(--text-main)] text-sm outline-none focus:border-[var(--accent)] transition-colors"
                            placeholder="原密码"
                            value={oldPassword}
                            onChange={e => setOldPassword(e.target.value)}
                            autoFocus
                        />
                        <button
                            type="button"
                            tabIndex="-1"
                            onClick={() => setShowOld(!showOld)}
                            className="absolute right-3 top-3 text-[var(--text-sub)] hover:text-[var(--text-main)]"
                        >
                            {showOld ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>

                    {/* 新密码 */}
                    <div className="relative">
                        <Lock size={16} className="absolute left-3 top-3 text-[var(--text-sub)]" />
                        <input
                            type={showNew ? 'text' : 'password'}
                            className="w-full pl-9 pr-10 p-2.5 rounded-lg border border-[var(--border)] bg-[var(--app-bg)] text-[var(--text-main)] text-sm outline-none focus:border-[var(--accent)] transition-colors"
                            placeholder="新密码（至少6位）"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                        />
                        <button
                            type="button"
                            tabIndex="-1"
                            onClick={() => setShowNew(!showNew)}
                            className="absolute right-3 top-3 text-[var(--text-sub)] hover:text-[var(--text-main)]"
                        >
                            {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>

                    {/* 确认新密码 */}
                    <div className="relative">
                        <Lock size={16} className="absolute left-3 top-3 text-[var(--text-sub)]" />
                        <input
                            type={showConfirm ? 'text' : 'password'}
                            className="w-full pl-9 pr-10 p-2.5 rounded-lg border border-[var(--border)] bg-[var(--app-bg)] text-[var(--text-main)] text-sm outline-none focus:border-[var(--accent)] transition-colors"
                            placeholder="再次输入新密码"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                        />
                        <button
                            type="button"
                            tabIndex="-1"
                            onClick={() => setShowConfirm(!showConfirm)}
                            className="absolute right-3 top-3 text-[var(--text-sub)] hover:text-[var(--text-main)]"
                        >
                            {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>

                    {/* 错误提示 */}
                    {error && (
                        <div className="text-red-500 text-xs bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-100 dark:border-red-900/30 flex items-start gap-1">
                            <span className="shrink-0">⚠️</span> <span>{error}</span>
                        </div>
                    )}

                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="w-full py-2.5 bg-[var(--accent)] text-white rounded-lg font-bold text-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 shadow-md shadow-[var(--accent)]/20"
                    >
                        {loading ? '处理中...' : '确认修改'}
                    </button>
                </div>
            </div>
        </div>
    );
}
