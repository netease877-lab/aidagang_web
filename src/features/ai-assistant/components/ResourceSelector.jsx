import React, { useState, useMemo } from 'react';
import { Search, X, Layers, CheckCircle } from 'lucide-react';

// --- 子组件：资源选择器 Modal ---
const ResourceSelector = ({ isOpen, onClose, title, icon: Icon, colorClass, dataCats, selectedIds, onToggle, activeCatId, setActiveCatId, fieldOrder }) => {
    if (!isOpen) return null;
    const [filter, setFilter] = useState('');

    const allItems = useMemo(() => {
        let items = [];
        if (Array.isArray(dataCats)) {
            dataCats.forEach(cat => { if (cat.items) items = [...items, ...cat.items]; });
        }
        return items;
    }, [dataCats]);

    const currentItems = useMemo(() => {
        if (!Array.isArray(dataCats)) return [];
        if (filter.trim()) return allItems.filter(i => (i.name || i.title || '').toLowerCase().includes(filter.toLowerCase()));
        return dataCats.find(c => c.id === activeCatId)?.items || [];
    }, [dataCats, activeCatId, filter, allItems]);

    // [新增] 按 fieldOrder 顺序获取第一个有值的字段
    const getFirstField = (item) => {
        if (!item.extra_fields) return null;
        if (fieldOrder && fieldOrder.length > 0) {
            for (const label of fieldOrder) {
                if (item.extra_fields[label]) return { key: label, value: item.extra_fields[label] };
            }
        }
        // 如果没有 fieldOrder 或所有字段都为空，回退到第一个有值的
        const entries = Object.entries(item.extra_fields);
        return entries.length > 0 ? { key: entries[0][0], value: entries[0][1] } : null;
    };

    return (
        <div className="absolute inset-0 z-[110] flex items-center justify-center bg-black/30 backdrop-blur-[2px] animate-in fade-in duration-200" onClick={(e) => e.target === e.currentTarget && onClose()}>
            {/* [核心适配] 宽度改为响应式 w-[95%] */}
            <div className="bg-[var(--panel-bg)] rounded-xl w-[95%] max-w-[800px] h-[80%] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--panel-bg)] shrink-0">
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-sm ${colorClass}`}><Icon size={14} /></div>
                        <div><h3 className="font-bold text-[var(--text-main)] text-base">{title}</h3><div className="text-xs text-[var(--text-sub)]">已选 <span className="text-[var(--accent)] font-bold">{selectedIds.size}</span> 项</div></div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-[var(--hover-bg)] text-[var(--text-sub)] hover:text-[var(--text-main)] flex items-center justify-center transition"><X size={18} /></button>
                </div>
                <div className="px-4 py-3 bg-[var(--panel-bg)] border-b border-[var(--border)] shrink-0">
                    <div className="relative mb-3"><Search className="absolute left-3 top-2.5 text-[var(--text-sub)]" size={14} /><input type="text" className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--app-bg)] border border-[var(--border)] text-sm focus:bg-[var(--panel-bg)] focus:border-[var(--accent)] outline-none transition text-[var(--text-main)]" placeholder="搜索名称..." value={filter} onChange={e => setFilter(e.target.value)} /></div>
                    <div className="flex flex-wrap gap-2 min-h-[24px]">
                        {selectedIds.size === 0 && <span className="text-[var(--text-sub)] text-xs italic py-1">暂无选择</span>}
                        {Array.from(selectedIds).map(id => { const item = allItems.find(i => i.id === id); if (!item) return null; return (<span key={id} className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--accent-bg)] text-[var(--accent)] border border-[var(--accent)]/30">{item.name || item.title} <X size={10} className="ml-1 cursor-pointer hover:text-[var(--accent)]" onClick={() => onToggle(id)} /></span>); })}
                    </div>
                </div>
                <div className="flex flex-1 overflow-hidden">
                    <div className="w-[160px] bg-[var(--app-bg)] border-r border-[var(--border)] overflow-y-auto">
                        {Array.isArray(dataCats) && dataCats.map(cat => (<div key={cat.id} onClick={() => { setActiveCatId(cat.id); setFilter(''); }} className={`px-4 py-3 cursor-pointer text-[13px] flex items-center gap-2 transition-all border-l-[3px] ${activeCatId === cat.id && !filter ? 'bg-[var(--accent-bg)] text-[var(--accent)] border-[var(--accent)] font-semibold' : 'border-transparent text-[var(--text-sub)] hover:bg-[var(--hover-bg)]'}`}>{activeCatId === cat.id ? <div className="w-3.5"><Layers size={12} /></div> : <div className="w-3.5"><Layers size={12} className="opacity-50" /></div>}<span className="truncate">{cat.name}</span></div>))}
                    </div>
                    <div className="flex-1 bg-[var(--app-bg)] p-5 overflow-y-auto relative">
                        {currentItems.length === 0 ? (<div className="text-center text-[var(--text-sub)] py-10 text-sm">没有找到相关内容</div>) : (<div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">{currentItems.map(item => { const isSelected = selectedIds.has(item.id); const firstField = getFirstField(item); return (<div key={item.id} onClick={() => onToggle(item.id)} className={`relative bg-[var(--panel-bg)] border rounded-lg p-3 cursor-pointer flex flex-col items-center text-center transition-all hover:shadow-sm hover:border-[var(--text-sub)] hover:-translate-y-0.5 ${isSelected ? 'border-[var(--accent)] bg-[var(--accent-bg)] shadow-[0_0_0_1px_var(--accent)]' : 'border-[var(--border)]'}`}>{isSelected && <div className="absolute top-1.5 right-1.5 text-[var(--accent)]"><CheckCircle size={14} /></div>}<div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 text-base shadow-sm ${isSelected ? 'bg-[var(--accent-bg)] text-[var(--accent)]' : 'bg-[var(--app-bg)] text-[var(--text-sub)]'}`}><Icon size={18} /></div><div className="font-bold text-[var(--text-main)] text-xs truncate w-full">{item.name}</div><div className="text-[10px] text-[var(--text-sub)] truncate w-full mt-1 opacity-80">{firstField ? `${firstField.key}: ${firstField.value}` : (item.desc || "暂无描述")}</div></div>); })}</div>)}
                    </div>
                </div>
                <div className="p-4 border-t border-[var(--border)] flex justify-between bg-[var(--panel-bg)] shrink-0 items-center">
                    <button onClick={() => { Array.from(selectedIds).forEach(id => onToggle(id)); }} className="text-red-500 text-sm hover:text-red-600 font-medium px-2">清空选择</button>
                    <button onClick={onClose} className="px-6 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-bold shadow-md hover:bg-[var(--accent)]/90 transition transform active:scale-95">确认完成</button>
                </div>
            </div>
        </div>
    );
};

export default ResourceSelector;
