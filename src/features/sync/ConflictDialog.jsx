// ==================================================
// File: frontend/src/components/ConflictDialog.jsx
// 数据冲突对比弹窗 - 支持逐项选择
// [重构] 完全重写以支持智能合并和逐项选择
// ==================================================
import React, { useState, useEffect } from 'react';
import { X, Monitor, Cloud, AlertTriangle, Check } from 'lucide-react';

/**
 * 冲突对比弹窗 - 逐项选择版本
 * @param {Object} props
 * @param {boolean} props.isOpen - 是否显示
 * @param {Array} props.conflicts - 冲突列表 [{type, id, path, local, server}, ...]
 * @param {Function} props.onMergeComplete - 合并完成回调，传入合并结果
 * @param {Function} props.onClose - 关闭弹窗
 */
const ConflictDialog = ({
    isOpen,
    conflicts = [],
    localVersion,
    serverVersion,
    onMergeComplete,
    onClose
}) => {
    // 每个冲突项的选择状态: 'local' | 'server'
    const [selections, setSelections] = useState({});

    // 初始化选择状态（默认选择本地）
    useEffect(() => {
        if (conflicts && conflicts.length > 0) {
            const initial = {};
            conflicts.forEach(c => {
                initial[c.id] = 'local'; // 默认选择本地
            });
            setSelections(initial);
        }
    }, [conflicts]);

    if (!isOpen || !conflicts || conflicts.length === 0) return null;

    // 切换单个项目的选择
    const toggleSelection = (id, value) => {
        setSelections(prev => ({ ...prev, [id]: value }));
    };

    // 全选本地
    const selectAllLocal = () => {
        const newSelections = {};
        conflicts.forEach(c => { newSelections[c.id] = 'local'; });
        setSelections(newSelections);
    };

    // 全选服务器
    const selectAllServer = () => {
        const newSelections = {};
        conflicts.forEach(c => { newSelections[c.id] = 'server'; });
        setSelections(newSelections);
    };

    // 确认合并
    const handleConfirmMerge = () => {
        onMergeComplete && onMergeComplete(selections);
    };

    // 渲染单个冲突项
    const renderConflictItem = (conflict, index) => {
        const isLocalSelected = selections[conflict.id] === 'local';
        const isServerSelected = selections[conflict.id] === 'server';

        // 获取显示内容
        const getDisplayContent = (data) => {
            if (!data) return '';

            // 大纲节点类型
            if (conflict.type === 'outline_node') {
                const parts = [];
                // [优化] 格式：标题 换行 内容
                if (data.title) parts.push(`标题: ${data.title}`);
                // 简介已移除，不再显示
                if (data.content) parts.push(`内容: ${data.content.substring(0, 150)}${data.content.length > 150 ? '...' : ''}`);
                return parts.join('\n');
            }

            // 角色/场景/设定类型
            if (typeof data === 'object') {
                const parts = [];
                if (data.name) parts.push(`名称: ${data.name}`);
                if (data.desc) parts.push(`描述: ${data.desc?.substring(0, 100)}${(data.desc?.length || 0) > 100 ? '...' : ''}`);
                return parts.join('\n');
            }

            return JSON.stringify(data).substring(0, 100);
        };

        const localContent = getDisplayContent(conflict.local);
        const serverContent = getDisplayContent(conflict.server);

        // 获取类型图标和名称
        const getTypeName = (type) => {
            switch (type) {
                case 'outline_node': return conflict.nodeType === 'volume' ? '📁 卷' : '📄 章节';
                case 'character': return '👤 角色';
                case 'scene': return '🎬 场景';
                case 'setting': return '🌍 设定';
                default: return '📝 数据';
            }
        };

        return (
            <div key={conflict.id} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden mb-4">
                {/* 冲突项标题 */}
                <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{getTypeName(conflict.type)}</span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">{conflict.path}</span>
                    </div>
                    <span className="text-xs text-gray-500">#{index + 1}</span>
                </div>

                {/* 左右对比区域 */}
                <div className="grid grid-cols-2 gap-0">
                    {/* 左侧 - 本地版本 */}
                    <div
                        className={`p-3 border-r border-gray-200 dark:border-gray-700 cursor-pointer transition-all ${isLocalSelected
                            ? 'bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-500 ring-inset'
                            : 'bg-white dark:bg-gray-800 hover:bg-blue-50/50 dark:hover:bg-blue-900/10'
                            }`}
                        onClick={() => toggleSelection(conflict.id, 'local')}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                                <Monitor size={14} />
                                <span className="text-xs font-bold">本地版本 (v{conflict.local?.version || '?'})</span>
                            </div>
                            {isLocalSelected && (
                                <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                                    <Check size={12} className="text-white" />
                                </div>
                            )}
                        </div>
                        <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                            {localContent || '(空)'}
                        </pre>
                    </div>

                    {/* 右侧 - 服务器版本 */}
                    <div
                        className={`p-3 cursor-pointer transition-all ${isServerSelected
                            ? 'bg-green-50 dark:bg-green-900/30 ring-2 ring-green-500 ring-inset'
                            : 'bg-white dark:bg-gray-800 hover:bg-green-50/50 dark:hover:bg-green-900/10'
                            }`}
                        onClick={() => toggleSelection(conflict.id, 'server')}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                                <Cloud size={14} />
                                <span className="text-xs font-bold">服务器版本 (v{conflict.server?.version || '?'})</span>
                            </div>
                            {isServerSelected && (
                                <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                                    <Check size={12} className="text-white" />
                                </div>
                            )}
                        </div>
                        <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                            {serverContent || '(空)'}
                        </pre>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
            {/* 遮罩层 */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* 弹窗内容 */}
            <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-[95vw] max-w-4xl max-h-[90vh] overflow-hidden animate-in zoom-in-95 fade-in duration-200 flex flex-col">
                {/* 标题栏 */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-amber-500 to-orange-500 flex-shrink-0">
                    <div className="flex items-center gap-3 text-white">
                        <AlertTriangle size={24} />
                        <div>
                            <h2 className="text-lg font-bold">检测到数据冲突</h2>
                            <p className="text-sm opacity-90">
                                共 {conflicts.length} 项冲突 | 本地版本: <span className="font-mono font-bold">{localVersion ?? '?'}</span> vs 服务器版本: <span className="font-mono font-bold">{serverVersion ?? '?'}</span>
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/20 rounded-full transition-colors text-white"
                        title="关闭"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* 快捷操作栏 */}
                <div className="flex items-center justify-center gap-4 px-6 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                    <button
                        onClick={selectAllLocal}
                        className="px-4 py-2 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/50 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                    >
                        <Monitor size={16} />
                        全部选择本地
                    </button>
                    <button
                        onClick={selectAllServer}
                        className="px-4 py-2 bg-green-100 hover:bg-green-200 dark:bg-green-900/50 dark:hover:bg-green-900 text-green-700 dark:text-green-300 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                    >
                        <Cloud size={16} />
                        全部选择服务器
                    </button>
                </div>

                {/* 冲突列表 */}
                <div className="flex-1 overflow-y-auto p-4">
                    {conflicts.map((conflict, index) => renderConflictItem(conflict, index))}
                </div>

                {/* 底部确认按钮 */}
                <div className="flex items-center justify-center gap-4 px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-medium transition-colors"
                    >
                        取消
                    </button>
                    <button
                        onClick={handleConfirmMerge}
                        className="px-8 py-2.5 bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white rounded-lg font-bold transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
                    >
                        <Check size={18} />
                        确认合并
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConflictDialog;
