import React, { useState } from 'react';
import { ArrowLeft, Sparkles, X, Edit3, ArrowDown, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- 子组件：结果展示独立弹窗 ---
const ChapterResultModal = ({ isOpen, onClose, onCloseAll, ideas, setIdeas, rawContent, isGenerating, onInsertContent, activeChapter }) => {
    const [copiedIndex, setCopiedIndex] = useState(null);

    const handleCopy = async (text, idx) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedIndex(idx);
            setTimeout(() => setCopiedIndex(null), 2000);
        } catch (err) {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            setCopiedIndex(idx);
            setTimeout(() => setCopiedIndex(null), 2000);
        }
    };

    const handleContentChange = (idx, newContent) => {
        const newIdeas = [...ideas];
        newIdeas[idx] = { ...newIdeas[idx], content: newContent };
        setIdeas(newIdeas);
    };

    const adjustHeight = (e) => {
        if (!e.target) return;
        e.target.style.height = 'auto';
        e.target.style.height = e.target.scrollHeight + 'px';
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={onClose}
                    />
                    {/* [核心适配] 宽度改为响应式 w-[95%] max-w-[900px], 高度改为 dvh */}
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        transition={{ duration: 0.2 }}
                        className="bg-[var(--panel-bg)] w-[95%] max-w-[900px] h-[85dvh] rounded-xl shadow-2xl border border-[var(--border)] flex flex-col overflow-hidden relative z-10"
                    >
                        {/* Header */}
                        <div className="flex justify-between items-center px-5 py-4 border-b border-[var(--border)] bg-[var(--app-bg)] shrink-0">
                            <button onClick={onClose} className="flex items-center gap-1 text-sm text-[var(--text-sub)] hover:text-[var(--text-main)] transition-colors">
                                <ArrowLeft size={16} /> 返回编辑
                            </button>
                            <h3 className="font-bold text-[var(--text-main)] flex items-center gap-2 absolute left-1/2 -translate-x-1/2">
                                <Sparkles size={18} className="text-yellow-500" /> 生成结果
                                {activeChapter && (
                                    <span className="text-sm font-normal text-[var(--text-sub)] ml-2 border-l border-[var(--border)] pl-2">
                                        {activeChapter.index ? `第${activeChapter.index}章 ` : ''}{activeChapter.title}
                                    </span>
                                )}
                            </h3>
                            <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-[var(--hover-bg)] text-[var(--text-sub)] flex items-center justify-center transition">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-[var(--panel-bg)]">
                            {ideas.length > 0 ? (
                                <div className="space-y-6">
                                    {ideas.map((idea, idx) => (
                                        <div key={idx} className="bg-[var(--app-bg)] rounded-xl border-l-4 border-[var(--accent)] shadow-sm hover:shadow-md transition-all duration-300">
                                            <div className="flex justify-between items-center p-3 border-b border-[var(--border)] bg-[var(--app-bg)]/50 rounded-t-xl">
                                                <div className="flex items-center gap-2">
                                                    <span className="bg-[var(--accent-bg)] text-[var(--accent)] px-2 py-0.5 rounded text-xs font-bold border border-[var(--accent)]/30">
                                                        {idea.type || `方案 ${idx + 1}`}
                                                    </span>
                                                    <span className="text-[10px] text-[var(--text-sub)] flex items-center gap-1 opacity-60">
                                                        <Edit3 size={10} /> 可编辑
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => { if (onInsertContent) { onInsertContent(idea.content); if (onCloseAll) onCloseAll(); } }} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-[var(--panel-bg)] border border-[var(--border)] text-[var(--text-main)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all" title="插入到细纲正文">
                                                        <ArrowDown size={12} /> 插入
                                                    </button>
                                                    <button onClick={() => handleCopy(idea.content, idx)} className="text-[var(--text-sub)] hover:text-[var(--accent)] p-1.5 rounded hover:bg-[var(--hover-bg)]">
                                                        {copiedIndex === idx ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                                                    </button>
                                                </div>
                                            </div>
                                            <textarea
                                                className="w-full p-4 text-sm text-[var(--text-main)] leading-relaxed font-mono bg-transparent border-none outline-none resize-none overflow-hidden focus:bg-[var(--panel-bg)] transition-colors"
                                                value={idea.content}
                                                onChange={(e) => { handleContentChange(idx, e.target.value); adjustHeight(e); }}
                                                onFocus={adjustHeight}
                                                ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                                                spellCheck={false}
                                            />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="bg-[var(--app-bg)] rounded-xl border border-[var(--border)] shadow-sm relative group">
                                    <div className="flex justify-between items-center p-2 border-b border-[var(--border)] bg-[var(--hover-bg)]/50">
                                        <span className="text-xs font-bold text-red-500 flex items-center gap-1">⚠️ 格式解析失败，显示原始文本</span>
                                        <button onClick={() => handleCopy(rawContent, 'raw')} className="text-[var(--text-sub)] hover:text-[var(--accent)] p-1.5 rounded hover:bg-[var(--hover-bg)]" title="复制全部">
                                            {copiedIndex === 'raw' ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                                        </button>
                                    </div>
                                    <div className="p-4 text-sm whitespace-pre-wrap text-[var(--text-main)] font-mono leading-loose">
                                        {rawContent || "没有内容"}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-[var(--border)] bg-[var(--app-bg)] flex justify-end gap-3 shrink-0">
                            <button onClick={onClose} className="px-6 py-2 rounded-lg text-sm font-bold bg-[var(--accent)] text-white shadow hover:bg-[var(--accent)]/90 transition-all">
                                完成
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default ChapterResultModal;
