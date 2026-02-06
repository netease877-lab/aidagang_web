import React, { useState, useEffect, useCallback } from 'react';
import {
    MessageCircle, X, ChevronRight, Loader2,
    BookOpen, Send, Plus, Edit3, Trash2, Check, Copy, Settings2, RotateCcw
} from 'lucide-react';
import { useNovel } from '../../contexts/NovelContext';
import { useEntityStore, useSettingsStore, useEditorStore } from '../../stores';
import { DEFAULT_AI_CONFIG, DEFAULT_CHAT_AI_CONFIG, toChineseNum } from '../../constants';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '../../services/api';
import { collectChapters } from '../../utils/treeUtils';
import { cleanAiResponse } from '../../utils/aiResponseCleaner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

// ==================================================================
// 默认提示词模板
// ==================================================================
const DEFAULT_CHAT_PROMPTS = [
    { id: 'plot_analysis', name: '剧情分析', template: '请分析以下内容的剧情发展、人物动机和逻辑合理性。' },
    { id: 'writing_improve', name: '写作优化', template: '请对以下内容进行润色优化，保持原意的同时提升表达效果。' },
    { id: 'foreshadowing', name: '伏笔检查', template: '请检查以下内容中的伏笔是否已经回收，是否存在未解之谜。' },
    { id: 'character_check', name: '人设检查', template: '请检查以下内容中角色的言行是否符合其人设，有无OOC问题。' }
];


// ==================================================================
// 子组件：提示词管理面板
// ==================================================================
const PromptManager = ({ prompts, onAdd, onEdit, onDelete, onRestore, onClose }) => {
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', template: '' });
    const [isAdding, setIsAdding] = useState(false);

    const handleStartEdit = (prompt) => {
        setEditingId(prompt.id);
        setEditForm({ name: prompt.name, template: prompt.template });
    };

    const handleSaveEdit = () => {
        if (editingId && editForm.name) {
            onEdit(editingId, editForm);
            setEditingId(null);
            setEditForm({ name: '', template: '' });
        }
    };

    const handleAddNew = () => {
        if (editForm.name) {
            onAdd(editForm);
            setIsAdding(false);
            setEditForm({ name: '', template: '' });
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute inset-0 bg-[var(--panel-bg)] z-20 flex flex-col"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                <button onClick={onClose} className="flex items-center gap-1 text-sm text-[var(--text-sub)] hover:text-[var(--text-main)]">
                    <ChevronRight size={16} className="rotate-180" /> 返回
                </button>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onRestore}
                        className="p-1.5 rounded-full hover:bg-[var(--hover-bg)] text-[var(--text-sub)]"
                        title="恢复默认提示词"
                    >
                        <RotateCcw size={16} />
                    </button>
                    <h3 className="font-bold text-[var(--text-main)]">管理提示词</h3>
                </div>
                <button
                    onClick={() => setIsAdding(true)}
                    className="p-1.5 rounded-full bg-[var(--accent)] text-white hover:bg-[var(--accent)]/80"
                >
                    <Plus size={16} />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {/* 新增表单 */}
                {isAdding && (
                    <div className="p-3 rounded-lg border border-[var(--accent)] bg-[var(--accent)]/5 space-y-2">
                        <input
                            type="text"
                            placeholder="提示词名称"
                            className="w-full px-3 py-2 text-sm rounded border border-[var(--border)] bg-[var(--panel-bg)]"
                            value={editForm.name}
                            onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                        />
                        <textarea
                            placeholder="提示词内容..."
                            className="w-full px-3 py-2 text-sm rounded border border-[var(--border)] bg-[var(--panel-bg)] h-20 resize-none"
                            value={editForm.template}
                            onChange={(e) => setEditForm(prev => ({ ...prev, template: e.target.value }))}
                        />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => { setIsAdding(false); setEditForm({ name: '', template: '' }); }} className="px-3 py-1 text-xs text-[var(--text-sub)]">取消</button>
                            <button onClick={handleAddNew} className="px-3 py-1 text-xs bg-[var(--accent)] text-white rounded">保存</button>
                        </div>
                    </div>
                )}

                {/* 提示词列表 */}
                {prompts.map(prompt => (
                    <div key={prompt.id} className="p-3 rounded-lg border border-[var(--border)] hover:bg-[var(--hover-bg)] transition-colors">
                        {editingId === prompt.id ? (
                            <div className="space-y-2">
                                <input
                                    type="text"
                                    className="w-full px-2 py-1 text-sm rounded border border-[var(--border)] bg-[var(--panel-bg)]"
                                    value={editForm.name}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                />
                                <textarea
                                    className="w-full px-2 py-1 text-sm rounded border border-[var(--border)] bg-[var(--panel-bg)] h-16 resize-none"
                                    value={editForm.template}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, template: e.target.value }))}
                                />
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => setEditingId(null)} className="px-2 py-1 text-xs text-[var(--text-sub)]">取消</button>
                                    <button onClick={handleSaveEdit} className="px-2 py-1 text-xs bg-[var(--accent)] text-white rounded">保存</button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm text-[var(--text-main)]">{prompt.name}</div>
                                    <div className="text-xs text-[var(--text-sub)] truncate">{prompt.template || '(无内容)'}</div>
                                </div>
                                <div className="flex gap-1 ml-2">
                                    <button onClick={() => handleStartEdit(prompt)} className="p-1 hover:bg-[var(--hover-bg)] rounded" title="编辑">
                                        <Edit3 size={14} className="text-[var(--text-sub)]" />
                                    </button>
                                    {!prompt.isDefault && (
                                        <button onClick={() => onDelete(prompt.id)} className="p-1 hover:bg-red-100 rounded" title="删除" disabled={prompts.length <= 1}>
                                            <Trash2 size={14} className={`text-red-400 ${prompts.length <= 1 ? 'opacity-50 cursor-not-allowed' : ''}`} />
                                        </button>
                                    )}
                                    {prompt.isDefault && (
                                        <button onClick={() => onDelete(prompt.id)} className="p-1 hover:bg-red-100 rounded" title="删除" disabled={prompts.length <= 1}>
                                            <Trash2 size={14} className={`text-red-400 ${prompts.length <= 1 ? 'opacity-50 cursor-not-allowed' : ''}`} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </motion.div>
    );
};

// ==================================================================
// 子组件：AI 结果弹窗
// ==================================================================
const AiResultModal = ({ isOpen, onClose, content, title = "AI 回复" }) => {
    const handleCopy = () => {
        navigator.clipboard.writeText(content);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        className="bg-[var(--panel-bg)] w-full max-w-2xl max-h-[80vh] rounded-xl shadow-2xl flex flex-col border border-[var(--border)] overflow-hidden relative z-20"
                    >
                        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                            <h3 className="font-bold text-[var(--text-main)] flex items-center gap-2">
                                <MessageCircle size={18} className="text-purple-500" />
                                {title}
                            </h3>
                            <div className="flex items-center gap-2">
                                <button onClick={handleCopy} className="p-1.5 hover:bg-[var(--hover-bg)] rounded text-[var(--text-sub)]" title="复制内容">
                                    <Copy size={16} />
                                </button>
                                <button onClick={onClose} className="p-1.5 hover:bg-[var(--hover-bg)] rounded text-[var(--text-sub)]">
                                    <X size={18} />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                            <div className="prose prose-sm dark:prose-invert max-w-none text-[var(--text-main)]">
                                <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                                    {(() => {
                                        // [Smart Format] 智能预处理：强制修复 AI 返回的糟糕排版
                                        let text = content || '';

                                        // 1. 列表修复： "句号/问号/叹号" + (可选空格) + "数字." -> 强制换行
                                        // 例: "不好。1. 为什么" -> "不好。\n\n1. 为什么"
                                        text = text.replace(/([。！？])\s*(\d+\.)/g, '$1\n\n$2');

                                        // 2. 关键词修复： "总结：" 前强制换行
                                        text = text.replace(/([。！？])\s*(总结：|综上：)/g, '$1\n\n**$2**');

                                        // 3. 列表项粘连修复 (针对 Markdown 列表 "- " 或 "* ")
                                        text = text.replace(/([^\n])\n(\d+\.|-|\*)\s/g, '$1\n\n$2 ');

                                        return text;
                                    })()}
                                </ReactMarkdown>
                            </div>
                        </div>
                        <div className="p-4 border-t border-[var(--border)] flex justify-end">
                            <button onClick={onClose} className="px-6 py-2 bg-[var(--accent)] text-white rounded-lg font-bold text-sm hover:bg-[var(--accent)]/90">
                                关闭
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

// ==================================================================
// 主组件：AI 对话弹窗
// ==================================================================
const AiChatModal = ({
    isOpen,
    onClose,
    getStorageKey,
    onFetchContext,
    permissions = {}
}) => {
    // Stores
    const { data: novelData } = useEntityStore();
    const storeAiConfig = useSettingsStore(state => state.aiConfig);
    const storeChatAiConfig = useSettingsStore(state => state.chatAiConfig);
    const storeChapterNumStyle = useSettingsStore(state => state.chapterNumStyle);
    const nodeIndexMap = useEditorStore(state => state.nodeIndexMap) || {};
    const baseConfig = storeAiConfig || DEFAULT_AI_CONFIG;
    const chatConfig = storeChatAiConfig || DEFAULT_CHAT_AI_CONFIG;
    const chapterNumStyle = storeChapterNumStyle || 'chinese';

    // States
    const [rangeMode, setRangeMode] = useState('full'); // 'full' | 'range'
    const [startChapter, setStartChapter] = useState(1);
    const [endChapter, setEndChapter] = useState(1);
    const [selectedPromptId, setSelectedPromptId] = useState('plot_analysis');
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState('');
    const [error, setError] = useState('');
    const [showPromptManager, setShowPromptManager] = useState(false);
    const [showResultModal, setShowResultModal] = useState(false); // [新增]
    const [customPrompts, setCustomPrompts] = useState([]);
    // [Refactor] 使用 Store 管理已删除的默认提示词 (支持云同步)
    const storeDeletedDefaultIds = useSettingsStore(state => state.chatDeletedDefaultIds) || [];
    const setStoreDeletedDefaultIds = useSettingsStore(state => state.setChatDeletedDefaultIds);
    const [expandedVolumes, setExpandedVolumes] = useState({});

    // 合并默认和自定义提示词
    const allPrompts = [...DEFAULT_CHAT_PROMPTS.filter(p => !storeDeletedDefaultIds.includes(p.id)).map(p => ({ ...p, isDefault: true })), ...customPrompts];
    const selectedPrompt = allPrompts.find(p => p.id === selectedPromptId) || allPrompts[0];


    // 计算章节总数
    const getAllChapters = useCallback(() => {
        return collectChapters(novelData, nodeIndexMap);
    }, [novelData, nodeIndexMap]);

    const totalChapters = getAllChapters().length;

    // 加载提示词 & 迁移本地旧数据
    useEffect(() => {
        if (!isOpen) return;
        loadPrompts();

        // [Migration] 迁移旧的 localStorage 数据到 Store (仅一次)
        const legacyKey = getStorageKey('ai_chat_deleted_defaults');
        const legacyDeleted = localStorage.getItem(legacyKey);

        if (legacyDeleted) {
            try {
                const parsed = JSON.parse(legacyDeleted);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    // 合并到 Store (去重)
                    const merged = Array.from(new Set([...storeDeletedDefaultIds, ...parsed]));
                    setStoreDeletedDefaultIds(merged);
                    // 同步到云端
                    apiClient.put('/api/user/me', {
                        config: { chatDeletedDefaultIds: merged }
                    }).catch(err => console.error('Failed to sync migration:', err));

                    // 清除旧数据
                    localStorage.removeItem(legacyKey);
                }
            } catch (e) {
                console.warn('Failed to migrate legacy deleted defaults:', e);
            }
        }
        // 重置到章节数范围
        const total = getAllChapters().length;
        if (total > 0) {
            setEndChapter(total);
        }
    }, [isOpen, getAllChapters, storeDeletedDefaultIds, setStoreDeletedDefaultIds, getStorageKey]);

    const loadPrompts = async () => {
        try {
            const response = await apiClient.get('/api/ai-chat-prompts');
            if (response.data) {
                setCustomPrompts(response.data.map(p => ({
                    ...p,
                    isDefault: false
                })));
            }
        } catch (e) {
            console.warn('Failed to load prompts:', e);
            // 从本地加载
            const local = localStorage.getItem(getStorageKey('ai_chat_prompts'));
            if (local) {
                try {
                    setCustomPrompts(JSON.parse(local).map(p => ({ ...p, isDefault: false })));
                } catch (err) { }
            }
        }

        // Deleted defaults (Legacy local load removed, now handled by Store persistence)
        // const deletedDefaults = localStorage.getItem(getStorageKey('ai_chat_deleted_defaults'));
        // if (deletedDefaults) {
        //     try {
        //         setDeletedDefaultIds(JSON.parse(deletedDefaults));
        //     } catch (err) { }
        // }
    };

    const handleAddPrompt = async (data) => {
        try {
            const response = await apiClient.post('/api/ai-chat-prompts', data);
            if (response.data) {
                setCustomPrompts(prev => [...prev, { ...response.data, isDefault: false }]);
            }
        } catch (e) {
            console.error('Failed to add prompt:', e);
            // 本地保存
            const newPrompt = { ...data, id: `local_${Date.now()}`, isDefault: false };
            setCustomPrompts(prev => {
                const updated = [...prev, newPrompt];
                localStorage.setItem(getStorageKey('ai_chat_prompts'), JSON.stringify(updated));
                return updated;
            });
        }
    };

    const handleEditPrompt = async (id, data) => {
        try {
            await apiClient.patch(`/api/ai-chat-prompts/${id}`, data);
            setCustomPrompts(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
        } catch (e) {
            console.error('Failed to edit prompt:', e);
            setCustomPrompts(prev => {
                const updated = prev.map(p => p.id === id ? { ...p, ...data } : p);
                localStorage.setItem(getStorageKey('ai_chat_prompts'), JSON.stringify(updated));
                return updated;
            });
        }
    };

    const handleDeletePrompt = async (id) => {
        // 1. 如果是默认提示词，仅本地通过 deletedDefaultIds 隐藏
        // 1. 如果是默认提示词，加入 Store 并同步到云端
        if (DEFAULT_CHAT_PROMPTS.some(p => p.id === id)) {
            const updated = [...storeDeletedDefaultIds, id];
            setStoreDeletedDefaultIds(updated);

            // Cloud Sync
            apiClient.put('/api/user/me', {
                config: { chatDeletedDefaultIds: updated }
            }).catch(e => console.error('Sync failed:', e));
            return;
        }

        // 2. 如果是自定义提示词，调用 API 删除
        try {
            await apiClient.delete(`/api/ai-chat-prompts/${id}`);
            setCustomPrompts(prev => prev.filter(p => p.id !== id));
        } catch (e) {
            console.error('Failed to delete prompt:', e);
            setCustomPrompts(prev => {
                const updated = prev.filter(p => p.id !== id);
                localStorage.setItem(getStorageKey('ai_chat_prompts'), JSON.stringify(updated));
                return updated;
            });
        }
    };

    const handleRestoreDefaults = () => {
        if (confirm('确定要恢复所有默认提示词吗？')) {
            setStoreDeletedDefaultIds([]);
            // Cloud Sync
            apiClient.put('/api/user/me', {
                config: { chatDeletedDefaultIds: [] }
            }).catch(e => console.error('Sync failed:', e));
        }
    };

    // 生成内容
    const handleGenerate = async () => {
        if (!baseConfig.apiKey) {
            setError("请先在设置中配置 AI API Key");
            return;
        }

        if (!userInput.trim()) {
            setError("请输入您的问题或目的");
            return;
        }

        setIsLoading(true);
        setError('');
        setResult('');

        try {
            // [修复] 使用统一的上下文获取逻辑
            let content = '';

            if (onFetchContext) {
                if (rangeMode === 'full') {
                    content = onFetchContext(null, 'full');
                } else {
                    content = onFetchContext(null, 'custom_range', {
                        start: parseInt(startChapter),
                        end: parseInt(endChapter)
                    });
                }
            }

            if (!content) {
                setError("未获取到有效内容，请检查章节范围或细纲");
                setIsLoading(false);
                return;
            }

            // 构建 Prompt
            const promptTemplate = selectedPrompt?.template || '';
            const fullPrompt = `${promptTemplate}

【目的】
${userInput}

【小说内容】
${content}`;

            // 选择模型
            let targetModel = chatConfig.model || baseConfig.models?.[0]?.id || 'gpt-3.5-turbo';

            const response = await apiClient.post('/api/ai/generate', {
                apiKey: baseConfig.apiKey,
                baseUrl: baseConfig.baseUrl,
                model: targetModel,
                timeout: baseConfig.timeout || 120,
                messages: [{ role: 'user', content: fullPrompt }]
            });

            if (response?.data) {
                let text = '';
                const rawData = response.data;

                // [优化] 使用统一的清洗工具
                const formatParsedData = (data) => {
                    if (typeof data === 'string') return data;
                    if (Array.isArray(data)) {
                        return data.map(item => {
                            if (typeof item === 'object' && item?.content) return item.content;
                            return typeof item === 'string' ? item : JSON.stringify(item);
                        }).join('\n\n');
                    }
                    if (typeof data === 'object' && data !== null) {
                        if (data.content) return data.content;
                        if (data.message?.content) return data.message.content;
                        return JSON.stringify(data, null, 2);
                    }
                    return String(data);
                };

                // 如果是字符串，尝试清洗解析
                if (typeof rawData === 'string') {
                    const cleanResult = cleanAiResponse(rawData);
                    if (cleanResult.success) {
                        text = formatParsedData(cleanResult.data);
                    } else {
                        // 清洗失败（可能本身就是纯文本），直接使用处理后的文本（去除BOM等）
                        // cleanAiResponse 即使失败也会返回 raw (可能经过部分处理)
                        text = cleanResult.raw || rawData;

                        // 额外的纯文本清理 (处理转义换行)
                        if (typeof text === 'string') {
                            text = text.replace(/\\n/g, '\n').replace(/\\"/g, '"');
                            if (text.startsWith('"') && text.endsWith('"')) text = text.slice(1, -1);
                        }
                    }
                } else {
                    // 已经是对象/数组
                    text = formatParsedData(rawData);
                }

                setResult(text);
                setShowResultModal(true); // 打开结果弹 window
            } else {
                throw new Error('AI 返回数据格式异常');
            }
        } catch (e) {
            console.error('AI Chat failed:', e);
            let errMsg = e.message || '未知错误';
            if (errMsg.includes('timeout') || errMsg.includes('Timeout')) {
                errMsg = '⏱️ AI 请求超时，请尝试减少章节范围或增加超时时间';
            }
            setError(errMsg);
        } finally {
            setIsLoading(false);
        }
    };

    // 复制结果
    const handleCopy = () => {
        navigator.clipboard.writeText(result);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        className="bg-[var(--panel-bg)] w-full max-w-2xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col border border-[var(--border)] overflow-hidden relative z-10"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                            <div className="flex items-center gap-2 text-[var(--text-main)]">
                                <MessageCircle size={18} className="text-purple-500" />
                                <h2 className="text-base font-bold">AI 对话</h2>
                            </div>
                            <button onClick={onClose} className="p-1.5 hover:bg-black/5 rounded-full text-[var(--text-sub)]">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {/* 1. 章节范围选择 */}
                            <div>
                                <h3 className="text-sm font-bold text-[var(--text-sub)] mb-2 flex items-center gap-2">
                                    <BookOpen size={14} /> 选择范围
                                </h3>
                                <div className="flex gap-2 flex-wrap">
                                    <label className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-all ${rangeMode === 'full' ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]' : 'border-[var(--border)] hover:bg-[var(--hover-bg)]'}`}>
                                        <input type="radio" name="range" checked={rangeMode === 'full'} onChange={() => setRangeMode('full')} className="accent-[var(--accent)]" />
                                        <span>全书 ({totalChapters}章)</span>
                                    </label>
                                    <label className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-all ${rangeMode === 'range' ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]' : 'border-[var(--border)] hover:bg-[var(--hover-bg)]'}`}>
                                        <input type="radio" name="range" checked={rangeMode === 'range'} onChange={() => setRangeMode('range')} className="accent-[var(--accent)]" />
                                        <span>自定义范围</span>
                                    </label>
                                </div>

                                {rangeMode === 'range' && (
                                    <div className="mt-2 flex items-center gap-2 text-sm">
                                        <span className="text-[var(--text-sub)]">从第</span>
                                        <input
                                            type="number"
                                            min={1}
                                            max={totalChapters}
                                            value={startChapter}
                                            onChange={(e) => setStartChapter(e.target.value)}
                                            onBlur={() => {
                                                let val = parseInt(startChapter);
                                                if (isNaN(val) || val < 1) val = 1;
                                                if (val > totalChapters) val = totalChapters;
                                                setStartChapter(val);
                                                // [Fix] 保证 Start <= End
                                                if (val > parseInt(endChapter)) {
                                                    setEndChapter(val);
                                                }
                                            }}
                                            className="w-16 px-2 py-1 border border-[var(--border)] rounded text-center bg-[var(--panel-bg)]"
                                        />
                                        <span className="text-[var(--text-sub)]">章 到 第</span>
                                        <input
                                            type="number"
                                            min={1}
                                            max={totalChapters}
                                            value={endChapter}
                                            onChange={(e) => setEndChapter(e.target.value)}
                                            onBlur={() => {
                                                let val = parseInt(endChapter);
                                                if (isNaN(val) || val < 1) val = 1;
                                                if (val > totalChapters) val = totalChapters;
                                                setEndChapter(val);
                                                // [Fix] 保证 End >= Start
                                                if (val < parseInt(startChapter)) {
                                                    setStartChapter(val);
                                                }
                                            }}
                                            className="w-16 px-2 py-1 border border-[var(--border)] rounded text-center bg-[var(--panel-bg)]"
                                        />
                                        <span className="text-[var(--text-sub)]">章</span>
                                    </div>
                                )}
                            </div>

                            {/* 2. 提示词选择 */}
                            <div>
                                <h3 className="text-sm font-bold text-[var(--text-sub)] mb-2 flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                        <Settings2 size={14} /> 选择提示词
                                    </span>
                                    <button
                                        onClick={() => setShowPromptManager(true)}
                                        className="text-xs px-2 py-1 rounded bg-[var(--hover-bg)] hover:bg-[var(--border)] text-[var(--text-sub)]"
                                    >
                                        编辑提示词
                                    </button>
                                </h3>
                                <div className="flex gap-2 flex-wrap">
                                    {allPrompts.map(prompt => (
                                        <button
                                            key={prompt.id}
                                            onClick={() => setSelectedPromptId(prompt.id)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${selectedPromptId === prompt.id
                                                ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                                                : 'border-[var(--border)] hover:bg-[var(--hover-bg)] text-[var(--text-main)]'
                                                }`}
                                        >
                                            {prompt.name}
                                        </button>
                                    ))}
                                </div>
                                {selectedPrompt?.template && (
                                    <div className="mt-2 p-2 bg-[var(--hover-bg)] rounded text-xs text-[var(--text-sub)]">
                                        {selectedPrompt.template}
                                    </div>
                                )}
                            </div>

                            {/* 3. 用户输入 */}
                            <div>
                                <h3 className="text-sm font-bold text-[var(--text-sub)] mb-2">目的 / 问题</h3>
                                <textarea
                                    value={userInput}
                                    onChange={(e) => setUserInput(e.target.value)}
                                    placeholder="输入您希望AI帮助解决的问题或目的..."
                                    className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--panel-bg)] text-sm text-[var(--text-main)] resize-none h-24 focus:outline-none focus:border-[var(--accent)]"
                                />
                            </div>

                            {/* 错误提示 */}
                            {error && (
                                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                                    {error}
                                </div>
                            )}

                            {/* 结果显示 (已移除，改为单独弹窗) */}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-[var(--border)] flex justify-end gap-3">
                            <button onClick={onClose} className="px-4 py-2 text-sm text-[var(--text-sub)] hover:bg-[var(--hover-bg)] rounded-lg">
                                取消
                            </button>
                            <button
                                onClick={handleGenerate}
                                disabled={isLoading}
                                className="px-6 py-2 bg-purple-500 text-white rounded-lg text-sm font-bold hover:bg-purple-600 disabled:opacity-50 flex items-center gap-2"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        处理中...
                                    </>
                                ) : (
                                    <>
                                        <Send size={16} />
                                        发送
                                    </>
                                )}
                            </button>
                        </div>

                        {/* 提示词管理面板 */}
                        <AnimatePresence>
                            {showPromptManager && (
                                <PromptManager
                                    prompts={allPrompts}
                                    onAdd={handleAddPrompt}
                                    onEdit={handleEditPrompt}
                                    onDelete={handleDeletePrompt}
                                    onRestore={handleRestoreDefaults}
                                    onClose={() => setShowPromptManager(false)}
                                />
                            )}
                        </AnimatePresence>

                        {/* AI 结果弹窗 */}
                        <AiResultModal
                            isOpen={showResultModal}
                            onClose={() => setShowResultModal(false)}
                            content={result}
                        />
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

AiChatModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    getStorageKey: PropTypes.func,
    onFetchContext: PropTypes.func,
    permissions: PropTypes.object
};

export default AiChatModal;
