// ==================================================
// File: frontend/src/utils/categoryUtils.js
// 分类和项目操作工具函数
// ==================================================
import { generateId } from '../constants';
import { arrayMove } from '@dnd-kit/sortable';

// ==================== 分类操作 ====================

/**
 * 切换分类展开/折叠
 */
export const toggleCat = (cats, setCats, id) => {
    setCats(prev => prev.map(c => c.id === id ? { ...c, isExpanded: !c.isExpanded } : c));
};

/**
 * 添加分类
 * [修复] 检查同名分类是否存在，存在则阻止创建
 */
export const addCat = (setCats, name, defaultColor) => {
    setCats(prev => {
        // 检查是否存在同名分类
        if (prev.some(c => c.name === name)) {
            return prev; // 不添加，返回原数组
        }
        return [...prev, { id: generateId(), name, isExpanded: true, color: defaultColor, version: 1, sortOrder: prev.length }];
    });
};

/**
 * 更新分类
 */
// [修复] 更新分类时递增版本号
export const updateCat = (setCats, id, updates) => {
    setCats(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c)); // [修复] 移除前端自增版本号
};

/**
 * 删除分类
 */
export const deleteCat = (setCats, setItems, catId) => {
    setCats(prev => prev.filter(c => c.id !== catId));
    setItems(prev => prev.filter(i => i.categoryId !== catId));
};

// ==================== 角色操作 ====================

/**
 * 添加角色
 */
// [重构] customData -> extra_fields
export const addCharacter = (charFields, characters, setCharacters, catId) => {
    const extra_fields = {};
    charFields.forEach(f => extra_fields[f.label] = '');
    setCharacters([...characters, { id: generateId(), categoryId: catId, name: '新角色', extra_fields, version: 1 }]);
};

/**
 * 更新角色
 */
// [修复] 更新角色时递增版本号
export const updateCharacter = (setCharacters, id, field, value, isCustom = false) => {
    setCharacters(chars => chars.map(c => {
        if (c.id !== id) return c;
        // [重构] customData -> extra_fields
        const base = isCustom ? { ...c, extra_fields: { ...c.extra_fields, [field]: value } } : { ...c, [field]: value };
        return { ...base }; // [修复] 移除前端自增版本号
    }));
};

/**
 * 移动角色到其他分类
 */
// [修复] 移动角色时递增版本号
export const moveCharacter = (setCharacters, charId, targetCatId) => {
    setCharacters(prev => prev.map(c => c.id === charId ? { ...c, categoryId: targetCatId } : c)); // [修复] 移除前端自增版本号
};

// ==================== 场景操作 ====================

/**
 * 添加场景
 */
export const addScene = (scenes, setScenes, catId) => {
    // [重构] title -> name, content -> desc
    setScenes([...scenes, { id: generateId(), categoryId: catId, name: '新场景', desc: '', version: 1 }]);
};

/**
 * 更新场景
 */
// [修复] 更新场景时递增版本号
export const updateScene = (setScenes, id, field, value) => {
    setScenes(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s)); // [修复] 移除前端自增版本号
};

/**
 * 移动场景到其他分类
 */
// [修复] 移动场景时递增版本号
export const moveScene = (setScenes, sceneId, targetCatId) => {
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, categoryId: targetCatId } : s)); // [修复] 移除前端自增版本号
};

// ==================== 设定操作 ====================

/**
 * 添加设定
 */
export const addSetting = (worldSettings, setWorldSettings, catId) => {
    // [重构] title -> name, content -> desc
    setWorldSettings([...worldSettings, { id: generateId(), categoryId: catId, name: '新设定', desc: '', version: 1 }]);
};

/**
 * 更新设定
 */
// [修复] 更新设定时递增版本号
export const updateSetting = (setWorldSettings, id, field, value) => {
    setWorldSettings(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s)); // [修复] 移除前端自增版本号
};

/**
 * 移动设定到其他分类
 */
// [修复] 移动设定时递增版本号
export const moveSetting = (setWorldSettings, settingId, targetCatId) => {
    setWorldSettings(prev => prev.map(s => s.id === settingId ? { ...s, categoryId: targetCatId } : s)); // [修复] 移除前端自增版本号
};

// ==================== 排序操作 ====================

/**
 * 分类重排序
 */
// [修复] 分类重排序：更新 sortOrder 和 version
export const handleReorderCats = (setCats, activeId, overId) => {
    setCats((cats) => {
        const oldIndex = cats.findIndex((c) => c.id === activeId);
        const newIndex = cats.findIndex((c) => c.id === overId);
        if (oldIndex === -1 || newIndex === -1) return cats;

        const newCats = arrayMove(cats, oldIndex, newIndex);

        return newCats.map((cat, index) => ({
            ...cat,
            sortOrder: index // [修复] 移除前端自增版本号
        }));
    });
};

/**
 * 项目重排序
 */
// [修复] 项目重排序：更新 sortOrder 和 version
export const handleReorderItems = (setItems, activeId, overId) => {
    setItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === activeId);
        const newIndex = items.findIndex((item) => item.id === overId);
        if (oldIndex === -1 || newIndex === -1) return items;
        if (items[oldIndex].categoryId !== items[newIndex].categoryId) return items; // 暂不支持跨分类拖拽

        const newItems = arrayMove(items, oldIndex, newIndex);

        return newItems.map((item, index) => ({
            ...item,
            sortOrder: index // [修复] 移除前端自增版本号
        }));
    });
};

/**
 * 项目上移
 */
// [修复] 项目上移/下移：更新 sortOrder 和 version
export const handleMoveItem = (setItems, id, direction) => {
    setItems((items) => {
        const idx = items.findIndex(item => item.id === id);
        if (idx === -1) return items;
        const targetItem = items[idx];
        const sameCategory = items.filter(i => i.categoryId === targetItem.categoryId);
        const posInCat = sameCategory.findIndex(i => i.id === id);

        if (direction === 'up' && posInCat === 0) return items;
        if (direction === 'down' && posInCat === sameCategory.length - 1) return items;

        const swapIdx = direction === 'up' ? posInCat - 1 : posInCat + 1;
        const swapItemId = sameCategory[swapIdx].id;
        const swapGlobalIdx = items.findIndex(i => i.id === swapItemId);

        const newItems = arrayMove(items, idx, swapGlobalIdx);

        return newItems.map((item, index) => ({
            ...item,
            sortOrder: index // [修复] 移除前端自增版本号
        }));
    });
};
