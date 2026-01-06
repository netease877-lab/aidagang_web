
import React, { useState, useEffect, useRef } from 'react';
import { Search, X, ChevronRight, FileText, Hash, AlignLeft, CornerDownRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import DOMPurify from 'dompurify'; // [修复] 防止XSS攻击
import { toChineseNum } from '../../constants';

/**
 * 全局搜索模态框
 * @param {boolean} isOpen 是否显示
 * @param {function} onClose 关闭回调
 * @param {Array} data 大纲数据
 * @param {function} onSelect 选中回调 (id, isLeaf)
 */
export default function SearchModal({ isOpen, onClose, data, onSelect, numStyle = 'chinese' }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef(null);
    const listRef = useRef(null);

    // 自动聚焦
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setResults([]);
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // 搜索逻辑
    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            return;
        }

        // [新增] 多关键词支持：按空格分割，所有关键词都需匹配
        const keywords = query.toLowerCase().split(/\s+/).filter(k => k);
        const matchAll = (text) => keywords.every(kw => text?.toLowerCase().includes(kw));

        const searchResults = [];
        let chapterCount = 0;

        const traverse = (nodes, path = []) => {
            for (const node of nodes) {
                let displayTitle = node.title || '未命名';
                if (node.type === 'chapter') {
                    chapterCount++;
                    if (numStyle !== 'none') {
                        const numStr = numStyle === 'chinese' ? toChineseNum(chapterCount) : chapterCount;
                        displayTitle = `第${numStr}章 ${displayTitle}`;
                    }
                } else if (node.type === 'volume') {
                    displayTitle = node.title;
                }

                const currentPath = [...path, { id: node.id, title: displayTitle }];

                // 1. 标题匹配
                if (matchAll(displayTitle)) {
                    searchResults.push({
                        node: { ...node, title: displayTitle },
                        path: currentPath,
                        matchType: 'title',
                        matchContext: ''
                    });
                }

                // 2. 简介匹配
                if (matchAll(node.summary)) {
                    searchResults.push({
                        node: { ...node, title: displayTitle },
                        path: currentPath,
                        matchType: 'summary',
                        matchContext: node.summary
                    });
                }

                // 3. 正文匹配
                if (matchAll(node.content)) {
                    // 用第一个关键词定位上下文
                    const idx = node.content.toLowerCase().indexOf(keywords[0]);
                    const start = Math.max(0, idx - 20);
                    const end = Math.min(node.content.length, idx + 60);
                    searchResults.push({
                        node: { ...node, title: displayTitle },
                        path: currentPath,
                        matchType: 'content',
                        matchContext: (start > 0 ? '...' : '') + node.content.substring(start, end) + (end < node.content.length ? '...' : '')
                    });
                }

                if (node.children?.length > 0) {
                    traverse(node.children, currentPath);
                }
            }
        };

        if (data) traverse(data);
        setResults(searchResults);
        setSelectedIndex(0);
    }, [query, data]);

    // 键盘导航
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isOpen) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (results[selectedIndex]) {
                    handleSelect(results[selectedIndex]);
                }
            } else if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, results, selectedIndex]);

    // 选中处理
    const handleSelect = (result) => {
        // [修复] 传递 path 以便自动展开父节点
        onSelect(result.node.id, !result.node.children?.length, result.path);
        onClose();
    };

    // 滚动跟随
    useEffect(() => {
        if (listRef.current && results.length > 0) {
            const selectedEl = listRef.current.children[selectedIndex];
            if (selectedEl) {
                selectedEl.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [selectedIndex, results]);

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={onClose}>
                    {/* 背景遮罩 */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
                    />

                    {/* 搜索框容器 */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        transition={{ duration: 0.2 }}
                        className="relative w-full max-w-2xl bg-[var(--panel-bg)] rounded-xl shadow-2xl border border-[var(--border)] overflow-hidden flex flex-col max-h-[70vh]"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* 搜索输入区域 */}
                        <div className="flex items-center px-4 py-3 border-b border-[var(--border)] gap-3 bg-[var(--app-bg)]/50">
                            <Search className="text-[var(--text-sub)]" size={20} />
                            <input
                                ref={inputRef}
                                type="text"
                                className="flex-1 bg-transparent text-lg outline-none text-[var(--text-main)] placeholder:text-[var(--text-sub)]/50"
                                placeholder="搜索标题、简介或正文... (支持 ↑↓ 选择，Enter 跳转)"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                            />
                            <div className="flex items-center gap-2">
                                <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-xs font-mono text-[var(--text-sub)] bg-[var(--hover-bg)] rounded border border-[var(--border)]">ESC</kbd>
                                <button onClick={onClose} className="p-1 hover:bg-[var(--hover-bg)] rounded text-[var(--text-sub)] transition-colors">
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* 结果列表 */}
                        <div className="overflow-y-auto flex-1 p-2 scrollbar-thin" ref={listRef}>
                            {results.length === 0 ? (
                                <div className="py-12 text-center text-[var(--text-sub)]">
                                    {query ? '未找到相关内容' : '输入关键词开始搜索'}
                                </div>
                            ) : (
                                results.map((result, index) => (
                                    <div
                                        key={`${result.node.id}-${index}`}
                                        className={`group flex flex-col gap-1 p-3 rounded-lg cursor-pointer transition-colors border border-transparent
                                    ${index === selectedIndex ? 'bg-[var(--accent)] text-white shadow-sm' : 'hover:bg-[var(--hover-bg)] text-[var(--text-main)]'}
                                `}
                                        onClick={() => handleSelect(result)}
                                        onMouseEnter={() => setSelectedIndex(index)}
                                    >
                                        {/* 路径面包屑 */}
                                        <div className={`flex items-center text-xs gap-1 opacity-60 ${index === selectedIndex ? 'text-white' : 'text-[var(--text-sub)]'}`}>
                                            {result.path.map((p, i) => (
                                                <React.Fragment key={i}>
                                                    {i > 0 && <ChevronRight size={10} />}
                                                    <span>{p.title || '未命名'}</span>
                                                </React.Fragment>
                                            ))}
                                        </div>

                                        {/* 标题与类型 */}
                                        <div className="flex items-center justify-between">
                                            <div className="font-bold text-sm flex items-center gap-2">
                                                {result.node.type === 'volume' ? <Hash size={14} /> :
                                                    result.node.type === 'chapter' ? <FileText size={14} /> : <AlignLeft size={14} />}

                                                {result.matchType === 'title' ? (
                                                    <span dangerouslySetInnerHTML={{
                                                        __html: DOMPurify.sanitize((result.node.title || '').replace(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<span class="bg-yellow-300/40 rounded px-0.5">$1</span>'))
                                                    }} />
                                                ) : (
                                                    result.node.title || '未命名'
                                                )}
                                            </div>

                                            {/* 跳转提示 */}
                                            {index === selectedIndex && (
                                                <div className="text-xs opacity-70 flex items-center gap-1">
                                                    <CornerDownRight size={12} /> 跳转
                                                </div>
                                            )}
                                        </div>

                                        {/* 匹配上下文 (简介或正文) */}
                                        {(result.matchType === 'content' || result.matchType === 'summary') && (
                                            <div className={`text-xs pl-6 mt-1 line-clamp-2 leading-relaxed opacity-80 font-mono`}>
                                                <span className="opacity-50 mr-1">{result.matchType === 'content' ? '正文:' : '简介:'}</span>
                                                <span dangerouslySetInnerHTML={{
                                                    __html: DOMPurify.sanitize(result.matchContext.replace(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<span class="decoration-2 underline decoration-yellow-400 font-bold">$1</span>'))
                                                }} />
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>

                        {/* 底部状态栏 */}
                        {results.length > 0 && (
                            <div className="px-4 py-2 border-t border-[var(--border)] bg-[var(--app-bg)]/50 text-[10px] text-[var(--text-sub)] flex justify-between">
                                <span>找到 {results.length} 个结果</span>
                                <span className="opacity-60">↑↓ 选择 · Enter 跳转</span>
                            </div>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
