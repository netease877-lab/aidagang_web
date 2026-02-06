import React, { useState, useEffect, useRef, useMemo } from 'react';
import scrollIntoView from 'scroll-into-view-if-needed'; // [New]
import { motion, AnimatePresence } from "framer-motion";
import { useDeleteConfirm } from '../../hooks/useDeleteConfirm';

// [新增] 性能模式检测
const isPerfMode = typeof window !== 'undefined' && localStorage.getItem('mobile_perf_mode') === 'true';
const animDuration = isPerfMode ? 0 : 0.3;
import {
  ChevronRight, ChevronDown, Plus, Trash2, CornerDownRight,
  Minimize2, Maximize2, MapPin, Lightbulb, MoreHorizontal, ShieldAlert,
  ArrowUp, ArrowDown, Circle
} from 'lucide-react';
import { toChineseNum } from '../../constants';
import AutoResizeTextarea from '../../components/common/AutoResizeTextarea';
import { useEntityStore } from '../../stores/entityStore';  // [激进重构] 直接订阅 entityStore
import { useUIStore } from '../../stores/uiStore';  // [新增] 排序模式状态

const MobileActionMenu = ({ node, level, permissions, toggleContent, onAddSibling, onAddChild, onOpenChapterAi, onOpenToxicCheck, handleDeleteClick, deleteConfirming, onMoveUp, onInsertAfter }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const menuRef = useRef(null);
  const longPressTimerRef = useRef(null);

  // [新增] 获取排序状态
  const { reorderState, setReorderState, exitReorderMode } = useUIStore();
  const isReorderSource = reorderState?.sourceId === node.id;
  const isReorderTarget = reorderState && !isReorderSource && reorderState.sourceLevel === level;

  // [新增] 插入模式下自动展开同级节点菜单，退出时自动折叠
  const wasExpandedByReorderRef = useRef(false);
  const wasSourceRef = useRef(false); // [新增] 记录是否是源节点
  useEffect(() => {
    // 记录当前是源节点
    if (isReorderSource) {
      wasSourceRef.current = true;
    }
    // 进入插入模式：目标节点自动展开
    if (isReorderTarget && !isExpanded) {
      setIsExpanded(true);
      wasExpandedByReorderRef.current = true;
    }
    // 退出插入模式：自动折叠（目标节点和源节点都折叠）
    if (!reorderState && (wasExpandedByReorderRef.current || wasSourceRef.current)) {
      setIsExpanded(false);
      wasExpandedByReorderRef.current = false;
      wasSourceRef.current = false;
    }
  }, [isReorderTarget, isReorderSource, reorderState, isExpanded]);

  // 点击外部收起菜单
  useEffect(() => {
    if (!isExpanded) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isExpanded]);

  // [新增] 排序按钮处理
  const handleReorderClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // 插入模式下：点击目标节点执行插入
    if (isReorderTarget) {
      onInsertAfter(reorderState.sourceId, node.id, reorderState.sourceLevel);
      exitReorderMode();
      setIsExpanded(false);
      return;
    }
    // 源节点再次点击：取消插入模式
    if (isReorderSource) {
      exitReorderMode();
      setIsExpanded(false);
      return;
    }
    // 正常模式：单步上移
    onMoveUp(node.id, level);
    setIsExpanded(false);
  };

  const handleReorderLongPress = (e) => {
    // 注意：不能调用 preventDefault()，因为 touch 事件默认是 passive 的
    e.stopPropagation();
    longPressTimerRef.current = setTimeout(() => {
      setReorderState({ sourceId: node.id, sourceLevel: level });
      longPressTimerRef.current = null;
    }, 500);
  };

  const handleReorderRelease = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  return (
    <div ref={menuRef} className="absolute right-1 top-1/2 -translate-y-1/2 z-20">
      {isExpanded ? (
        // 展开状态：显示所有按钮
        <div className="flex items-center gap-1 bg-[var(--panel-bg)] pl-2 rounded-lg shadow-md border border-[var(--border)] py-1 animate-in fade-in slide-in-from-right-2 duration-150">
          {node.type === 'chapter' && (
            <>
              {permissions?.ai_chapter && (
                <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onOpenChapterAi(node.id); setIsExpanded(false); }} className="p-2 rounded hover:bg-yellow-50 text-[var(--text-sub)] hover:text-yellow-500" title="细纲灵感助手">
                  <Lightbulb size={14} />
                </button>
              )}

            </>
          )}
          <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); toggleContent(e); setIsExpanded(false); }} className={`p-2 rounded hover:bg-[var(--hover-bg)] ${node.isContentExpanded ? 'text-[var(--accent)]' : 'text-[var(--text-sub)]'}`} title="展开/收起细纲">
            {node.isContentExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onAddSibling(node.id, level); setIsExpanded(false); }} className="p-2 rounded hover:bg-green-50 text-[var(--text-sub)] hover:text-green-600" title="添加同级">
            <Plus size={14} />
          </button>
          {!node.isLocked && (
            <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onAddChild(node.id); setIsExpanded(false); }} className="p-2 rounded hover:bg-blue-50 text-[var(--text-sub)] hover:text-blue-600" title="添加下级">
              <CornerDownRight size={14} />
            </button>
          )}
          {/* [新增] 排序按钮 */}
          <button
            onMouseDown={handleReorderLongPress}
            onMouseUp={handleReorderRelease}
            onMouseLeave={handleReorderRelease}
            onTouchStart={handleReorderLongPress}
            onTouchEnd={handleReorderRelease}
            onContextMenu={(e) => e.preventDefault()}
            onClick={handleReorderClick}
            className={`p-2 rounded transition-all ${isReorderSource
              ? 'bg-[var(--accent)] text-white rounded-full'
              : isReorderTarget
                ? 'bg-purple-50 text-purple-500'
                : 'hover:bg-gray-100 text-[var(--text-sub)] hover:text-gray-600'
              }`}
            title={isReorderSource ? '取消插入模式' : isReorderTarget ? '插入到此处下方' : '上移 (长按进入插入模式)'}
          >
            {isReorderSource ? <Circle size={14} /> : isReorderTarget ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
          </button>
          {/* [修复] 删除按钮：第一次点击进入确认状态不折叠，第二次点击确认后才折叠 */}
          <button onMouseDown={(e) => { e.stopPropagation(); if (deleteConfirming) { handleDeleteClick(e); setIsExpanded(false); } else { handleDeleteClick(e); } }} className={`p-2 rounded transition-all ${deleteConfirming ? 'bg-red-500 text-white' : 'hover:bg-red-50 text-[var(--text-sub)] hover:text-red-600'}`} title="删除">
            {deleteConfirming ? <span className="text-[10px] font-bold">确定?</span> : <Trash2 size={14} />}
          </button>
          <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsExpanded(false); }} className="p-2 rounded hover:bg-[var(--hover-bg)] text-[var(--text-sub)]" title="收起">
            <MoreHorizontal size={14} />
          </button>
        </div>
      ) : (
        // 折叠状态：只显示 ⋯ 按钮
        <button
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsExpanded(true); }}
          className="p-2 rounded-full bg-[var(--panel-bg)]/80 hover:bg-[var(--panel-bg)] text-[var(--text-sub)] hover:text-[var(--accent)] shadow-sm border border-[var(--border)] transition-all"
          title="更多操作"
        >
          <MoreHorizontal size={16} />
        </button>
      )}
    </div>
  );
};


// 递归节点组件
// props分组：handlers(回调函数), config(配置), 动态值(node/level/activeId等)
const TreeNode = React.memo(({ node, level = 0, isLast = false, activeId, handlers, config }) => {
  // [Debug] Log render - 使用 uiStore 的展开状态
  // console.log(`[TreeNode Render] ID=${node.id} Title=${node.title}`);
  const { onUpdate, onDelete, onAddChild, onAddSibling, onSelect, onOpenChapterAi, onOpenToxicCheck, sendContentSync, getRemoteEditor, isChapterLocked, onCollapseSiblings, onInputChange, onInputBlur, onMoveUp, onInsertAfter, reorderState, setReorderState, exitReorderMode, toggleNodeExpand, setNodeExpanded, setNodesExpanded, setIsEditing } = handlers;
  const { indexMap, numStyle = 'chinese', permissions, isMobile, collapseTrigger = 'click', singleExpand = false, isMarkingMode, markingEntities, onMarkingEntityClick, onCloseMarkingTooltip } = config;

  // [关键修复] 使用 useUIStore.getState() 在事件处理时获取最新状态
  // 但组件渲染时仍使用订阅值来控制 UI
  const isExpanded = useUIStore(state => state.expandedNodeIds.has(String(node.id))); // [FIX] 强制 String
  const [editingField, setEditingField] = useState(null);
  const [localTitle, setLocalTitle] = useState(node.title); // [新增] 用于防抖的本地状态
  const [localContent, setLocalContent] = useState(node.content || ''); // [新增] 内容本地状态，解决日志刷屏
  const [deleteConfirming, requestConfirm] = useDeleteConfirm();
  const inputRef = useRef(null);
  const elementRef = useRef(null);
  const titleRef = useRef(null); // [新增] 用于精确滚动定位到标题栏

  const hasContentModifiedRef = useRef(false); // [新增] 跟踪桌面端打字时是否有内容修改
  const hasTitleModifiedRef = useRef(false); // [新增] 跟踪桌面端打字时是否有标题修改
  const originalTitleRef = useRef(''); // [修复] 保存编辑前的原始标题，用于日志记录
  const longPressTimerRef = useRef(null); // [新增] 长按计时器
  const hasContent = node.content && node.content.trim().length > 0;

  // [新增] 是否为插入模式的源节点
  const isReorderSource = reorderState?.sourceId === node.id;
  // [新增] 是否在插入模式中（但不是源节点）
  const isReorderTarget = reorderState && !isReorderSource && reorderState.sourceLevel === level;

  // [新增] 滚动触发器
  const triggerScroll = () => {
    if (elementRef.current) {
      scrollIntoView(elementRef.current, {
        scrollMode: 'if-needed',
        block: 'nearest', // 保持最近原则，避免大幅跳动
        inline: 'nearest',
        behavior: 'smooth'
      });
    }
  };



  useEffect(() => {
    if (node.isNew && !node.isLocked && !editingField) {
      setEditingField('title');
      setLocalTitle(node.title);
      originalTitleRef.current = node.title; // [修复] 保存原始标题

      // [新增] 新建节点时自动滚动到屏幕中间
      setTimeout(() => {
        if (elementRef.current) {
          scrollIntoView(elementRef.current, {
            scrollMode: 'if-needed',
            block: 'center',
            inline: 'nearest',
            behavior: 'smooth'
          });
        }
      }, 100);
    }
  }, [node.isNew]);

  useEffect(() => {
    if (editingField === 'title') {
      setLocalTitle(node.title);
      originalTitleRef.current = node.title; // [修复] 保存原始标题
      if (inputRef.current) inputRef.current.focus({ preventScroll: true }); // [修复] 阻止原生聚焦滚动
    }
  }, [editingField]);

  // [新增] 同步 Context 内容到本地 (例如切换节点或远程更新时)
  useEffect(() => {
    // [修复] 只有在非编辑模式下，才允许外部内容覆盖本地 state
    // 防止用户正在输入时，因后台静默保存触发的重渲染导致输入被回滚
    const isEditing = useUIStore.getState().isEditing;
    const isModified = hasContentModifiedRef.current;

    // 只有当没有正在编辑，且确实内容不同时才同步
    if (!isEditing && !isModified) {
      setLocalContent(node.content || '');
    }
  }, [node.content]);



  // [新增] 子项节点自动展开：内容 >= 2 行时自动展开细纲
  useEffect(() => {
    if (node.type === 'volume' || node.type === 'chapter') return;
    if (!hasContent || node.isContentExpanded) return;
    if ((node.content || '').split('\n').length >= 2) {
      onUpdate(node.id, { isContentExpanded: true, _isUiState: true });
    }
  }, [node.id]); // 仅在节点 ID 变化（首次渲染）时执行

  // 切换子节点展开/折叠
  const toggleExpand = (e) => {
    e.stopPropagation();
    const willExpand = !isExpanded;
    // [新增] 唯一展开模式：展开时折叠同级其他节点
    if (willExpand && singleExpand && (node.type === 'volume' || node.type === 'chapter') && onCollapseSiblings) {
      onCollapseSiblings(node.id, node.type, level);
    }
    // [重构] 使用 uiStore 的方法操作展开状态
    toggleNodeExpand(node.id);
    // [保留] 折叠时同时折叠简介
    if (!willExpand) {
      onUpdate(node.id, { isContentExpanded: false, _isUiState: true });
    }

    // [修复] 仅在折叠时滚动标题回视野，防止内容消失后页面跳顶
    // [优化] 点击展开/折叠按钮后，也将整个节点平滑滚动到屏幕中间
    setTimeout(() => {
      if (elementRef.current) {
        scrollIntoView(elementRef.current, {
          scrollMode: 'if-needed',
          block: 'center',
          inline: 'nearest',
          behavior: 'smooth'
        });
      }
    }, 100);
  };

  // 切换内容区域展开/折叠
  const toggleContent = (e) => {
    e.stopPropagation();
    onUpdate(node.id, { isContentExpanded: !node.isContentExpanded, _isUiState: true });
  };

  /**
   * 节点点击处理逻辑（简化版）：
   * - 单击：仅切换展开/折叠状态
   * - 双击由 handleNodeDoubleClick 处理
   */
  const handleNodeClick = (e) => {
    // 1. 基础过滤：点击按钮/输入框时不处理
    if (e.target.closest('button') || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }
    e.stopPropagation();

    // 2. 编辑模式下：支持标题区域切换（标题编辑中 或 简介已展开）
    // [时序修复] 必须依赖 isContentExpanded，并配合延长的 onBlur 延时来确保状态正确
    // [修复] 标记模式下禁止编辑
    if (!isMarkingMode && (editingField || node.isContentExpanded)) {
      const isInTitleArea = !!e.target.closest('.node-title-area');
      if (isInTitleArea) {
        setEditingField('title');
        // 延迟聚焦到标题输入框，确保从简介切换时能正确获取焦点
        setTimeout(() => {
          if (inputRef.current) inputRef.current.focus({ preventScroll: true }); // [修复] 阻止原生聚焦滚动
        }, 0);
      }
      return;
    }

    // 3. 标记模式处理
    if (isMarkingMode) {
      onSelect(node.id);
      if (node.type === 'volume' || node.type === 'chapter') {
        // [修复] 使用 isContentExpanded 作为同步基准，确保节点展开和简介展开同步切换
        const willExpand = !node.isContentExpanded;
        if (!willExpand && onCloseMarkingTooltip) onCloseMarkingTooltip();
        // 明确设置展开状态（而不是 toggle）
        setNodeExpanded(node.id, willExpand);
        onUpdate(node.id, { isContentExpanded: willExpand, _isUiState: true });
        // 展开时同时展开所有子项的简介
        if (node.type === 'chapter' && willExpand && node.children && node.children.length > 0) {
          const childIds = node.children.map(c => c.id);
          setNodesExpanded(childIds, true);
          node.children.forEach(child => {
            onUpdate(child.id, { isContentExpanded: true, _isUiState: true });
          });
        }
      } else {
        onUpdate(node.id, { isContentExpanded: !node.isContentExpanded, _isUiState: true });
      }
      return;
    }

    // 4. 单击处理：纯粹的展开/折叠切换
    onSelect(node.id);
    // [优化] 统一逻辑：有子节点时切换节点展开，无子节点时切换内容展开
    if (node.children && node.children.length > 0) {
      const willExpand = !isExpanded;
      if (willExpand && singleExpand && onCollapseSiblings) {
        onCollapseSiblings(node.id, node.type, level);
      }
      setNodeExpanded(node.id, !isExpanded);
    } else {
      // [优化] 子项单击直接进入内容编辑模式（展开内容并聚焦）
      onUpdate(node.id, { isContentExpanded: true, _isUiState: true });
      // 下一帧自动聚焦到该节点的 textarea
      setTimeout(() => {
        const nodeEl = document.querySelector(`[data-node-id="${node.id}"]`);
        const textarea = nodeEl?.querySelector('textarea');
        if (textarea) textarea.focus({ preventScroll: true }); // [修复] 阻止原生聚焦滚动
      }, 0);
    }

    // [新增] 激活后将整个节点滚动到屏幕中间
    setTimeout(() => {
      if (elementRef.current) {
        scrollIntoView(elementRef.current, {
          scrollMode: 'if-needed',
          block: 'center',
          inline: 'nearest',
          behavior: 'smooth'
        });
      }
    }, 300);
  };

  /**
     * 双击处理：进入编辑模式
     * 注意：浏览器原生双击会先触发两次 click，再触发 dblclick
     * 所以双击时节点会先展开再折叠，最后进入编辑模式
     */
  const handleNodeDoubleClick = (e) => {
    // [修复] 标记模式下禁止编辑
    if (isMarkingMode) return;
    if (e.target.closest('button') || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    e.stopPropagation();

    // [优化] 统一逻辑：有子节点时确保展开，无子节点时展开内容
    if (node.children && node.children.length > 0) {
      if (!isExpanded) {
        toggleNodeExpand(node.id);
      }
    }
    onUpdate(node.id, { isContentExpanded: true, _isUiState: true });
    // [优化] 仅卷/章双击进入标题编辑，子项双击直接进入内容编辑（textarea 自动获焦）
    if (node.type === 'volume' || node.type === 'chapter') {
      setEditingField('title');
    }

    // [新增] 激活后将整个节点滚动到屏幕中间
    setTimeout(() => {
      if (elementRef.current) {
        scrollIntoView(elementRef.current, {
          scrollMode: 'if-needed',
          block: 'center',
          inline: 'nearest',
          behavior: 'smooth'
        });
      }
    }, 100);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); setEditingField(null); onAddSibling(node.id, level); }
    else if (e.key === 'Tab') { e.preventDefault(); if (!node.isLocked) onAddChild(node.id); }
    // [移除] Backspace 快捷删除功能，防止误删节点
  };

  const handleDeleteClick = (e) => { e.stopPropagation(); e.preventDefault(); deleteConfirming ? onDelete(node.id) : requestConfirm(); };

  const isActive = activeId === node.id;
  const isVolume = level === 0;
  // [修复] 当 indexMap 中没有节点时，使用基于 config.indexMap 的实时计算或 fallback
  const nodeIndexData = indexMap[node.id] || { volIndex: 1, chIndex: 1 };
  let titlePrefix = '';
  let placeholder = "输入标题";

  if (isVolume) {
    titlePrefix = `第${toChineseNum(nodeIndexData.volIndex)}卷\u00A0\u00A0`;
    placeholder = "输入卷名 (如: 初入江湖)";
  } else if (node.type === 'chapter' && numStyle !== 'none') {
    titlePrefix = numStyle === 'chinese' ? `第${toChineseNum(nodeIndexData.chIndex)}章\u00A0\u00A0` : `第${nodeIndexData.chIndex}章\u00A0\u00A0`;
    placeholder = "输入章节名";
  }

  // 动态样式
  const nodeBgClass = isVolume ? 'bg-[var(--accent)] text-white' : level === 1 ? 'bg-[var(--panel-bg)] border-2 border-[var(--accent)]' : 'bg-[var(--border)]';
  const nodeBorderClass = isActive ? 'border-[var(--accent)] shadow-md ring-2 ring-[var(--accent)]/20' : 'border-[var(--border)] hover:border-[var(--accent)] hover:shadow-sm'; // 增强选中效果
  const lockClass = node.isLocked ? 'bg-[var(--panel-bg)] border-dashed opacity-80' : 'bg-[var(--panel-bg)]';

  return (
    <div className="flex flex-col relative group/node" ref={elementRef}>
      {/* 连接线颜色适配 */}
      <div className={`absolute left-3 top-0 bottom-0 w-0.5 bg-[var(--border)] ${isLast ? 'h-6' : 'h-full'}`}></div>

      {/* 单击：展开/折叠；双击：编辑模式 */}
      <div
        ref={titleRef} // [新增] 绑定 Ref 到标题行容器
        className={`flex items-start ${isMobile ? 'pl-2 pr-2' : 'pl-8 pr-2'} py-2 relative transition-all duration-200`}
        onClick={handleNodeClick}
        onDoubleClick={handleNodeDoubleClick}
      >
        <div className={`absolute left-[5px] top-[14px] rounded-full z-10 box-border cursor-pointer ${isVolume ? 'w-5 h-5 -ml-0.5 shadow-md flex items-center justify-center' : level === 1 ? 'w-4 h-4' : 'w-2 h-2 ml-1 mt-1'} ${nodeBgClass}`} onClick={(e) => { e.stopPropagation(); toggleExpand(e); }}>
          {isVolume && <MapPin size={10} />}
        </div>

        <div
          className={`flex-1 min-w-0 rounded-lg border transition-all duration-200 outline-none ${nodeBorderClass} ${lockClass}`}
          title={!node.isContentExpanded && node.content ? node.content : ''}
          style={isActive ? { "--tw-ring-color": "color-mix(in srgb, var(--accent), transparent 70%)" } : {}}
        >
          <div className="flex items-center p-3 min-h-[40px] relative">
            {node.children.length > 0 && (<button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); toggleExpand(e); }} className="mr-1 text-[var(--text-sub)] hover:text-[var(--accent)] flex-shrink-0 z-10">{isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>)}
            {/* [标识] node-title-area 用于识别双击区域 */}
            <div className="flex-1 flex items-center gap-1 overflow-hidden cursor-text min-w-0 mr-1 node-title-area">
              {titlePrefix && editingField !== 'title' && <span className={`font-bold text-[var(--text-main)] flex-shrink-0 select-none ${isVolume ? 'text-lg' : 'text-base'}`}>{titlePrefix}</span>}
              {editingField === 'title' ? (
                <input
                  ref={inputRef}
                  value={localTitle}
                  onChange={(e) => {
                    setLocalTitle(e.target.value);
                    // [新增] 桌面端：立即更新 data 以支持智能面板实时匹配
                    if (!isMobile) {
                      onUpdate(node.id, { title: e.target.value, _silent: true });
                      hasTitleModifiedRef.current = true;
                    }
                  }}
                  onBlur={() => {
                    // [修复] 桌面端：有修改时强制触发日志，传递原始标题
                    if (!isMobile && hasTitleModifiedRef.current) {
                      onUpdate(node.id, { title: localTitle, _forceLog: true, _originalTitle: originalTitleRef.current });
                      hasTitleModifiedRef.current = false;
                    } else if (localTitle !== (node.title || '')) {
                      onUpdate(node.id, { title: localTitle });
                    }
                    setEditingField(null);
                    // 延迟检测：如果焦点没有转移到简介区域，则折叠简介
                    if (node.type === 'volume' || node.type === 'chapter') {
                      setTimeout(() => {
                        // [修复] 检查全局编辑状态，如果仍在编辑模式则不折叠
                        const stillEditing = useUIStore.getState().isEditing;
                        if (stillEditing) return;
                        const activeEl = document.activeElement;
                        const isInContent = activeEl && activeEl.closest && activeEl.closest('[data-node-id="' + node.id + '"]');
                        if (!isInContent && node.isContentExpanded) {
                          onUpdate(node.id, { isContentExpanded: false, _isUiState: true });
                        }
                      }, 200);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (localTitle !== node.title) {
                        onUpdate(node.id, { title: localTitle });
                      }
                      setEditingField(null);
                      onAddSibling(node.id, level);
                    } else {
                      handleKeyDown(e);
                    }
                  }}
                  className={`flex-1 min-w-0 bg-transparent outline-none border-b-2 border-[var(--accent)] text-[var(--text-main)] ${isVolume ? 'text-lg font-bold' : 'text-base'}`}
                  placeholder={placeholder}
                />
              ) : (
                <>
                  <span className={`${isVolume ? 'text-lg font-bold text-[var(--text-main)]' : 'text-base text-[var(--text-main)]'} truncate`}>{node.title || <span className="text-[var(--text-sub)] italic">未命名</span>}</span>
                  {!node.isContentExpanded && hasContent && !node.content.includes('\n') && (
                    <span className="text-xs text-[var(--text-sub)] ml-2 truncate opacity-70 flex-1 min-w-0"> - {node.content}</span>
                  )}
                </>
              )}
            </div>

            {/* [核心适配] 移动端折叠式工具栏 / 桌面端悬停显示 */}
            {isMobile ? (
              // 移动端：折叠菜单，点击 ⋯ 展开，点击其他地方收起
              <MobileActionMenu
                node={node}
                level={level}
                permissions={permissions}
                toggleContent={toggleContent}
                onAddSibling={onAddSibling}
                onAddChild={onAddChild}
                onOpenChapterAi={onOpenChapterAi}
                onOpenToxicCheck={onOpenToxicCheck}
                handleDeleteClick={handleDeleteClick}
                deleteConfirming={deleteConfirming}
                onMoveUp={onMoveUp}
                onInsertAfter={onInsertAfter}
              />
            ) : (
              // 桌面端：悬停显示
              <div className="flex items-center gap-1 transition-opacity absolute right-1 top-1/2 -translate-y-1/2 z-20 bg-[var(--panel-bg)] pl-2 rounded-l-lg shadow-sm border-l border-[var(--border)] py-1 opacity-0 group-hover/node:opacity-100">
                {node.type === 'chapter' && permissions?.ai_chapter && (
                  <>
                    <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onOpenChapterAi(node.id) }} className="p-2 rounded hover:bg-yellow-50 text-[var(--text-sub)] hover:text-yellow-500" title="细纲灵感助手">
                      <Lightbulb size={14} />
                    </button>
                  </>
                )}
                <div className="w-px h-3 bg-[var(--border)] mx-1"></div>
                <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); toggleContent(e); }} className={`p-2 rounded hover:bg-[var(--hover-bg)] hover:text-[var(--accent)] ${!node.content && !editingField ? 'text-[var(--border)]' : node.isContentExpanded ? 'text-[var(--accent)]' : 'text-[var(--text-sub)]'}`} title="展开/收起细纲">{node.isContentExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}</button>
                <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onAddSibling(node.id, level) }} className="p-2 rounded hover:bg-green-50 text-[var(--text-sub)] hover:text-green-600" title="添加同级"><Plus size={14} /></button>
                {!node.isLocked && <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onAddChild(node.id) }} className="p-2 rounded hover:bg-blue-50 text-[var(--text-sub)] hover:text-blue-600" title="添加下级"><CornerDownRight size={14} /></button>}
                {/* [新增] 排序按钮 */}
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // 插入模式下：点击目标节点执行插入
                    if (isReorderTarget) {
                      onInsertAfter(reorderState.sourceId, node.id, reorderState.sourceLevel);
                      exitReorderMode();
                      return;
                    }
                    // 源节点再次点击：取消插入模式
                    if (isReorderSource) {
                      exitReorderMode();
                      return;
                    }
                    // 正常模式：启动长按计时器
                    longPressTimerRef.current = setTimeout(() => {
                      setReorderState({ sourceId: node.id, sourceLevel: level });
                      longPressTimerRef.current = null;
                    }, 500);
                  }}
                  onMouseUp={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // 短按：单步上移
                    if (longPressTimerRef.current) {
                      clearTimeout(longPressTimerRef.current);
                      longPressTimerRef.current = null;
                      if (!reorderState) {
                        onMoveUp(node.id, level);
                      }
                    }
                  }}
                  onMouseLeave={() => {
                    if (longPressTimerRef.current) {
                      clearTimeout(longPressTimerRef.current);
                      longPressTimerRef.current = null;
                    }
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                  className={`p-2 rounded transition-all ${isReorderSource
                    ? 'bg-[var(--accent)] text-white rounded-full'
                    : isReorderTarget
                      ? 'hover:bg-purple-50 text-purple-500'
                      : 'hover:bg-gray-100 text-[var(--text-sub)] hover:text-gray-600'
                    }`}
                  title={isReorderSource ? '取消插入模式' : isReorderTarget ? '插入到此处下方' : '上移 (长按进入插入模式)'}
                >
                  {isReorderSource ? <Circle size={14} /> : isReorderTarget ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
                </button>
                <button onMouseDown={handleDeleteClick} className={`p-2 rounded transition-all flex items-center justify-center min-w-[28px] ${deleteConfirming ? 'bg-red-500 text-white hover:bg-red-600 px-2' : 'hover:bg-red-50 text-[var(--text-sub)] hover:text-red-600'}`} title="删除">{deleteConfirming ? <span className="text-[10px] font-bold whitespace-nowrap">确定?</span> : <Trash2 size={14} />}</button>
              </div>
            )}
          </div>
          {node.isContentExpanded && (
            <div className="px-3 pb-3 pt-0 animate-in fade-in slide-in-from-top-1" data-node-id={node.id} onClick={(e) => { e.stopPropagation(); }}>
              <div className="border-t border-[var(--border)] pt-2">
                {/* [新增] 标记模式下显示高亮内容，否则显示可编辑的 textarea */}
                {isMarkingMode && markingEntities ? (
                  // 标记模式：显示带高亮的可点击内容
                  <div
                    className="text-sm text-[var(--text-sub)] leading-relaxed p-2 rounded whitespace-pre-wrap break-words"
                    style={{ fontFamily: 'inherit', backgroundColor: 'color-mix(in srgb, var(--accent-bg) 20%, transparent)' }}
                  >
                    {(() => {
                      const content = node.content || '';
                      if (!content) return <span className="opacity-50">（无内容）</span>;

                      // 收集所有实体名字
                      const { characters = [], scenes = [], worldSettings = [], charCats = [], sceneCats = [], settingCats = [], defaultCharColor, defaultSceneColor, defaultSettingColor } = markingEntities;

                      const entityMap = {};
                      characters.forEach(c => {
                        if (c.name) {
                          const cat = charCats.find(cat => cat.id === c.category_id);
                          entityMap[c.name] = { type: 'character', color: cat?.color || defaultCharColor };
                        }
                      });
                      scenes.forEach(s => {
                        if (s.name) {
                          const cat = sceneCats.find(cat => cat.id === s.category_id);
                          entityMap[s.name] = { type: 'scene', color: cat?.color || defaultSceneColor };
                        }
                      });
                      worldSettings.forEach(s => {
                        if (s.name) {
                          const cat = settingCats.find(cat => cat.id === s.category_id);
                          entityMap[s.name] = { type: 'setting', color: cat?.color || defaultSettingColor };
                        }
                      });

                      const entityNames = Object.keys(entityMap).filter(n => n);
                      if (entityNames.length === 0) return content;

                      // 按长度降序排列，避免短名字覆盖长名字
                      entityNames.sort((a, b) => b.length - a.length);
                      const regex = new RegExp(`(${entityNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');

                      const parts = content.split(regex);
                      return parts.map((part, i) => {
                        const entity = entityMap[part];
                        if (entity) {
                          return (
                            <span
                              key={i}
                              onClick={(e) => {
                                e.stopPropagation();
                                // [修复] 使用 getClientRects() 获取每行的矩形，处理跨行文本定位
                                const rects = e.target.getClientRects();
                                let rect = e.target.getBoundingClientRect(); // 默认使用整体边界
                                if (rects.length > 1) {
                                  // 跨行情况：找到点击位置所在的行
                                  const clickY = e.clientY;
                                  for (const r of rects) {
                                    if (clickY >= r.top && clickY <= r.bottom) {
                                      rect = r;
                                      break;
                                    }
                                  }
                                  // 如果没找到（边界情况），使用最后一个矩形
                                  if (!rect || rect === e.target.getBoundingClientRect()) {
                                    rect = rects[rects.length - 1];
                                  }
                                }
                                onMarkingEntityClick && onMarkingEntityClick(part, entity.type, rect);
                              }}
                              className="cursor-pointer rounded transition-all hover:opacity-80"
                              style={{
                                backgroundColor: `${entity.color}20`,
                                color: entity.color,
                                boxShadow: `0 2px 0 0 ${entity.color}`
                              }}
                            >
                              {part}
                            </span>
                          );
                        }
                        return part;
                      });
                    })()}
                  </div>
                ) : (
                  // 正常模式：可编辑的 textarea
                  <AutoResizeTextarea
                    value={localContent}
                    onChange={(e) => {
                      setLocalContent(e.target.value);
                      // [修复] 移动端也标记为"已修改"，提供双重防回退保护
                      hasContentModifiedRef.current = true;

                      if (!isMobile) {
                        onUpdate(node.id, { content: e.target.value, _silent: true });
                      }
                      if (sendContentSync && node.type === 'chapter') {
                        sendContentSync(node.id, e.target.value, { start: e.target.selectionStart, end: e.target.selectionEnd });
                      }
                      if (onInputChange) {
                        onInputChange(e.target.value, e.target);
                      }
                    }}
                    onFocus={() => { onSelect(node.id); if (setIsEditing) setIsEditing(true); }}
                    onBlur={() => {
                      if (!isMobile && hasContentModifiedRef.current) {
                        onUpdate(node.id, { content: localContent, _forceLog: true });
                      } else if (localContent !== (node.content || '')) {
                        onUpdate(node.id, { content: localContent });
                      }

                      hasContentModifiedRef.current = false;

                      if (onInputBlur && typeof onInputBlur === 'function') {
                        onInputBlur();
                      }

                      // [核心修复] 延迟重置编辑状态和自动折叠
                      if (node.type === 'volume' || node.type === 'chapter') {
                        setTimeout(() => {
                          if (setIsEditing) setIsEditing(false);

                          // Double check isEditing from store
                          if (useUIStore.getState().isEditing) return;

                          const activeEl = document.activeElement;
                          const isInTitle = activeEl && activeEl.tagName === 'INPUT';
                          if (!isInTitle) {
                            onUpdate(node.id, { isContentExpanded: false, _isUiState: true });
                          }
                        }, 400);
                      } else {
                        // [优化] 子项：统一自动折叠，和章节行为一致
                        setTimeout(() => {
                          if (setIsEditing) setIsEditing(false);

                          // 检查焦点是否仍在编辑模式或标题输入框
                          if (useUIStore.getState().isEditing) return;
                          const activeEl = document.activeElement;
                          const isInTitle = activeEl && activeEl.tagName === 'INPUT';
                          if (!isInTitle) {
                            onUpdate(node.id, { isContentExpanded: false, _isUiState: true });
                          }
                        }, 400);
                      }
                    }}
                    className="text-sm text-[var(--text-sub)] leading-relaxed p-2 rounded focus:ring-1 transition-all placeholder:text-[var(--text-sub)]/50 focus:outline-none"
                    style={{ "--tw-ring-color": "color-mix(in srgb, var(--accent), transparent 50%)", fontFamily: 'inherit', backgroundColor: 'color-mix(in srgb, var(--accent-bg) 20%, transparent)' }}
                    placeholder={node.placeholder || "输入本章细纲/简介..."}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <AnimatePresence>
        {isExpanded && node.children.length > 0 && (
          <motion.div
            key="content"
            initial="collapsed"
            animate="open"
            exit="collapsed"
            variants={{
              open: { opacity: 1, height: "auto" },
              collapsed: { opacity: 0, height: 0 }
            }}
            transition={{ duration: animDuration, ease: "easeInOut" }}
            onAnimationComplete={() => triggerScroll()}
            className="overflow-hidden"
          >
            <div
              className={`ml-0`}
            >
              {node.children.map((child, idx) => (
                <TreeNode key={child.id || `child-${node.id}-${idx}`} node={child} level={level + 1} isLast={idx === node.children.length - 1} activeId={activeId} handlers={handlers} config={config} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default function OutlinePanel({
  data, handleUpdate, handleDelete, handleAddChild, handleAddSibling, handleSelectNode,
  activeNodeId, chapterNumStyle, nodeIndexMap, editorMaxWidth, onOpenChapterAi, onOpenToxicCheck, // [新增]
  permissions, isMobile = false, collapseTrigger = 'click', singleExpand = false,
  sendContentSync, getRemoteEditor, isChapterLocked, handleAddRoot,
  onInputChange, // [新增] 输入回调 - 用于手机端智能气泡
  onInputBlur, // [新增] 失去焦点回调
  onMoveUp, // [新增] 章节上移
  onInsertAfter, // [新增] 插入模式
  // [激进重构] 移除实体相关 props，改为内部从 Store 获取
  isMarkingMode = false,
  onMarkingEntityClick,
  onCloseMarkingTooltip
}) {
  const {
    characters, scenes, worldSettings,
    charCats, sceneCats, settingCats,
    defaultCharColor, defaultSceneColor, defaultSettingColor
  } = useEntityStore();

  // [新增] 从 uiStore 获取排序模式状态和展开状态
  const {
    reorderState, setReorderState, exitReorderMode,
    expandedNodeIds, toggleNodeExpand, setNodeExpanded, setNodesExpanded, collapseAllNodes,
    setIsEditing // [新增] 编辑状态控制
  } = useUIStore();

  // [新增] ESC 键退出插入模式
  useEffect(() => {
    if (!reorderState) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        exitReorderMode();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [reorderState, exitReorderMode]);

  // [新增] 折叠同级节点的回调
  const collapseSiblings = (nodeId, nodeType, level) => {
    // [重构] 收集需要折叠的节点ID
    const getDescendantIds = (node) => {
      const ids = [node.id];
      if (node.children) {
        node.children.forEach(child => {
          ids.push(...getDescendantIds(child));
        });
      }
      return ids;
    };

    const idsToCollapse = [];

    if (nodeType === 'volume') {
      // 卷级别：折叠其他所有卷及其子节点
      data.forEach(vol => {
        if (vol.id !== nodeId && vol.type === 'volume') {
          idsToCollapse.push(...getDescendantIds(vol));
        }
      });
    } else if (nodeType === 'chapter') {
      // 章节级别：折叠同一卷下的其他章节
      for (const vol of data) {
        if (vol.type === 'volume' && vol.children) {
          const chapterInVol = vol.children.find(ch => ch.id === nodeId);
          if (chapterInVol) {
            vol.children.forEach(ch => {
              if (ch.id !== nodeId && ch.type === 'chapter') {
                idsToCollapse.push(...getDescendantIds(ch));
              }
            });
            break;
          }
        }
      }
    }

    // [重构] 使用 uiStore 批量折叠
    if (idsToCollapse.length > 0) {
      setNodesExpanded(idsToCollapse, false);
    }
  };

  // [优化] 使用useMemo包裹handlers和config，避免每次渲染都创建新对象导致React.memo失效
  const handlers = useMemo(() => ({
    onUpdate: handleUpdate, onDelete: handleDelete, onAddChild: handleAddChild,
    onAddSibling: handleAddSibling, onSelect: handleSelectNode, onOpenChapterAi, onOpenToxicCheck,
    sendContentSync, getRemoteEditor, isChapterLocked,
    onCollapseSiblings: collapseSiblings,
    onInputChange,
    onInputBlur,
    // [新增] 排序相关
    onMoveUp,
    onInsertAfter,
    reorderState,
    setReorderState,
    exitReorderMode,
    // [新增] 展开状态操作
    toggleNodeExpand,
    setNodeExpanded,
    setNodesExpanded,
    collapseAllNodes,
    // [新增] 编辑状态
    setIsEditing
  }), [handleUpdate, handleDelete, handleAddChild, handleAddSibling, handleSelectNode, onOpenChapterAi, onOpenToxicCheck, sendContentSync, getRemoteEditor, isChapterLocked, onInputChange, onInputBlur, onMoveUp, onInsertAfter, reorderState, setReorderState, exitReorderMode, toggleNodeExpand, setNodeExpanded, setNodesExpanded, collapseAllNodes, setIsEditing]);

  const config = useMemo(() => ({
    indexMap: nodeIndexMap, numStyle: chapterNumStyle, permissions, isMobile, collapseTrigger, singleExpand,
    isMarkingMode,
    markingEntities: { characters, scenes, worldSettings, charCats, sceneCats, settingCats, defaultCharColor, defaultSceneColor, defaultSettingColor },
    onMarkingEntityClick,
    onCloseMarkingTooltip
  }), [nodeIndexMap, chapterNumStyle, permissions, isMobile, collapseTrigger, singleExpand, isMarkingMode, characters, scenes, worldSettings, charCats, sceneCats, settingCats, defaultCharColor, defaultSceneColor, defaultSettingColor, onMarkingEntityClick, onCloseMarkingTooltip]);

  const containerStyle = { maxWidth: editorMaxWidth >= 2000 ? 'none' : `${editorMaxWidth}px`, width: '100%' };

  return (
    <div className="h-full">
      <div className={`mx-auto min-h-full bg-[var(--panel-bg)] shadow-sm border-x border-[var(--border)] ${isMobile ? 'p-2' : 'p-8'} pointer-events-auto transition-all duration-300`} style={containerStyle}>
        {data.map((node, idx) => (
          <TreeNode key={node.id || `root-${idx}`} node={node} level={0} isLast={false} activeId={activeNodeId} handlers={handlers} config={config} />
        ))}
        {/* [新增] 新建卷按钮 - 仅 data 为空时显示 */}
        {(!data || data.length === 0) && (
          <button
            onClick={() => handleAddRoot && handleAddRoot()}
            className="w-full py-4 text-center text-[var(--text-sub)] hover:text-[var(--accent)] hover:bg-[var(--hover-bg)] rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-2"
          >
            <Plus size={16} /> 新建卷
          </button>
        )}
        <div className="h-10 pointer-events-none"></div>
      </div>
    </div>
  );
}
