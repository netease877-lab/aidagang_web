// ==================================================
// File: frontend/src/features/database/components/RelationEditor.jsx
// 角色卡片内的关系编辑器
// ==================================================
import React, { useState } from 'react';
import { Plus, X, Link2, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getInverseLabel, getRelationColor } from '../../../config/relationConfig';
import { fetchAPI } from '../../../services/api';
import { useEntityStore } from '../../../stores'; // [新增]
import RelationModal from './RelationModal';

export default function RelationEditor({
    characterId,
    characterName,
    novelId,
    characters,
    relations,       // 所有关系列表
    onRelationsChange,

    charCats,
    defaultColor,
    relationTypes,
    setRelationTypes,
    uiScale = 100 // [修复] 接收 uiScale
}) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [anchorPosition, setAnchorPosition] = useState(null);

    // 过滤出与当前角色相关的关系
    const myRelations = (relations || []).filter(r =>
        r.source_id === characterId || r.target_id === characterId
    );

    // 获取目标角色名称
    const getCharName = (id) => {
        const char = characters.find(c => c.id === id);
        return char?.name || '未知';
    };

    // 获取角色颜色（从分类继承）
    const getCharColor = (id) => {
        const char = characters.find(c => c.id === id);
        if (char?.color) return char.color;
        const cat = charCats.find(c => c.id === char?.categoryId);
        return cat?.color || defaultColor;
    };

    // 删除关系
    // [修复] 成功后更新 entityStore，确保 UI 立即反映变化
    const handleDeleteRelation = async (relationId) => {
        try {
            await fetchAPI(`/api/relation/${relationId}`, 'DELETE');
            // [修复] 从 entityStore 中移除关系
            useEntityStore.getState().deleteRelation(relationId);
            onRelationsChange?.();
        } catch (e) {
            console.error('删除关系失败:', e);
        }
    };

    // 打开弹窗（记录点击位置）
    const handleOpenModal = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        // [修复] 坐标修正：除以缩放比例
        const scale = uiScale / 100;
        setAnchorPosition({ x: rect.left / scale, y: (rect.bottom + 8) / scale });
        setIsModalOpen(true);
    };

    // 当前角色对象
    const sourceCharacter = characters.find(c => c.id === characterId);

    return (
        <div className="border-t border-[var(--border)] mt-3 pt-3">
            {/* 标题（可折叠） */}
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center justify-between cursor-pointer text-[10px] font-bold text-[var(--text-sub)] mb-2"
            >
                <div className="flex items-center gap-1">
                    <Link2 size={12} />
                    <span>角色关系 ({myRelations.length})</span>
                </div>
                <ChevronDown size={12} className={`transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
            </div>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-2 overflow-hidden"
                    >
                        {/* 已有关系列表 */}
                        <AnimatePresence>
                            {myRelations.map(rel => {
                                const otherId = rel.source_id === characterId ? rel.target_id : rel.source_id;
                                const label = rel.source_id === characterId ? rel.relation_label : getInverseLabel(rel.relation_label);
                                const relColor = getRelationColor(rel.relation_type);

                                return (
                                    <motion.div
                                        key={rel.id}
                                        layout
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 10 }}
                                        className="flex items-center justify-between bg-[var(--app-bg)] rounded px-2 py-1 text-xs"
                                    >
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-3 h-3 rounded-full"
                                                style={{ backgroundColor: getCharColor(otherId) }}
                                            />
                                            <span className="text-[var(--text-main)]">{getCharName(otherId)}</span>
                                            <span
                                                className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                                                style={{ color: relColor, backgroundColor: `${relColor}20` }}
                                            >
                                                {label}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteRelation(rel.id)}
                                            className="p-1 text-[var(--text-sub)] hover:text-red-500 opacity-50 hover:opacity-100"
                                        >
                                            <X size={12} />
                                        </button>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>

                        {/* 添加关系按钮 */}
                        <button
                            onClick={handleOpenModal}
                            className="w-full py-1.5 border border-dashed border-[var(--border)] rounded text-[10px] text-[var(--text-sub)] hover:border-[var(--accent)] hover:text-[var(--accent)] flex items-center justify-center gap-1"
                        >
                            <Plus size={12} /> 添加关系
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 关系添加弹窗 */}
            <RelationModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                sourceCharacter={sourceCharacter}
                novelId={novelId}
                characters={characters}
                charCats={charCats}
                relations={relations}
                onRelationsChange={onRelationsChange}
                defaultCharColor={defaultColor}
                anchorPosition={anchorPosition}
                relationTypes={relationTypes}
                setRelationTypes={setRelationTypes}
                uiScale={uiScale} // [修复] 传递 uiScale
            />
        </div>
    );
}
