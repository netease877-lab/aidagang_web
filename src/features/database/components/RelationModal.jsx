// ==================================================
// File: frontend/src/features/database/components/RelationModal.jsx
// 角色关系编辑弹窗（紧凑型，标签选择式）
// ==================================================
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X, Link2, Check, ArrowRight, Settings, Plus, Trash2, Edit2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    PRESET_RELATIONS, RELATION_TYPES, getInverseLabel,
    getRelationTypeByLabel, getRelationDistanceByLabel
} from '../../../config/relationConfig';
import { fetchAPI } from '../../../services/api';
import { getDefaultRelTypes } from '../../../config/relationConfig'; // [新增] 用于兜底
import { useEntityStore } from '../../../stores'; // [新增] 用于更新 relations

// 默认的关系分类
// 移除本地 getDefaultRelTypes 定义，改用 import
// const getDefaultRelTypes = ... (Removed)

export default function RelationModal({
    isOpen,
    onClose,
    sourceCharacter,
    novelId,
    characters,
    charCats,
    relations,
    onRelationsChange,

    defaultCharColor,
    anchorPosition,
    // [新增] 接收受控 Props，并赋默认值防止 crash
    relationTypes,
    setRelationTypes,
    uiScale = 100 // [修复] 接收 uiScale
}) {
    // 兼容性处理：如果是受控模式，将 relationTypes 别名为 allRelTypes 使用
    // 如果上层没传 (旧代码)，则 fallback 到内部 state (但实际上我们应该确保上层传了)
    // 为了简单起见，假设上层已传，这里做别名映射
    // 兼容性处理 & 数据清洗
    // 确保 allRelTypes 中的项具有唯一的 type，且过滤无效项
    const allRelTypes = useMemo(() => {
        const raw = relationTypes && relationTypes.length > 0 ? relationTypes : [];

        // 1. 严格过滤无效项
        const validItems = raw.filter(t => t && t.type && t.label);

        // 2. 如果过滤后没有有效数据，回退到默认值
        if (validItems.length === 0) {
            return getDefaultRelTypes();
        }

        // 3. 去重逻辑：保留第一个出现的 type
        const seen = new Set();
        return validItems.filter(t => {
            if (seen.has(t.type)) return false;
            seen.add(t.type);
            return true;
        });
    }, [relationTypes]);

    const setAllRelTypes = setRelationTypes || (() => { });
    const modalRef = useRef(null);
    const [activeCatId, setActiveCatId] = useState(null);
    const [activeRelType, setActiveRelType] = useState(null);
    const [targetId, setTargetId] = useState(null);
    const [relationLabel, setRelationLabel] = useState('');
    const [saving, setSaving] = useState(false);
    const [showManage, setShowManage] = useState(false);
    const [confirmReset, setConfirmReset] = useState(false);


    // 新建分类/标签
    const [newTypeName, setNewTypeName] = useState('');
    const [newTypeColor, setNewTypeColor] = useState('#9CA3AF');
    const [newLabelName, setNewLabelName] = useState('');
    const [addingTypeId, setAddingTypeId] = useState(null);
    const [editingTypeId, setEditingTypeId] = useState(null);
    const [editTypeName, setEditTypeName] = useState('');
    const [editTypeColor, setEditTypeColor] = useState('');

    // 弹窗位置
    const [modalStyle, setModalStyle] = useState({});
    const [positionReady, setPositionReady] = useState(false);

    useEffect(() => {
        if (isOpen && anchorPosition) {
            const modalWidth = 320;
            const modalHeight = 480;
            const padding = 16;

            // [修复] 考虑 uiScale 对视口边界的影响
            const scale = uiScale / 100;
            const viewportW = window.innerWidth / scale;
            const viewportH = window.innerHeight / scale;

            let left = anchorPosition.x;
            let top = anchorPosition.y;

            if (left + modalWidth > viewportW - padding) left = viewportW - modalWidth - padding;
            if (top + modalHeight > viewportH - padding) top = viewportH - modalHeight - padding;
            left = Math.max(padding, left);
            top = Math.max(padding, top);

            setModalStyle({ left: `${left}px`, top: `${top}px` });
            setPositionReady(true);
        } else if (!isOpen) {
            setPositionReady(false);
        }
    }, [isOpen, anchorPosition]);

    useEffect(() => {
        if (isOpen && charCats.length > 0 && !activeCatId) setActiveCatId(charCats[0].id);
        if (isOpen && !activeRelType && allRelTypes.length > 0) setActiveRelType(allRelTypes[0].type);
    }, [isOpen, charCats, activeCatId, activeRelType, allRelTypes]);

    useEffect(() => {
        if (!isOpen) {
            setTargetId(null);
            setRelationLabel('');
            setActiveCatId(null);
            setActiveRelType(null);
            setShowManage(false);
            setEditingTypeId(null);
            setConfirmReset(false);
        }
    }, [isOpen]);


    const currentTypeLabels = useMemo(() => {
        const typeObj = allRelTypes.find(t => t.type === activeRelType);
        return typeObj?.items || [];
    }, [activeRelType, allRelTypes]);

    const currentCatChars = useMemo(() => {
        if (!activeCatId) return [];
        return characters.filter(c => c.categoryId === activeCatId && c.id !== sourceCharacter?.id);
    }, [characters, activeCatId, sourceCharacter]);

    const targetCharacter = useMemo(() => characters.find(c => c.id === targetId), [characters, targetId]);

    const getCharColor = (char) => {
        if (char?.color) return char.color;
        const cat = charCats.find(c => c.id === char?.categoryId);
        return cat?.color || defaultCharColor;
    };

    const handleAddType = () => {
        if (!newTypeName.trim()) return;
        setAllRelTypes(prev => [...prev, { type: `custom_${Date.now()}`, label: newTypeName.trim(), color: newTypeColor, items: [] }]);
        setNewTypeName('');
        setNewTypeColor('#9CA3AF');
    };

    const handleDeleteType = (typeId) => {
        setAllRelTypes(prev => prev.filter(t => t.type !== typeId));
        if (activeRelType === typeId) setActiveRelType(allRelTypes[0]?.type || null);
    };

    const handleStartEditType = (t) => {
        setEditingTypeId(t.type);
        setEditTypeName(t.label);
        setEditTypeColor(t.color);
    };

    const handleSaveEditType = () => {
        if (!editTypeName.trim()) return;
        setAllRelTypes(prev => prev.map(t => t.type === editingTypeId ? { ...t, label: editTypeName.trim(), color: editTypeColor } : t));
        setEditingTypeId(null);
    };

    const handleAddLabel = (typeId) => {
        if (!newLabelName.trim()) return;
        setAllRelTypes(prev => prev.map(t => t.type === typeId ? { ...t, items: [...t.items, { label: newLabelName.trim(), type: typeId, distance: 2 }] } : t));
        setNewLabelName('');
        setAddingTypeId(null);
    };

    const handleDeleteLabel = (typeId, labelName) => {
        setAllRelTypes(prev => prev.map(t => t.type === typeId ? { ...t, items: t.items.filter(i => i.label !== labelName) } : t));
    };

    const handleResetDefaults = () => {
        setAllRelTypes(getDefaultRelTypes());
        setConfirmReset(false);
    };

    // 保存关系（使用原来的API调用方式）
    // [修复] 成功后更新 entityStore，确保 UI 立即反映变化
    const handleSave = async () => {
        if (!targetId || !relationLabel.trim()) return;
        setSaving(true);
        try {
            const relType = activeRelType || 'custom';
            const labelObj = currentTypeLabels.find(l => l.label === relationLabel);
            const distance = labelObj?.distance || 2;

            const res = await fetchAPI('/api/relation/', 'POST', {
                novel_id: novelId,
                source_id: sourceCharacter.id,
                target_id: targetId,
                relation_type: relType,
                relation_label: relationLabel,
                distance: distance
            });

            // [修复] 更新 entityStore 中的 relations
            if (res && !res.error) {
                const newRelation = {
                    id: res.id || res.data?.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    source_id: sourceCharacter.id,
                    target_id: targetId,
                    relation_type: relType,
                    relation_label: relationLabel,
                    distance: distance
                };
                useEntityStore.getState().setRelations([
                    ...useEntityStore.getState().relations,
                    newRelation
                ]);
            }

            onRelationsChange?.();
            onClose();
        } catch (e) {
            console.error('添加关系失败:', e);
        }
        setSaving(false);
    };

    const currentRelType = allRelTypes.find(t => t.type === activeRelType);
    const shouldShow = isOpen && sourceCharacter;

    return (
        <AnimatePresence>
            {shouldShow && (
                <div className="fixed inset-0 z-[100]" onClick={(e) => e.target === e.currentTarget && onClose()}>
                    <motion.div
                        ref={modalRef}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: positionReady ? 1 : 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="fixed w-[320px] bg-[var(--panel-bg)] rounded-xl shadow-2xl border border-[var(--border)] overflow-hidden"
                        style={{ ...modalStyle }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-4 py-3 border-b border-[var(--border)] flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Link2 size={16} className="text-[var(--accent)]" />
                                <span className="font-bold text-sm text-[var(--text-main)]">添加关系</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setShowManage(!showManage)} className={`px-2 py-1 rounded text-xs ${showManage ? 'bg-[var(--accent)] text-white' : 'bg-[var(--app-bg)] text-[var(--text-sub)]'}`}>
                                    <Settings size={12} />
                                </button>
                                <button onClick={onClose} className="p-1 hover:bg-[var(--hover-bg)] rounded"><X size={16} /></button>
                            </div>
                        </div>

                        {showManage ? (
                            <div className="p-3 max-h-[400px] overflow-y-auto custom-scrollbar">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-xs font-bold text-[var(--text-main)]">关系分类管理</span>
                                    {/* 使用固定宽度容器避免抖动 */}
                                    <div className="w-[80px] flex justify-end">
                                        {confirmReset ? (
                                            <div className="flex gap-1">
                                                <button onClick={handleResetDefaults} className="px-2 py-0.5 text-xs bg-red-500 text-white rounded">确定</button>
                                                <button onClick={() => setConfirmReset(false)} className="px-2 py-0.5 text-xs text-[var(--text-sub)]">取消</button>
                                            </div>
                                        ) : (
                                            <button onClick={() => setConfirmReset(true)} className="text-xs text-red-500">重置</button>
                                        )}
                                    </div>
                                </div>

                                {/* 添加分类 */}
                                <div className="flex gap-2 mb-3 items-center">
                                    <input type="color" value={newTypeColor} onChange={(e) => setNewTypeColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0 shrink-0" />
                                    <input type="text" value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)} placeholder="新分类..." className="flex-1 min-w-0 px-2 py-1 text-sm bg-[var(--app-bg)] border border-[var(--border)] rounded outline-none text-[var(--text-main)]" />
                                    <button onClick={handleAddType} disabled={!newTypeName.trim()} className="px-2 py-1 bg-[var(--accent)] text-white text-xs rounded disabled:opacity-50 shrink-0">添加</button>
                                </div>

                                {/* 分类列表 */}
                                <div className="space-y-2">
                                    {allRelTypes.map(t => (
                                        <div key={t.type} className="bg-[var(--app-bg)] rounded p-2 border border-[var(--border)]">
                                            {editingTypeId === t.type ? (
                                                <div className="space-y-2">
                                                    <div className="flex gap-2 items-center">
                                                        <input type="color" value={editTypeColor} onChange={(e) => setEditTypeColor(e.target.value)} className="w-5 h-5 rounded cursor-pointer border-0 shrink-0" />
                                                        <input type="text" value={editTypeName} onChange={(e) => setEditTypeName(e.target.value)} className="flex-1 min-w-0 px-2 py-0.5 text-xs bg-[var(--panel-bg)] border border-[var(--border)] rounded outline-none text-[var(--text-main)]" autoFocus />
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <button onClick={handleSaveEditType} className="px-2 py-0.5 bg-[var(--accent)] text-white text-[10px] rounded">保存</button>
                                                        <button onClick={() => setEditingTypeId(null)} className="px-2 py-0.5 text-[10px] text-[var(--text-sub)]">取消</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-1">
                                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                                                        <span className="text-xs font-bold text-[var(--text-main)]">{t.label}</span>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <button onClick={() => handleStartEditType(t)} className="p-1 text-[var(--text-sub)] hover:text-[var(--accent)]"><Edit2 size={12} /></button>
                                                        <button onClick={() => handleDeleteType(t.type)} className="p-1 text-[var(--text-sub)] hover:text-red-500"><Trash2 size={12} /></button>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex flex-wrap gap-1 mb-2">
                                                {t.items.map(item => (
                                                    <span key={item.label} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[var(--panel-bg)] border border-[var(--border)] text-[var(--text-main)]">
                                                        {item.label}
                                                        <X size={10} className="cursor-pointer hover:text-red-500" onClick={() => handleDeleteLabel(t.type, item.label)} />
                                                    </span>
                                                ))}
                                            </div>

                                            {addingTypeId === t.type ? (
                                                <div className="space-y-1">
                                                    <input type="text" value={newLabelName} onChange={(e) => setNewLabelName(e.target.value)} placeholder="新标签..." className="w-full px-2 py-1 text-sm bg-[var(--panel-bg)] border border-[var(--border)] rounded outline-none text-[var(--text-main)]" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleAddLabel(t.type)} />
                                                    <div className="flex gap-1">
                                                        <button onClick={() => handleAddLabel(t.type)} className="px-2 py-0.5 bg-[var(--accent)] text-white text-xs rounded">添加</button>
                                                        <button onClick={() => { setAddingTypeId(null); setNewLabelName(''); }} className="px-2 py-0.5 text-xs text-[var(--text-sub)]">取消</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button onClick={() => setAddingTypeId(t.type)} className="text-xs text-[var(--accent)]">+ 添加标签</button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* 当前选择显示 */}
                                <div className="px-3 py-2 bg-[var(--app-bg)] border-b border-[var(--border)] flex items-center gap-2 text-xs">
                                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: getCharColor(sourceCharacter) }}>{sourceCharacter.name?.[0]}</div>
                                    <span className="font-bold text-[var(--text-main)]">{sourceCharacter.name}</span>
                                    <ArrowRight size={12} className="text-[var(--text-sub)]" />
                                    {targetCharacter ? (
                                        <>
                                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: getCharColor(targetCharacter) }}>{targetCharacter.name?.[0]}</div>
                                            <span className="font-bold text-[var(--text-main)]">{targetCharacter.name}</span>
                                        </>
                                    ) : <span className="text-[var(--text-sub)]">选择目标</span>}
                                    {relationLabel && <span className="px-2 py-0.5 rounded text-xs font-bold text-white ml-auto" style={{ backgroundColor: currentRelType?.color || '#9CA3AF' }}>{relationLabel}</span>}
                                </div>

                                {/* 角色选择 */}
                                <div className="px-3 py-2 border-b border-[var(--border)]">
                                    <div className="text-xs text-[var(--text-sub)] font-bold mb-1">选择目标角色</div>
                                    <div className="flex flex-wrap gap-1 mb-2">
                                        {charCats.map(cat => (
                                            <button key={cat.id} onClick={() => setActiveCatId(cat.id)} className={`px-2 py-1 rounded text-xs font-medium ${activeCatId === cat.id ? 'text-white' : 'text-[var(--text-sub)] bg-[var(--app-bg)]'}`} style={activeCatId === cat.id ? { backgroundColor: cat.color || defaultCharColor } : {}}>{cat.name}</button>
                                        ))}
                                    </div>
                                    <div className="flex flex-wrap gap-1 max-h-[60px] overflow-y-auto">
                                        {currentCatChars.map(char => (
                                            <button key={char.id} onClick={() => setTargetId(char.id)} className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 border ${targetId === char.id ? 'border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent)]' : 'border-[var(--border)] bg-[var(--panel-bg)] text-[var(--text-main)]'}`}>
                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getCharColor(char) }} />
                                                {char.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* 关系选择 */}
                                <div className="px-3 py-2 border-b border-[var(--border)]">
                                    <div className="text-xs text-[var(--text-sub)] font-bold mb-1">选择关系类型</div>
                                    <div className="flex flex-wrap gap-1 mb-2">
                                        {allRelTypes.map(t => (
                                            <button key={t.type} onClick={() => { setActiveRelType(t.type); setRelationLabel(''); }} className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${activeRelType === t.type ? 'text-white' : 'text-[var(--text-sub)] bg-[var(--app-bg)]'}`} style={activeRelType === t.type ? { backgroundColor: t.color } : {}}>
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                                                {t.label}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex flex-wrap gap-1 max-h-[80px] overflow-y-auto">
                                        {currentTypeLabels.map(rel => (
                                            <button key={rel.label} onClick={() => setRelationLabel(rel.label)} className={`px-2 py-1 rounded text-xs border ${relationLabel === rel.label ? 'text-white border-transparent' : 'border-[var(--border)] bg-[var(--panel-bg)] text-[var(--text-main)]'}`} style={relationLabel === rel.label ? { backgroundColor: currentRelType?.color || '#9CA3AF' } : {}}>{rel.label}</button>
                                        ))}
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="px-3 py-2 flex justify-between items-center">
                                    <button onClick={onClose} className="px-3 py-1.5 text-xs text-[var(--text-sub)] hover:bg-[var(--hover-bg)] rounded">取消</button>
                                    <button onClick={handleSave} disabled={!targetId || !relationLabel || saving} className="px-4 py-1.5 bg-[var(--accent)] text-white text-xs font-bold rounded disabled:opacity-50 flex items-center gap-1">
                                        {saving ? '...' : <><Check size={12} />确认</>}
                                    </button>
                                </div>
                            </>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
