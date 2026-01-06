// ==================================================
// File: frontend/src/components/OperationLogPanel.jsx
// 操作日志查看面板 - 在设置页中显示历史操作记录
// ==================================================
import React, { useState } from 'react';
import { History, Trash2, ChevronDown, ChevronUp, X, Plus, Edit2, Move, RefreshCw } from 'lucide-react';

/**
 * 操作日志面板
 * @param {Object} props
 * @param {boolean} props.isOpen - 是否显示
 * @param {Function} props.onClose - 关闭面板
 * @param {Array} props.logs - 格式化后的日志列表
 * @param {Function} props.onClear - 清空日志
 * @param {number} props.logCount - 日志总数
 */
const OperationLogPanel = ({
    isOpen,
    onClose,
    logs = [],
    onClear,
    logCount = 0
}) => {
    const [expandedId, setExpandedId] = useState(null);

    if (!isOpen) return null;

    // 操作类型图标
    const getTypeIcon = (type) => {
        switch (type) {
            case 'create': return <Plus size={14} className="text-green-500" />;
            case 'update': return <Edit2 size={14} className="text-blue-500" />;
            case 'delete': return <Trash2 size={14} className="text-red-500" />;
            case 'move': return <Move size={14} className="text-purple-500" />;
            case 'sync': return <RefreshCw size={14} className="text-amber-500" />;
            default: return <History size={14} className="text-gray-500" />;
        }
    };

    // 操作类型背景色
    const getTypeBg = (type) => {
        switch (type) {
            case 'create': return 'bg-green-50 dark:bg-green-900/20';
            case 'update': return 'bg-blue-50 dark:bg-blue-900/20';
            case 'delete': return 'bg-red-50 dark:bg-red-900/20';
            case 'move': return 'bg-purple-50 dark:bg-purple-900/20';
            case 'sync': return 'bg-amber-50 dark:bg-amber-900/20';
            default: return 'bg-gray-50 dark:bg-gray-800';
        }
    };

    return (
        <div className="fixed inset-0 z-[250] flex items-center justify-center">
            {/* 遮罩层 */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* 弹窗内容 */}
            <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-[90vw] max-w-2xl max-h-[80vh] overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200 flex flex-col">
                {/* 标题栏 */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-indigo-500 to-purple-500 shrink-0">
                    <div className="flex items-center gap-3 text-white">
                        <History size={24} />
                        <div>
                            <h2 className="text-lg font-bold">操作日志</h2>
                            <p className="text-sm opacity-90">最近 {logCount} 条操作记录</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {logCount > 0 && (
                            <button
                                onClick={() => {
                                    if (confirm('确定要清空所有操作日志吗？')) {
                                        onClear?.();
                                    }
                                }}
                                className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm font-medium transition-colors flex items-center gap-1"
                            >
                                <Trash2 size={14} />
                                清空
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-full transition-colors text-white"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* 日志列表 */}
                <div className="flex-1 overflow-y-auto p-4">
                    {logs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                            <History size={48} className="opacity-30 mb-4" />
                            <p className="text-lg font-medium">暂无操作记录</p>
                            <p className="text-sm">您的编辑操作将记录在这里</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {logs.map((log) => (
                                <div
                                    key={log.id}
                                    className={`rounded-lg border border-gray-100 dark:border-gray-700 overflow-hidden ${getTypeBg(log.type)}`}
                                >
                                    <div
                                        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                        onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                                    >
                                        {/* 图标 */}
                                        <div className="w-8 h-8 rounded-full bg-white dark:bg-gray-700 flex items-center justify-center shadow-sm">
                                            {getTypeIcon(log.type)}
                                        </div>

                                        {/* 内容 */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start gap-2 flex-wrap">
                                                <span className="text-xs font-medium px-2 py-0.5 rounded bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 shrink-0">
                                                    {log.typeLabel}
                                                </span>
                                                {/* [修复] 移除 truncate，允许换行显示 */}
                                                <span className="font-medium text-gray-800 dark:text-gray-200 break-all">
                                                    {log.target}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                {log.formattedTime}
                                            </p>
                                        </div>

                                        {/* 展开箭头 */}
                                        {log.detail && (
                                            <div className="text-gray-400">
                                                {expandedId === log.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                            </div>
                                        )}
                                    </div>

                                    {/* 展开详情 */}
                                    {expandedId === log.id && log.detail && (
                                        <div className="px-4 py-3 bg-white/50 dark:bg-black/20 border-t border-gray-100 dark:border-gray-700">
                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                {log.detail}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 底部统计 */}
                <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shrink-0">
                    <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                        💡 日志仅保存在本地，最多保留 100 条记录
                    </p>
                </div>
            </div>
        </div>
    );
};

export default OperationLogPanel;
