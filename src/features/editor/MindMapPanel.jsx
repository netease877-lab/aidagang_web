import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { toChineseNum } from '../../constants';
import { useUIStore } from '../../stores/uiStore';  // [新增] 导入 uiStore

// [新增] 用于共享缩放比例的 Context
export const MindMapScaleContext = React.createContext(1);

// 画布组件：处理缩放和拖拽
// [新增] onScaleChange 回调，将缩放比例上报给父组件
const MindMapCanvas = ({ children, onBackgroundClick, wheelBehavior = 'ctrl', collapseTrigger = 'click', onScaleChange }) => {
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [scale, setScale] = useState(1);
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const isDragging = useRef(false);
  const hasMoved = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const isPinching = useRef(false); // [新增] 双指缩放标记，防止误触发点击

  // [新增] 仅用于拖拽过程中的实时位置记录，避免频繁 setState
  const dragPos = useRef({ x: 100, y: 100 });

  // [新增] 用 ref 存储实时 scale，避免闭包捕获旧值
  const scaleRef = useRef(1);

  // 同步 state 到 ref (当 zoom 或外部改变 position 时)
  useEffect(() => {
    dragPos.current = position;
  }, [position]);

  // [新增] 同步 scale 到 ref
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  // [修复] 通过 useEffect 通知父组件 scale 变化，避免在 setState 回调中调用
  useEffect(() => {
    if (onScaleChange) onScaleChange(scale);
  }, [scale, onScaleChange]);

  // 更新 transform 的帮助函数
  const updateTransform = (x, y, s) => {
    if (contentRef.current) {
      contentRef.current.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    }
  };

  useEffect(() => {
    const handleWheel = (e) => {
      if (!containerRef.current || !containerRef.current.contains(e.target)) return;

      const shouldZoom = wheelBehavior === 'direct' || e.ctrlKey || e.metaKey;

      if (shouldZoom) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;

        // [修复] 以鼠标为中心缩放 (Zoom to Cursor)
        const rect = containerRef.current.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;

        setScale(prevScale => {
          const newScale = Math.min(Math.max(prevScale * delta, 0.2), 3);
          // [已移除] onScaleChange 改由 useEffect 触发

          const ratio = newScale / prevScale;

          setPosition(prevPos => ({
            x: cursorX - (cursorX - prevPos.x) * ratio,
            y: cursorY - (cursorY - prevPos.y) * ratio
          }));

          return newScale;
        });
      }
    };

    const handleMouseMove = (e) => {
      if (!isDragging.current) return;
      e.preventDefault();
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;

      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        hasMoved.current = true;
      }

      lastMousePos.current = { x: e.clientX, y: e.clientY };

      // [优化] 直接操作 DOM，不触发 React 重渲染
      const newX = dragPos.current.x + dx;
      const newY = dragPos.current.y + dy;
      dragPos.current = { x: newX, y: newY };
      updateTransform(newX, newY, scaleRef.current); // [修复] 使用 scaleRef
    };

    const handleMouseUp = () => {
      // [优化] 拖拽结束时才同步 State
      if (isDragging.current) {
        setPosition(dragPos.current);
      }
      isDragging.current = false;
      document.body.style.cursor = 'default';
    };

    const handleTouchStart = (e) => {
      // 避免多指/单指冲突，如果是双指，初始化缩放距离
      if (e.touches.length === 2) {
        isDragging.current = false;
        isPinching.current = true; // [新增] 标记双指缩放开始
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        lastMousePos.current = { dist };
      } else if (e.touches.length === 1) {
        isDragging.current = true;
        hasMoved.current = false;
        lastMousePos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    const handleTouchMove = (e) => {
      if (e.touches.length === 2) {
        // 双指缩放
        e.preventDefault();

        const rect = containerRef.current.getBoundingClientRect();
        const touch1 = { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
        const touch2 = { x: e.touches[1].clientX - rect.left, y: e.touches[1].clientY - rect.top };

        // 计算双指中心点 (Pivot Point)
        const centerX = (touch1.x + touch2.x) / 2;
        const centerY = (touch1.y + touch2.y) / 2;

        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );

        const lastDist = lastMousePos.current.dist;
        if (lastDist) {
          const ratio = dist / lastDist; // 本次变化的比例

          setScale(prevScale => {
            const newScale = Math.min(Math.max(prevScale * ratio, 0.2), 3);
            // [已移除] onScaleChange 改由 useEffect 触发

            const actualRatio = newScale / prevScale;

            setPosition(prevPos => ({
              x: centerX - (centerX - prevPos.x) * actualRatio,
              y: centerY - (centerY - prevPos.y) * actualRatio
            }));

            return newScale;
          });

          lastMousePos.current.dist = dist;
        }
      } else if (e.touches.length === 1 && isDragging.current) {
        // 单指拖动
        e.preventDefault();
        const dx = e.touches[0].clientX - lastMousePos.current.x;
        const dy = e.touches[0].clientY - lastMousePos.current.y;

        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
          hasMoved.current = true;
        }

        lastMousePos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };

        // [优化] 直接 DOM 操作
        const newX = dragPos.current.x + dx;
        const newY = dragPos.current.y + dy;
        dragPos.current = { x: newX, y: newY };
        updateTransform(newX, newY, scaleRef.current); // [修复] 使用 scaleRef
      }
    };

    const handleTouchEnd = () => {
      if (isDragging.current) {
        setPosition(dragPos.current);
      }
      isDragging.current = false;
      // [修复] 延迟重置 isPinching，防止 touchend 触发的 click 事件被误判
      setTimeout(() => { isPinching.current = false; }, 300); // 增加到 300ms
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      // 添加触摸监听 (passive: false 以便阻止默认滚动/缩放)
      container.addEventListener('touchstart', handleTouchStart, { passive: false });
      container.addEventListener('touchmove', handleTouchMove, { passive: false });
      container.addEventListener('touchend', handleTouchEnd);
    }
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      if (container) {
        container.removeEventListener('wheel', handleWheel);
        container.removeEventListener('touchstart', handleTouchStart);
        container.removeEventListener('touchmove', handleTouchMove);
        container.removeEventListener('touchend', handleTouchEnd);
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [wheelBehavior]);

  const handleMouseDown = (e) => {
    // 防止拖拽输入框等交互元素
    if (['INPUT', 'TEXTAREA', 'BUTTON'].includes(e.target.tagName)) return;

    isDragging.current = true;
    hasMoved.current = false;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    document.body.style.cursor = 'grabbing';
  };

  // [新增] 自定义多击检测状态
  const clickHistory = useRef([]); // [{ time, x, y }]
  const CLICK_INTERVAL = 400; // 每击间隔不超过 400ms（正常人双击约300-500ms）
  const CLICK_DISTANCE = 30; // 每击坐标误差不超过 30px

  const handleClick = (e) => {
    // [新增] 如果刚结束双指缩放，跳过点击判定并清空历史
    if (isPinching.current) {
      clickHistory.current = [];
      return;
    }
    if (hasMoved.current) {
      hasMoved.current = false;
      clickHistory.current = []; // 移动过也清空历史
      return;
    }

    const now = Date.now();
    const x = e.clientX;
    const y = e.clientY;

    // 过滤掉过期或距离过远的点击
    clickHistory.current = clickHistory.current.filter(click => {
      const timeDiff = now - click.time;
      const dist = Math.hypot(x - click.x, y - click.y);
      return timeDiff <= CLICK_INTERVAL && dist <= CLICK_DISTANCE;
    });

    // 添加当前点击
    clickHistory.current.push({ time: now, x, y });

    // 检查是否满足触发条件
    const clickCount = clickHistory.current.length;
    const req = collapseTrigger === 'double' ? 2 : collapseTrigger === 'triple' ? 3 : 1;

    if (clickCount >= req && onBackgroundClick) {
      onBackgroundClick(e);
      clickHistory.current = []; // 触发后清空
    }
  };

  return (
    <div className="w-full h-full overflow-hidden bg-[var(--app-bg)] relative group/canvas">
      <div className="absolute bottom-6 right-6 z-50 flex gap-2 opacity-30 hover:opacity-100 transition-opacity">
        <div className="flex flex-col gap-2 bg-[var(--panel-bg)] rounded-lg shadow-md border border-[var(--border)] p-1">
          <button
            onClick={() => setScale(s => Math.min(s + 0.1, 3))}
            className="p-2 hover:bg-[var(--hover-bg)] rounded text-[var(--text-sub)] hover:text-[var(--accent)]"
            title="放大"
          >
            <ZoomIn size={20} />
          </button>
          <div className="text-xs text-center font-mono text-[var(--text-sub)] select-none opacity-70">
            {Math.round(scale * 100)}%
          </div>
          <button
            onClick={() => setScale(s => Math.max(s - 0.1, 0.2))}
            className="p-2 hover:bg-[var(--hover-bg)] rounded text-[var(--text-sub)] hover:text-[var(--accent)]"
            title="缩小"
          >
            <ZoomOut size={20} />
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing touch-none"
        style={{
          backgroundImage: 'radial-gradient(circle, var(--border) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          opacity: 0.6
        }}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
      >
        <div
          // [修复] 移除 transition-transform
          // [新增] 绑定 contentRef
          ref={contentRef}
          className="absolute origin-top-left"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            willChange: 'transform' // [新增] GPU 优化提示
          }}
        >
          <div className="p-20">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

// [简化] 带贝塞尔曲线的子节点容器组件 - 起点固定，只测量子节点
const ChildrenWithCurves = ({ visibleChildren, level, indexMap, numStyle, onUpdate, onSelect, allVolumeIds, maxChapterWidth, parentRef, getLayoutCache, setLayoutCache, cacheKey }) => {
  const listRef = useRef(null);
  const childRefs = useRef([]);
  const [curves, setCurves] = useState([]);
  const [unifiedChapterWidth, setUnifiedChapterWidth] = useState(0);

  // [新增] 获取当前缩放比例，修正测量结果
  const scale = React.useContext(MindMapScaleContext);

  // [重构] 添加"已计算"标记，确保宽度只计算一次
  const hasCalculatedWidth = useRef(false);

  // 测量章节真实宽度并统一 (仅当父节点是卷时)
  // [重构] 只在挂载时计算一次
  React.useLayoutEffect(() => {
    if (hasCalculatedWidth.current) return;

    // 尝试读取缓存
    if (getLayoutCache) {
      const cached = getLayoutCache(cacheKey);
      if (cached && cached.width) {
        setUnifiedChapterWidth(cached.width);
        hasCalculatedWidth.current = true;
        return;
      }
    }

    if (level !== 0 || !childRefs.current.length) return;

    let maxWidth = 0;
    childRefs.current.forEach(el => {
      if (el) {
        const w = el.getBoundingClientRect().width;
        if (w > maxWidth) maxWidth = w;
      }
    });

    if (maxWidth > 0) {
      setUnifiedChapterWidth(maxWidth);
      if (setLayoutCache) setLayoutCache(cacheKey, { width: maxWidth });
      hasCalculatedWidth.current = true;
    }
  }, []); // [重构] 空依赖：只在挂载时执行一次

  // [重构] 添加"已计算"标记，确保只计算一次
  const hasCalculatedCurves = useRef(false);

  // 测量子节点位置（相对于列表容器）
  // [重构] 只计算一次，之后永不再算
  React.useLayoutEffect(() => {
    // 如果已经计算过，直接返回
    if (hasCalculatedCurves.current) return;

    // 尝试读取缓存
    if (getLayoutCache) {
      const cached = getLayoutCache(cacheKey);
      if (cached && cached.curves) {
        setCurves(cached.curves);
        hasCalculatedCurves.current = true;
        return;
      }
    }

    const listRect = listRef.current?.getBoundingClientRect();
    if (!listRect) return;

    const startX = -64;
    const listHeight = listRect.height;
    const startY = listHeight / 2;

    const newCurves = childRefs.current.map((ref) => {
      if (!ref) return { startX, startY, endX: 0, endY: startY };
      const childRect = ref.getBoundingClientRect();
      const endX = childRect.left - listRect.left;
      const endY = (childRect.top + childRect.height / 2) - listRect.top;
      return { startX, startY, endX, endY };
    });

    setCurves(newCurves);
    if (setLayoutCache) setLayoutCache(cacheKey, { curves: newCurves });
    hasCalculatedCurves.current = true; // 标记为已计算
  }, []); // [重构] 空依赖：只在挂载时执行一次

  // 计算 SVG 需要覆盖的范围
  const bounds = curves.length > 0 ? {
    minX: Math.min(0, ...curves.map(c => Math.min(c.startX, c.endX))) - 10,
    maxX: Math.max(0, ...curves.map(c => Math.max(c.startX, c.endX))) + 10,
    minY: Math.min(0, ...curves.map(c => Math.min(c.startY, c.endY))) - 10,
    maxY: Math.max(100, ...curves.map(c => Math.max(c.startY, c.endY))) + 10,
  } : { minX: -80, maxX: 10, minY: 0, maxY: 100 };

  return (
    <div className="absolute left-full top-1/2 -translate-y-1/2">
      {/* 子节点列表容器 */}
      <div ref={listRef} className="flex flex-col ml-16 relative">
        {/* SVG 曲线层 - absolute 定位，覆盖从父节点到子节点的区域 */}
        <svg
          className="absolute pointer-events-none"
          style={{
            left: `${bounds.minX}px`,
            top: `${bounds.minY}px`,
            width: `${bounds.maxX - bounds.minX}px`,
            height: `${bounds.maxY - bounds.minY}px`,
            overflow: 'visible',
            zIndex: -1
          }}
        >
          {curves.map((curve, idx) => {
            // 坐标转换到 SVG 内部坐标系
            const x1 = curve.startX - bounds.minX;
            const y1 = curve.startY - bounds.minY;
            const x2 = curve.endX - bounds.minX;
            const y2 = curve.endY - bounds.minY;
            const midX = (x1 + x2) / 2;

            return (
              <path
                key={idx}
                d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                stroke="var(--accent)"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                style={{ opacity: 0.7 }}
              />
            );
          })}
        </svg>

        {visibleChildren.map((child, idx) => {
          const childSiblingIds = visibleChildren.map(c => String(c.id));
          return (
            <div
              key={child.id}
              className="py-3"
            >
              <MindMapNodeBezier
                node={child}
                level={level + 1}
                index={idx}
                total={visibleChildren.length}
                indexMap={indexMap}
                numStyle={numStyle}
                onUpdate={onUpdate}
                onSelect={onSelect}
                allVolumeIds={allVolumeIds}
                siblingIds={childSiblingIds}
                minWidth={level === 0 ? unifiedChapterWidth : undefined}
                nodeCardRef={el => childRefs.current[idx] = el}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};






// 节点组件 (Memoized)
const MindMapNodeBezier = React.memo(({ node, level = 0, index = 0, total = 1, indexMap, numStyle = 'chinese', onUpdate, onSelect, allVolumeIds, siblingIds, minWidth, nodeCardRef, getLayoutCache, setLayoutCache }) => {
  // [修复] fallback 改为 1，避免显示"第零卷"
  const nodeIndexData = (indexMap && indexMap[node.id]) || { volIndex: 1, chIndex: 1 };

  // [重构] 直接从 uiStore 定义状态，确保响应性
  const isExpanded = useUIStore(state => state.expandedNodeIds.has(String(node.id))); // [FIX] 强制 String
  const toggleNodeExpand = useUIStore(state => state.toggleNodeExpand);
  const setNodesExpanded = useUIStore(state => state.setNodesExpanded); // [新增] 用于唯一展开模式

  let titlePrefix = '';
  if (level === 0) {
    titlePrefix = `第${toChineseNum(nodeIndexData.volIndex)}卷`;
  } else if (node.type === 'chapter' && numStyle !== 'none' && nodeIndexData.chIndex > 0) {
    titlePrefix = numStyle === 'chinese' ? `第${toChineseNum(nodeIndexData.chIndex)}章` : `第${nodeIndexData.chIndex}章`;
  }

  const handleClick = (e) => {
    e.stopPropagation();

    // [唯一展开模式] 卷级别且当前未展开，展开时折叠其他所有卷
    if (level === 0 && !isExpanded && allVolumeIds) {
      const otherVolumeIds = allVolumeIds.filter(id => id !== String(node.id));
      if (otherVolumeIds.length > 0) {
        setNodesExpanded(otherVolumeIds, false);
      }
    }

    // [唯一展开模式] 章节级别且当前未展开，展开时折叠同卷下其他章节
    if (level === 1 && !isExpanded && siblingIds) {
      const otherSiblingIds = siblingIds.filter(id => id !== String(node.id));
      if (otherSiblingIds.length > 0) {
        setNodesExpanded(otherSiblingIds, false);
      }
    }

    // [FIX] 先执行 toggle，再执行 select
    // 传递 isLeaf=true 来阻止 handleSelectNode 调用 setNodesExpanded
    toggleNodeExpand(node.id);
    if (onSelect) onSelect(node.id, true); // 强制视为叶子节点，跳过自动展开
  };

  const isSingleLine = node.content && !node.content.includes('\n');
  const isInline = level === 2 && isSingleLine && node.content;

  const visibleChildren = (node.children || []).filter(child => {
    // 卷节点下的展示逻辑
    if (level === 1) return child.content && child.content.trim().length > 0;
    return true;
  });



  const nodeRef = useRef(null);

  // 合并 ref 的回调
  const setNodeRef = (el) => {
    nodeRef.current = el;
    if (nodeCardRef) nodeCardRef(el);
  };

  return (
    <div className="relative w-fit" style={{ zIndex: 10 }}>
      {/* 节点内容卡片 */}
      <div
        ref={setNodeRef}
        onClick={handleClick}
        onMouseDown={(e) => e.stopPropagation()}
        className={`relative flex-shrink-0 flex flex-col justify-center px-4 py-3 rounded-xl shadow-sm text-left transition-shadow cursor-pointer hover:shadow-md border bg-[var(--panel-bg)] z-50 touch-none select-none
        ${level === 0 ? 'border-[var(--accent)] bg-[var(--accent-bg)] shadow-md whitespace-nowrap' : ''} 
        ${level === 1 ? 'border-l-4 whitespace-nowrap' : ''} 
        ${level >= 2 ? 'w-max' : ''}
        ${level < 2 ? 'border-[var(--border)]' : ''}`}
        style={{
          ...(level === 1 ? { borderLeftColor: 'var(--accent)' } : {}),
          // [修复] 卷和章节统一宽度，子项不设 minWidth
          ...(level === 0 ? { minWidth: minWidth > 0 ? `${minWidth}px` : '180px' } : {}),
          ...(level === 1 ? { minWidth: minWidth > 0 ? `${minWidth}px` : '140px' } : {})
          // level >= 2 不设置 minWidth，宽度自适应
        }}
      >
        <div className={`font-bold ${level === 0 ? 'text-lg text-[var(--accent)]' : 'text-sm text-[var(--text-main)]'}`}>
          {titlePrefix && <span className="mr-2 opacity-75">{titlePrefix}</span>}
          {node.title || <span className="text-[var(--text-sub)] italic opacity-50">未命名</span>}
          {isInline && <span className="font-normal text-[var(--text-sub)] ml-1"><span className="mx-1 opacity-50">:</span>{node.content}</span>}

          {visibleChildren.length > 0 && level === 0 && (
            <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full ${isExpanded ? 'bg-[var(--app-bg)] text-[var(--text-sub)]' : 'bg-[var(--accent)] text-white'}`}>
              {visibleChildren.length}
            </span>
          )}
        </div>
        {node.content && (level <= 2 && !isInline) && (
          <div className="mt-2 text-xs text-[var(--text-sub)] border-t border-[var(--border)] pt-2 leading-relaxed whitespace-pre-wrap">
            {node.content}
          </div>
        )}
      </div>

      {/* [重构] 始终渲染子节点
          - 展开时: 正常显示
          - 折叠时: visibility:hidden + position:absolute (可测量但不影响布局)
          这样首次加载时就能测量所有坐标，之后展开/折叠只切换样式 */}
      {visibleChildren.length > 0 && (
        <div style={isExpanded ? {} : {
          visibility: 'hidden',
          position: 'absolute',
          pointerEvents: 'none'
        }}>
          <ChildrenWithCurves
            visibleChildren={visibleChildren}
            level={level}
            indexMap={indexMap}
            numStyle={numStyle}
            onUpdate={onUpdate}
            onSelect={onSelect}
            allVolumeIds={allVolumeIds}
            parentRef={nodeRef}
            getLayoutCache={getLayoutCache}
            setLayoutCache={setLayoutCache}
            cacheKey={String(node.id)}
          />
        </div>
      )}
    </div>
  );
});

export default function MindMapPanel({ data, handleGlobalBackgroundClick, mindMapWheelBehavior, handleUpdate, handleSelectNode, nodeIndexMap, chapterNumStyle, collapseTrigger }) {
  // [新增] 收集所有卷 ID，用于唯一展开模式
  const allVolumeIds = useMemo(() => (data || []).map(vol => String(vol.id)), [data]);

  // [默认折叠] 首次加载数据时，强制折叠所有卷
  const setNodesExpanded = useUIStore(state => state.setNodesExpanded);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    // 如果已有数据且从未初始化过
    if (data && data.length > 0 && !isInitializedRef.current) {
      const volumeIds = data.map(vol => String(vol.id));
      // 批量设置为 false (折叠)
      setNodesExpanded(volumeIds, false);
      isInitializedRef.current = true;
    }
  }, [data, setNodesExpanded]);

  // [新增] 卷节点引用和统一宽度状态
  const volumeRefs = useRef([]);
  const [unifiedVolumeWidth, setUnifiedVolumeWidth] = useState(0);

  // [新增] 状态 lift up: 存储当前 Canvas 缩放比例
  const [canvasScale, setCanvasScale] = useState(1);

  // [新增] 布局缓存系统
  const layoutCache = useRef({}); // { [volId]: { width, curves } }

  // 获取缓存
  const getLayoutCache = React.useCallback((key) => layoutCache.current[key], []);

  // 设置缓存 (合并式更新)
  const setLayoutCache = React.useCallback((key, data) => {
    layoutCache.current[key] = { ...(layoutCache.current[key] || {}), ...data };
  }, []);

  // 数据变化或窗口 resize 时清空缓存
  useEffect(() => {
    layoutCache.current = {};
  }, [data]);

  useEffect(() => {
    let timer;
    const handleResize = () => {
      // 防抖：Resize 停止 200ms 后才清空缓存，避免过程中的频繁重算
      clearTimeout(timer);
      timer = setTimeout(() => {
        layoutCache.current = {};
      }, 200);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, []);

  // [重构] 添加"已计算"标记，确保卷宽度只计算一次
  const hasCalculatedVolumeWidth = useRef(false);

  // 测量所有卷的真实宽度并统一
  // [重构] 只在挂载时计算一次
  React.useLayoutEffect(() => {
    if (hasCalculatedVolumeWidth.current) return;
    if (!data || !data.length) return;

    let maxWidth = 0;
    volumeRefs.current.forEach(el => {
      if (el) {
        const domWidth = el.getBoundingClientRect().width;
        if (domWidth > maxWidth) maxWidth = domWidth;
      }
    });

    if (maxWidth > 0) {
      setUnifiedVolumeWidth(maxWidth);
      hasCalculatedVolumeWidth.current = true;
    }
  }, []); // [重构] 空依赖：只在挂载时执行一次

  // 退出时清空缓存的逻辑已经在 data 变化的 useEffect 中实现 (第609行)

  // 安全检查：如果 data 为空，渲染空状态或null
  if (!data || !Array.isArray(data)) return null;

  return (
    <MindMapCanvas
      onBackgroundClick={handleGlobalBackgroundClick}
      wheelBehavior={mindMapWheelBehavior}
      collapseTrigger={collapseTrigger}
      onScaleChange={setCanvasScale} // [新增]
    >
      <MindMapScaleContext.Provider value={canvasScale}>
        <div className="flex flex-col gap-12">
          {data.map((node, idx) => (
            <MindMapNodeBezier
              key={node.id}
              node={node}
              level={0}
              onUpdate={handleUpdate}
              onSelect={handleSelectNode}
              indexMap={nodeIndexMap}
              numStyle={chapterNumStyle}
              allVolumeIds={allVolumeIds}
              nodeCardRef={el => volumeRefs.current[idx] = el}
              minWidth={unifiedVolumeWidth}
              getLayoutCache={getLayoutCache}
              setLayoutCache={setLayoutCache}
            />
          ))}
        </div>
      </MindMapScaleContext.Provider>
    </MindMapCanvas>
  );
}
