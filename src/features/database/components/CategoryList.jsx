import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useUIStore } from '../../../stores';
import { useDeleteConfirm } from '../../../hooks/useDeleteConfirm';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  FolderPlus, FolderOpen, Plus, Trash2, GripVertical, ChevronDown,
  ArrowUp, ArrowDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// [新增] 性能模式检测
const isPerfMode = typeof window !== 'undefined' && localStorage.getItem('mobile_perf_mode') === 'true';
const animDuration = isPerfMode ? 0 : 0.2;

const ExpandableCard = React.forwardRef(({ id, title, onRename, onDelete, onMoveUp, onMoveDown, isFirst, isLast, children, borderColor, isMobile, style, listeners, attributes, ...restProps }, ref) => {
  // [修复] 从 props 中单独解构 listeners 和 attributes，避免在外层容器重复应用
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const inputRef = useRef(null);
  const [deleteConfirming, requestConfirm] = useDeleteConfirm();

  const clickCountRef = useRef(0);
  const clickTimerRef = useRef(null);

  useEffect(() => { setEditValue(title); }, [title]);
  useEffect(() => { if (isEditing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [isEditing]);

  // [重构] 新交互逻辑：单击无延迟立即展开，双击撤销展开并进入编辑
  const handleSmartClick = (e) => {
    if (isEditing || e.target.closest('button') || e.target.tagName === 'INPUT' || e.target.closest('[data-dnd-handle]')) return;
    e.preventDefault();

    const now = Date.now();
    const timeSinceLastClick = now - (clickTimerRef.current || 0);

    if (timeSinceLastClick < 300) {
      // 双击：撤销刚才的展开（如果刚展开了就折叠回去），然后进入编辑
      if (isExpanded) {
        setIsExpanded(false); // 折叠
      }
      setIsEditing(true);
      clickTimerRef.current = 0; // 重置
    } else {
      // 单击：立即展开/折叠（无延迟）
      setIsExpanded(prev => !prev);
      clickTimerRef.current = now; // 记录时间
    }
  };

  const handleBlur = () => { setIsEditing(false); if (editValue.trim() !== title) onRename(editValue); };
  const handleKeyDown = (e) => { if (e.key === 'Enter') handleBlur(); };

  return (
    // [修复] 外层容器只展开 restProps（不含 listeners/attributes）
    <div ref={ref} style={style} {...restProps} className="bg-[var(--panel-bg)] rounded border border-[var(--border)] mb-2 transition-shadow hover:shadow-md group select-none">
      <div className={`flex justify-between items-center p-2 cursor-pointer border-l-4 ${isExpanded ? 'bg-[var(--app-bg)]' : ''}`} style={{ borderLeftColor: borderColor || 'var(--accent)' }} onClick={handleSmartClick}>
        <div className="flex items-center gap-1 flex-1 overflow-hidden">
          {/* [修复] listeners 和 attributes 只应用于拖拽手柄 */}
          <div {...listeners} {...attributes} data-dnd-handle className="p-1.5 cursor-grab active:cursor-grabbing touch-none">
            <GripVertical size={14} className="text-[var(--text-sub)] shrink-0 opacity-50" />
          </div>
          <ChevronDown size={14} className={`text-[var(--text-sub)] shrink-0 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />

          <div className="flex-1 min-w-0 text-[var(--text-main)] font-bold text-sm ml-1" title={isMobile ? "单击展开，双击编辑" : "双击编辑名称"}>
            {isEditing ? (
              <input ref={inputRef} className="w-full bg-[var(--app-bg)] border border-[var(--accent)] rounded px-1 outline-none text-[var(--text-main)]" value={editValue} onChange={(e) => setEditValue(e.target.value)} onFocus={() => useUIStore.getState().setIsEditing(true)} onBlur={() => { useUIStore.getState().setIsEditing(false); handleBlur(); }} onKeyDown={handleKeyDown} onClick={(e) => e.stopPropagation()} />
            ) : (<span className="truncate block">{title}</span>)}
          </div>
        </div>

        <div className={`flex items-center gap-0.5 transition-opacity ${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          {!isFirst && <button onClick={(e) => { e.stopPropagation(); onMoveUp(); }} className="text-[var(--text-sub)] hover:text-[var(--accent)] p-1.5" title="上移"><ArrowUp size={14} /></button>}
          {!isLast && <button onClick={(e) => { e.stopPropagation(); onMoveDown(); }} className="text-[var(--text-sub)] hover:text-[var(--accent)] p-1.5" title="下移"><ArrowDown size={14} /></button>}
          <button onClick={(e) => { e.stopPropagation(); deleteConfirming ? onDelete() : requestConfirm(); }} className={`p-1.5 transition-all flex items-center justify-center min-w-[28px] rounded ${deleteConfirming ? 'bg-red-500 text-white hover:bg-red-600 px-2' : 'text-[var(--text-sub)] hover:text-red-500'}`} title="删除">{deleteConfirming ? <span className="text-[10px] font-bold whitespace-nowrap">确定?</span> : <Trash2 size={14} />}</button>
        </div>
      </div>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: animDuration }}
            className="overflow-hidden"
          >
            <div className="p-3 border-t border-[var(--border)] bg-[var(--panel-bg)] cursor-auto">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});


const SortableExpandableCard = (props) => {
  const { categoryId, ...rest } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.id,
    data: {
      type: 'item',
      categoryId: categoryId,
    }
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 'auto',
    opacity: isDragging ? 0 : 1, // 拖动时隐藏原项目
  };
  return <ExpandableCard ref={setNodeRef} style={style} attributes={attributes} listeners={listeners} {...rest} />;
};

const SortableCategory = ({ id, cat, children, onToggleCat, onUpdateCat, onAddItem, onDeleteCat, defaultColor, isMobile }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { type: 'category' }
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : 'auto',
    opacity: isDragging ? 0 : 1
  };

  // [优化] 内联删除确认
  const [deleteConfirming, requestConfirm] = useDeleteConfirm();

  // [修复] 添加双击编辑功能
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(cat.name);
  const inputRef = useRef(null);
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef(null);

  useEffect(() => { setEditValue(cat.name); }, [cat.name]);
  useEffect(() => { if (isEditing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [isEditing]);

  // [重构] 新交互逻辑：单击无延迟立即展开，双击撤销展开并进入编辑
  const handleSmartClick = (e) => {
    if (isEditing || e.target.closest('button') || e.target.tagName === 'INPUT' || e.target.closest('[data-dnd-handle]')) return;
    e.preventDefault();

    const now = Date.now();
    const timeSinceLastClick = now - (clickTimerRef.current || 0);

    if (timeSinceLastClick < 300) {
      // 双击：撤销刚才的展开（如果刚展开了就折叠回去），然后进入编辑
      // 不管当前状态如何，都折叠并进入编辑
      if (cat.isExpanded) {
        onToggleCat(cat.id); // 折叠
      }
      setIsEditing(true);
      clickTimerRef.current = 0; // 重置
    } else {
      // 单击：立即展开/折叠（无延迟）
      onToggleCat(cat.id);
      clickTimerRef.current = now; // 记录时间
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (editValue.trim() !== cat.name && editValue.trim()) {
      onUpdateCat(cat.id, { name: editValue.trim() });
    } else {
      setEditValue(cat.name); // 恢复原值
    }
  };
  const handleKeyDown = (e) => { if (e.key === 'Enter') handleBlur(); if (e.key === 'Escape') { setEditValue(cat.name); setIsEditing(false); } };

  // [新增] 点击+号添加卡片时，如果折叠状态则自动展开
  const handleAddClick = (e) => {
    e.stopPropagation();
    // 如果当前是折叠状态，先展开
    if (!cat.isExpanded) {
      onToggleCat(cat.id);
    }
    onAddItem(cat.id);
  };

  return (
    <div ref={setNodeRef} style={style} className="border border-[var(--border)] rounded-lg bg-[var(--panel-bg)] overflow-hidden shadow-sm transition-colors group/cat">
      <div className={`flex items-center justify-between px-3 py-2 bg-[var(--app-bg)] hover:bg-[var(--hover-bg)]`}>
        <div className="flex items-center gap-2 font-bold text-[var(--text-main)] text-xs flex-1" >
          {/* 拖拽手柄 */}
          <div {...attributes} {...listeners} data-dnd-handle className="cursor-grab active:cursor-grabbing p-1 touch-none" onClick={(e) => e.stopPropagation()}>
            <GripVertical size={14} className="text-[var(--text-sub)] opacity-50" />
          </div>
          {/* 分类标题与折叠 - [重构] 新交互逻辑 */}
          <div onClick={handleSmartClick} className="flex items-center gap-2 flex-1 cursor-pointer" title={isMobile ? "单击展开/折叠，双击编辑" : "单击展开，双击编辑"}>
            <ChevronDown size={14} className={`transition-transform duration-200 ${cat.isExpanded ? '' : '-rotate-90'} shrink-0`} style={{ color: cat.color || defaultColor }} />
            {isEditing ? (
              <input
                ref={inputRef}
                className="flex-1 min-w-0 bg-[var(--app-bg)] border border-[var(--accent)] rounded px-1 outline-none text-[var(--text-main)] text-xs"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onFocus={() => useUIStore.getState().setIsEditing(true)}
                onBlur={() => { useUIStore.getState().setIsEditing(false); handleBlur(); }}
                onKeyDown={handleKeyDown}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="truncate">{cat.name}</span>
            )}
            <input type="color" value={cat.color || defaultColor} onClick={(e) => e.stopPropagation()} onChange={(e) => onUpdateCat(cat.id, { color: e.target.value })} className="w-4 h-4 p-0 border-0 rounded overflow-hidden cursor-pointer ml-1 shrink-0" title="设置分类颜色" />
          </div>
        </div>
        {/* 操作按钮 */}
        <div className="flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
          <button onClick={handleAddClick} className="p-1 text-[var(--text-sub)] hover:text-[var(--accent)]"><Plus size={12} /></button>
          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteConfirming ? onDeleteCat(cat.id) : requestConfirm(); }} className={`p-1 transition-all flex items-center justify-center min-w-[20px] rounded ${deleteConfirming ? 'bg-red-500 text-white hover:bg-red-600 px-1.5' : 'text-[var(--text-sub)] hover:text-red-500'}`}>{deleteConfirming ? <span className="text-[9px] font-bold whitespace-nowrap">确定?</span> : <Trash2 size={12} />}</button>
        </div>
      </div>
      <AnimatePresence>
        {cat.isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: animDuration }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const CategoryList = ({ title, categories, items, onAddCat, onToggleCat, onDeleteCat, onUpdateCat, onAddItem, renderItem, icon: Icon, defaultColor, onReorderCat, onReorderItem, onMoveItem, onMoveItemUp, onMoveItemDown, isMobile, collapseTrigger = 'click', onCollapseAll, uiScale = 100 }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [activeId, setActiveId] = useState(null);

  // [修复] 坐标补偿 Modifier：解决 zoom 导致的位移和初始位置双重偏移
  const scaleModifier = useMemo(() => ({ transform, activeNodeRect }) => {
    const scale = uiScale / 100;
    if (!activeNodeRect) return transform;

    return {
      ...transform,
      // 公式推导：
      // 目标屏幕坐标 = Rect
      // 实际初始由于 zoom 缩放 = Rect * scale
      // 需要补偿的初始差距 = Rect - Rect * scale = Rect * (1 - scale)
      // 需要的 CSS Transform (T) 作用后 = T * scale
      // 所以 T * scale = Rect * (1 - scale) + (鼠标位移)
      // T = Rect * (1/scale - 1) + (鼠标位移)/scale
      x: transform.x / scale + activeNodeRect.left * (1 / scale - 1),
      y: transform.y / scale + activeNodeRect.top * (1 / scale - 1),
      scaleX: transform.scaleX, // 保持原有的缩放（如果有）
      scaleY: transform.scaleY
    };
  }, [uiScale]);

  // [修复] 标题栏点击计数器，用于支持双击/三击折叠模式
  const headerClickCountRef = useRef(0);
  const headerClickTimerRef = useRef(null);

  // [修复] 点击标题栏空白区域折叠所有分类
  const handleHeaderClick = (e) => {
    // 确保点击的不是按钮或输入框
    if (e.target.closest('button') || e.target.tagName === 'INPUT') return;
    if (!onCollapseAll) return;

    const requiredClicks = collapseTrigger === 'click' ? 1 : collapseTrigger === 'double' ? 2 : 3;

    headerClickCountRef.current += 1;
    if (headerClickTimerRef.current) clearTimeout(headerClickTimerRef.current);

    if (headerClickCountRef.current >= requiredClicks) {
      onCollapseAll();
      headerClickCountRef.current = 0;
    } else {
      headerClickTimerRef.current = setTimeout(() => {
        headerClickCountRef.current = 0;
      }, 400);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { // [修复] 使用 PointerSensor 统一处理，解决 undefined 错误
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const submitNewCat = () => { if (newCatName.trim()) { onAddCat(newCatName); setNewCatName(''); setIsAdding(false); } else { setIsAdding(false); } };

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
    // [保护] 拖动开始时设置编辑状态，防止 UI 更新打断
    useUIStore.getState().setIsEditing(true);
  };

  const handleDragEnd = (event) => {
    setActiveId(null);
    // [保护] 拖动结束时清除编辑状态
    useUIStore.getState().setIsEditing(false);
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const activeData = active.data.current;
    const overData = over.data.current;

    // Dragging a Category
    if (activeData?.type === 'category' && overData?.type === 'category') {
      onReorderCat(active.id, over.id);
      return;
    }

    // Dragging an Item
    if (activeData?.type === 'item') {
      const overCategoryId = overData?.type === 'category' ? over.id : overData?.categoryId;

      if (!overCategoryId) return;

      const activeCategoryId = activeData.categoryId;

      if (activeCategoryId === overCategoryId) {
        // Reordering within the same category
        onReorderItem(active.id, over.id);
      } else {
        // Moving to a different category
        onMoveItem(active.id, overCategoryId);
      }
    }
  };

  const activeItem = useMemo(() => {
    if (!activeId) return null;
    const item = items.find(i => i.id === activeId);
    if (item) return { ...item, type: 'item' };
    const category = categories.find(c => c.id === activeId);
    if (category) return { ...category, type: 'category' };
    return null;
  }, [activeId, items, categories]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* [修复] 移除内部滚动容器，由 RightPanel 统一处理滚动 */}
      <div className="flex flex-col">
        {/* 标题区域 */}
        <div className="flex-shrink-0 px-1 pb-2 border-b border-[var(--border)] bg-[var(--app-bg)]">
          <div
            className="flex justify-between items-center"
            onClick={handleHeaderClick}
          >
            <h3 className="font-bold text-[var(--text-main)] flex items-center gap-2 text-xs uppercase tracking-wider">
              <Icon size={14} /> {title}
            </h3>
            <button onClick={() => setIsAdding(true)} className="text-xs bg-[var(--hover-bg)] text-[var(--text-sub)] px-2 py-1 rounded hover:bg-[var(--accent-bg)] hover:text-[var(--accent)] flex items-center gap-1">
              <FolderPlus size={12} /> 新建
            </button>
          </div>
          {/* 新建分类输入框 */}
          <AnimatePresence>
            {isAdding && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: animDuration }}
                className="overflow-hidden"
              >
                <div className="mt-2 flex gap-2">
                  <input
                    autoFocus
                    className="flex-1 text-xs border border-[var(--accent)] bg-[var(--panel-bg)] text-[var(--text-main)] rounded px-2 py-1 outline-none"
                    placeholder="输入分类名称..."
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitNewCat()}
                    onBlur={submitNewCat}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {/* [修复] 分类列表区域 - 移除 overflow-y-auto */}
        <div className="px-1 pt-2" onClick={(e) => { if (e.target === e.currentTarget) handleHeaderClick(e); }}>
          {/* 分类列表 (Sortable) */}
          <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {categories.map((cat) => (
                <SortableCategory
                  key={cat.id}
                  id={cat.id}
                  cat={cat}
                  defaultColor={defaultColor}
                  onToggleCat={onToggleCat}
                  onUpdateCat={onUpdateCat}
                  onAddItem={onAddItem}
                  onDeleteCat={onDeleteCat}
                  isMobile={isMobile}
                >
                  {/* 分类内的项目列表 (Sortable) */}
                  <SortableContext
                    items={items.filter((i) => i.categoryId === cat.id).map((i) => i.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="p-2 bg-[var(--app-bg)]/50 min-h-[40px]">
                      {items
                        .filter((i) => i.categoryId === cat.id)
                        .map((item, index, filteredItems) =>
                          renderItem(item, isMobile, index, filteredItems, cat.color || defaultColor)
                        )}
                      {items.filter((i) => i.categoryId === cat.id).length === 0 && (
                        <div className="text-center text-[10px] text-[var(--text-sub)] py-2 border-2 border-dashed border-[var(--border)] rounded opacity-50">
                          拖拽到此处...
                        </div>
                      )}
                    </div>
                  </SortableContext>
                </SortableCategory>
              ))}
            </div>
          </SortableContext>
        </div>
      </div>
      {/* [修复] 拖拽预览层 - 应用坐标补偿 Modifier */}
      <DragOverlay modifiers={[scaleModifier]} adjustScale={false}>
        {activeItem ? (
          activeItem.type === 'category' ? (
            <div className="border border-[var(--accent)] bg-[var(--panel-bg)] rounded-lg p-3 shadow-xl opacity-90 w-[300px]">
              <div className="font-bold text-sm flex items-center gap-2">
                <FolderOpen size={14} /> {activeItem.name}
              </div>
            </div>
          ) : (
            <div className="opacity-90 w-[280px]">
              <div className="bg-[var(--panel-bg)] rounded border border-[var(--accent)] shadow-xl p-2 border-l-4" style={{ borderLeftColor: defaultColor }}>
                <div className="font-bold text-sm">{activeItem.name || activeItem.title}</div>
              </div>
            </div>
          )
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default CategoryList;
export { SortableExpandableCard };
