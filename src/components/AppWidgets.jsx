import React, { useState, useRef, useEffect } from 'react';
import { BookOpen, Trash2, Plus, ChevronDown, User, CheckCircle, XCircle } from 'lucide-react';

// 重新导出 RemoteEditorBanner 以便 App.jsx 可以从这里统一导入
export { RemoteEditorBanner } from '../features/sync/RemoteCursor';

/**
 * 同步状态指示器
 */
export const SyncStatusWidget = ({ status, lastMessage }) => {
    let colorClass = 'bg-blue-400';
    let animateClass = '';
    let title = 'WebDAV 未配置或空闲';

    if (status === 'syncing') {
        colorClass = 'bg-yellow-400';
        animateClass = 'animate-pulse';
        title = '正在同步到云端...';
    } else if (status === 'success') {
        colorClass = 'bg-green-500';
        title = '云端同步成功';
    } else if (status === 'error') {
        colorClass = 'bg-red-500';
        title = `同步失败: ${lastMessage}`;
    }

    return (
        <div className="flex items-center ml-2" title={title}>
            <div className={`w-2.5 h-2.5 rounded-full ${colorClass} ${animateClass} shadow-sm border border-white/20`}></div>
        </div>
    );
};

/**
 * Toast 通知
 */
export const Toast = ({ message, type, visible, onClose }) => {
    if (!visible) return null;
    return (
        <div className={`fixed bottom-6 right-6 z-[200] px-4 py-3 rounded-lg shadow-xl border flex items-center gap-2 animate-in slide-in-from-bottom-2 fade-in duration-300 ${type === 'error' ? 'bg-red-50 border-red-200 text-red-600' : 'bg-green-50 border-green-200 text-green-600'}`}>
            {type === 'error' ? <XCircle size={18} /> : <CheckCircle size={18} />}
            <span className="text-sm font-bold">{message}</span>
        </div>
    );
};

/**
 * 小说选择器下拉菜单
 */
export const NovelSelector = ({ novels, currentId, onSwitch, onCreate, onDelete }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null); // [新增] 二次确认状态
    // [修复] 对 novels 去重，防止因并发更新导致重复 key
    const uniqueNovels = [...new Map(novels.map(n => [n.id, n])).values()];
    const currentNovel = uniqueNovels.find(n => n.id === currentId) || { title: '未命名作品' };
    const autoCloseTimer = useRef(null);
    const deleteConfirmTimer = useRef(null); // [新增] 确认超时计时器
    const panelRef = useRef(null); // [修复] 恢复 panelRef 用于检测外部点击

    // 2秒无操作自动折叠 + ESC键关闭 + 点击外部关闭
    useEffect(() => {
        if (isOpen) {
            autoCloseTimer.current = setTimeout(() => setIsOpen(false), 2000);
            const handleEsc = (e) => e.key === 'Escape' && setIsOpen(false);
            const handleClickOutside = (e) => {
                // 使用 click 事件确保 React 事件先执行（新建），再执行关闭检查
                if (panelRef.current && !panelRef.current.contains(e.target)) {
                    setIsOpen(false);
                }
            };
            window.addEventListener('keydown', handleEsc);
            document.addEventListener('click', handleClickOutside);
            return () => {
                if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
                window.removeEventListener('keydown', handleEsc);
                document.removeEventListener('click', handleClickOutside);
            };
        }
    }, [isOpen]);

    const handleMouseEnter = () => {
        if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
    };

    const handleMouseLeave = () => {
        if (isOpen) {
            autoCloseTimer.current = setTimeout(() => setIsOpen(false), 2000);
        }
    };

    // [新增] 处理删除点击
    const handleDeleteClick = (e, novelId) => {
        e.stopPropagation();
        if (deleteConfirmId === novelId) {
            // 二次点击，执行删除
            onDelete(novelId);
            setDeleteConfirmId(null);
            if (deleteConfirmTimer.current) clearTimeout(deleteConfirmTimer.current);
        } else {
            // 首次点击，进入确认状态
            setDeleteConfirmId(novelId);
            if (deleteConfirmTimer.current) clearTimeout(deleteConfirmTimer.current);
            deleteConfirmTimer.current = setTimeout(() => setDeleteConfirmId(null), 3000);
        }
    };

    return (
        <div className="relative" ref={panelRef}>
            <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 hover:bg-[var(--hover-bg)] p-1 pr-3 rounded-lg transition-colors text-[var(--text-main)]">
                <div className="bg-[var(--accent)] text-white p-1.5 rounded-md shadow-sm flex-shrink-0"><BookOpen size={18} /></div>
                <div className="text-left min-w-0 overflow-hidden">
                    <div className="font-bold text-sm leading-tight flex items-center gap-1"><span className="truncate">{currentNovel.title}</span> <ChevronDown size={12} className={`transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} /></div>
                    <div className="text-[10px] opacity-60 whitespace-nowrap">小说工坊 v8.0</div>
                </div>
            </button>
            {isOpen && (
                <div
                    className="fixed top-[3.5rem] left-2 md:absolute md:top-full md:left-0 mt-2 w-64 bg-[var(--panel-bg)] rounded-xl shadow-xl border border-[var(--border)] z-[9999] overflow-hidden animate-in fade-in zoom-in-95 duration-100"
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                >
                    <div className="p-2 border-b border-[var(--border)] text-xs font-bold opacity-50 uppercase tracking-wider text-[var(--text-main)]">我的作品</div>
                    <div className="max-h-60 overflow-y-auto py-1">
                        {uniqueNovels.map(novel => (
                            <div key={novel.id} className="group flex items-center justify-between px-3 py-2 hover:bg-[var(--hover-bg)] cursor-pointer" onClick={() => { onSwitch(novel.id); setIsOpen(false); }}>
                                <div className="flex items-center gap-2 overflow-hidden">
                                    {currentId === novel.id && <div className="w-1 h-4 bg-[var(--accent)] rounded-full"></div>}
                                    <span className={`text-sm truncate ${currentId === novel.id ? 'font-bold text-[var(--accent)]' : 'text-[var(--text-main)]'}`}>{novel.title}</span>
                                </div>
                                {uniqueNovels.length > 1 && (
                                    <button
                                        onClick={(e) => handleDeleteClick(e, novel.id)}
                                        className={`p-1 transition-all flex items-center justify-center min-w-[20px] rounded ${deleteConfirmId === novel.id
                                            ? 'bg-red-500 text-white hover:bg-red-600 px-1.5 opacity-100'
                                            : 'opacity-100 md:opacity-0 md:group-hover:opacity-100 text-[var(--text-sub)] hover:text-red-500'
                                            }`}
                                    >
                                        {deleteConfirmId === novel.id ? <span className="text-[9px] font-bold whitespace-nowrap">确定?</span> : <Trash2 size={12} />}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="p-2 border-t border-[var(--border)]">
                        <button onClick={() => { if (onCreate) onCreate(); setIsOpen(false); }} className="w-full py-2 flex items-center justify-center gap-2 border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] rounded-lg text-xs font-bold transition-all shadow-sm text-[var(--text-main)]"><Plus size={14} /> 新建小说</button>
                    </div>
                </div>
            )}
        </div >
    );
};

/**
 * 欢迎页面（未登录时显示）
 */
export const WelcomePage = ({ onOpenLogin }) => {
    return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 text-white relative overflow-hidden font-sans">
            <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                <div className="absolute top-20 left-20 w-64 h-64 bg-blue-500 rounded-full blur-[100px]"></div>
                <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500 rounded-full blur-[100px]"></div>
            </div>
            <div className="z-10 text-center animate-in fade-in zoom-in duration-500 space-y-8 p-8 max-w-2xl">
                <div className="mb-6 flex justify-center">
                    <div className="w-24 h-24 bg-blue-600 rounded-3xl shadow-2xl flex items-center justify-center rotate-12 ring-4 ring-blue-500/30">
                        <BookOpen size={56} className="text-white" />
                    </div>
                </div>
                <h1 className="text-5xl font-extrabold tracking-tight drop-shadow-lg">小说大纲工坊</h1>
                <p className="text-lg text-slate-300 leading-relaxed font-light">
                    专为网文作者打造的沉浸式创作工具。<br />
                    AI 辅助细纲 · 可视化人物关系 · 无限层级大纲 · 云端同步
                </p>
                <div className="pt-8">
                    <button
                        onClick={onOpenLogin}
                        className="px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold text-lg shadow-xl shadow-blue-500/30 transition-all hover:scale-105 active:scale-95 flex items-center gap-3 mx-auto"
                    >
                        <User size={20} /> 立即登录 / 注册
                    </button>
                    <p className="text-xs text-slate-500 mt-6 opacity-60">v8.0 Scene Manager Edition</p>
                </div>
            </div>
        </div>
    );
};
