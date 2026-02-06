// ==================================================
// File: frontend/src/components/layout/MobileLayout.jsx
// [激进重构] 完全删除 EditorContext 依赖
// ==================================================
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MotionConfig } from 'framer-motion'; // [新增] 用于性能模式禁用动画
import {
  Network, AlignLeft, BookOpen, Users, Settings, Sun, Moon,
  Sparkles, Map, Database, LogOut, ShieldAlert, Search, Expand, Shrink, MessageCircle
} from 'lucide-react';
import { THEMES } from '../../constants';
import OutlinePanel from '../../features/editor/OutlinePanel';
import MindMapPanel from '../../features/editor/MindMapPanel';
import RightPanel, { ZenSmartWidget } from '../../features/database/RightPanel';
import SettingsPanel from '../../features/settings/SettingsPanel';
import SearchModal from '../common/SearchModal';
import StatusIndicators from '../common/StatusIndicators';
import MobileSmartTooltip from '../../features/smart/MobileSmartTooltip';

// [激进重构] 直接从 Stores 和 Contexts 获取数据
// [激进重构] 直接从 Stores 和 Contexts 获取数据
import { useUIStore, useEditorStore, useModalStore, useEntityStore, useSettingsStore, useWsStore } from '../../stores';
import { useNovel, useUser, useToast } from '../../contexts';
import { NovelSelector } from '../AppWidgets';

export default function MobileLayout() {
  // ========== 从 Zustand Stores 获取状态 ==========
  const viewMode = useUIStore(state => state.viewMode);
  const setViewMode = useUIStore(state => state.setViewMode);
  const rightPanelTab = useUIStore(state => state.rightPanelTab);
  const setRightPanelTab = useUIStore(state => state.setRightPanelTab);
  const isZenMode = useUIStore(state => state.isZenMode);
  const setIsZenMode = useUIStore(state => state.setIsZenMode);

  // [修复] 从 Store 获取真实的 WebSocket 状态
  const wsStatus = useWsStore(state => state.status);
  const webdavStatus = useWsStore(state => state.webdavStatus);

  const activeNodeId = useEditorStore(state => state.activeNodeId);
  const setActiveNodeId = useEditorStore(state => state.setActiveNodeId);
  const smartContextData = useEditorStore(state => state.smartContextData) || { chars: [], scenes: [], settings: [], content: '', nodeTitle: '' };
  const nodeIndexMap = useEditorStore(state => state.nodeIndexMap) || new Map();

  const setIsOutlineAiOpen = useModalStore(state => state.setIsOutlineAiOpen);

  // Entity Store
  const characters = useEntityStore(state => state.characters);
  const scenes = useEntityStore(state => state.scenes);
  const worldSettings = useEntityStore(state => state.worldSettings);
  const data = useEntityStore(state => state.data); // [Refactor] Direct access to outline data

  // ========== 从 Contexts 获取数据 ==========
  const novel = useNovel();
  const user = useUser();
  const toast = useToast();

  const { currentUser, config: userConfig = {}, permissions = {}, getStorageKey, isConfigLoading } = user;
  const { addToast } = toast;
  const dbSyncStatus = novel.dbSyncStatus || 'idle';

  // [异常处理] 如果 UI 渲染用户名为 'User' 持续 3 秒，则跳转登录
  // 任何情况下 UI 显示 'User' 都是异常状态
  const userCheckTimerRef = useRef(null);

  const checkAndRedirectIfUserDefault = useCallback(() => {
    // 清除之前的定时器
    if (userCheckTimerRef.current) {
      clearTimeout(userCheckTimerRef.current);
    }

    // 检查 UI 是否会显示 'User'
    if (!currentUser?.nickname && !currentUser?.email) {
      // 启动 3 秒延迟检测
      userCheckTimerRef.current = setTimeout(() => {
        if (!currentUser?.nickname && !currentUser?.email) {
          console.warn('[MobileLayout] UI 渲染用户为 User 超过 3 秒，跳转登录');
          window.location.href = '/user-login';
        }
      }, 3000);
    }
  }, [currentUser?.nickname, currentUser?.email]);

  // 组件挂载时检测
  useEffect(() => {
    checkAndRedirectIfUserDefault();
    return () => {
      if (userCheckTimerRef.current) clearTimeout(userCheckTimerRef.current);
    };
  }, [checkAndRedirectIfUserDefault]);

  // 页面恢复可见时重新检测（处理浏览器后台恢复场景）
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkAndRedirectIfUserDefault();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [checkAndRedirectIfUserDefault]);


  const {
    novels, setNovels, currentNovelId, setCurrentNovelId,
    createEmptyNovel, deleteNovel,
    // data, // [Refactor] Removed from Context
    handleUpdateNode, handleDeleteNode, handleAddChildNode, handleAddSiblingNode, handleAddRoot,
    handleToggleAccordion,
    handleMoveNodeUp, handleInsertAfter, // [新增] 章节排序
  } = novel;

  // ========== 从 settingsStore 获取配置（修复数据流断裂）==========
  const currentThemeId = useSettingsStore(state => state.currentThemeId);
  const chapterNumStyle = useSettingsStore(state => state.chapterNumStyle);
  const editorMaxWidth = useSettingsStore(state => state.editorMaxWidth);
  const mindMapWheelBehavior = useSettingsStore(state => state.mindMapWheelBehavior);
  const uiScale = useSettingsStore(state => state.uiScale);
  const isSeamlessBg = useSettingsStore(state => state.isSeamlessBg);
  const workspaceBgColor = useSettingsStore(state => state.workspaceBgColor);
  const currentWorkspaceColor = isSeamlessBg ? 'transparent' : workspaceBgColor;
  const collapseTrigger = useSettingsStore(state => state.collapseTrigger);
  const singleExpand = useSettingsStore(state => state.singleExpand);
  const mobileSmartTooltip = useSettingsStore(state => state.mobileSmartTooltip);
  const webdavConfig = useSettingsStore(state => state.webdavConfig); // [优化] 用于判断 WebDAV 是否已启用

  // ========== 本地状态 ==========
  const [mobileTab, setMobileTab] = useState('editor');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [tooltipInputText, setTooltipInputText] = useState('');
  const [tooltipCursorPos, setTooltipCursorPos] = useState(null);
  const [isMarkingMode, setIsMarkingMode] = useState(false);
  const [markingModeEntity, setMarkingModeEntity] = useState(null);
  const longPressTimerRef = useRef(null);
  const headerRef = useRef(null);
  const leftContainerRef = useRef(null);
  const [visibleLights, setVisibleLights] = useState(3);
  const LONG_PRESS_DURATION = 500;

  // ========== 双指捏合手势（触发强制折叠） ==========
  const pinchStartDistRef = useRef(null);
  const pinchTriggeredRef = useRef(false);
  const PINCH_THRESHOLD = 60; // 捏合阈值（像素）

  const getDistance = (touches) => {
    const [t1, t2] = [touches[0], touches[1]];
    return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
  };

  const handlePinchStart = (e) => {
    if (e.touches.length === 2) {
      pinchStartDistRef.current = getDistance(e.touches);
      pinchTriggeredRef.current = false;
    }
  };

  const handlePinchMove = (e) => {
    // [修复] 思维导图模式下禁用双指捏合触发折叠，避免与思维导图的双指缩放冲突
    if (viewMode === 'mindmap') return;

    if (e.touches.length === 2 && pinchStartDistRef.current !== null && !pinchTriggeredRef.current) {
      const currentDist = getDistance(e.touches);
      const delta = pinchStartDistRef.current - currentDist; // 正值=捏合
      if (delta > PINCH_THRESHOLD) {
        pinchTriggeredRef.current = true;
        // 根据当前 Tab 调用对应的折叠方法
        if (mobileTab === 'editor') {
          handleGlobalBackgroundClick(); // 大纲折叠
        } else if (mobileTab === 'database') {
          // 资料库折叠（角色/场景/设定）
          const { collapseAllCats } = useEntityStore.getState();
          if (rightPanelTab === 'chars') collapseAllCats('char');
          else if (rightPanelTab === 'scenes') collapseAllCats('scene');
          else if (rightPanelTab === 'world') collapseAllCats('setting');
        }
        addToast('已激活强制折叠', 'success');
      }
    }
  };

  const handlePinchEnd = () => {
    pinchStartDistRef.current = null;
    pinchTriggeredRef.current = false;
  };

  // ========== 方法 ==========
  const setCurrentThemeId = useSettingsStore(state => state.setCurrentThemeId);
  const toggleDayNight = useCallback(() => {
    // [修复] 切换日/夜模式：手机端同步纯本地逻辑
    // 逻辑：修改 localStorage -> 更新 Store (立即生效)
    const isNightMode = localStorage.getItem('novel_night_mode') === 'true';
    const newMode = !isNightMode;
    localStorage.setItem('novel_night_mode', newMode.toString());

    if (newMode) {
      // 切换到夜间模式：记录当前主题并强制设为 dark
      const currentSettings = useSettingsStore.getState();
      if (currentThemeId !== 'dark') {
        useSettingsStore.getState().setSettings({ previousThemeId: currentThemeId });
      }
      setCurrentThemeId('dark');
    } else {
      // 切换回日间模式：恢复之前的主题
      const prevTheme = useSettingsStore.getState().previousThemeId || 'default';
      const restoreTheme = prevTheme === 'dark' ? 'default' : prevTheme;
      setCurrentThemeId(restoreTheme);
    }
  }, [currentThemeId, setCurrentThemeId]);

  const handleSelectNode = useCallback((id, isLeaf, path) => {
    // [修复] 搜索跳转时自动展开路径中的所有父节点
    // [重构] 使用 uiStore 方法
    if (path && path.length > 0) {
      const { setNodesExpanded } = useUIStore.getState();
      const idsToExpand = path.map(nodeInfo => nodeInfo.id);
      // 非叶子节点也需要展开
      if (!isLeaf && !idsToExpand.includes(id)) {
        idsToExpand.push(id);
      }
      setNodesExpanded(idsToExpand, true);
    } else if (!isLeaf) {
      // 没有路径但非叶子节点，也需要展开
      const { setNodesExpanded } = useUIStore.getState();
      setNodesExpanded([id], true);
    }
    setActiveNodeId(id);
    if (isLeaf) setRightPanelTab('smart');
  }, [setActiveNodeId, setRightPanelTab]);

  const handleOpenChapterAi = useCallback((chapterId) => {
    useEditorStore.getState().setActiveChapterIdForAi(chapterId);
    useModalStore.getState().setIsChapterAiOpen(true);
  }, []);

  const handleOpenToxicCheck = useCallback((nodeId) => {
    useEditorStore.getState().setActiveNodeIdForToxic(nodeId);
    useModalStore.getState().setIsToxicCheckOpen(true);
  }, []);

  const handleGlobalBackgroundClick = useCallback(() => {
    if (handleToggleAccordion) handleToggleAccordion();
  }, [handleToggleAccordion]);

  const openOperationLog = useCallback(() => {
    useModalStore.getState().setOperationLogOpen(true);
  }, []);

  // 智能气泡处理
  const handleTooltipInput = (text, textareaElement) => {
    const cursorPos = textareaElement ? (textareaElement.selectionStart || 0) : 0;
    setTooltipInputText(text.slice(0, cursorPos));
    if (textareaElement) {
      const rect = textareaElement.getBoundingClientRect();
      const style = window.getComputedStyle(textareaElement);
      const lineHeight = parseFloat(style.lineHeight) || 20;
      const paddingTop = parseFloat(style.paddingTop) || 8;
      const textBeforeCursor = text.slice(0, cursorPos);
      const lines = textBeforeCursor.split('\n');
      const currentLineIndex = lines.length - 1;
      const cursorY = rect.top + paddingTop + (currentLineIndex * lineHeight) + lineHeight;
      const tooltipHeight = 200;
      const hasSpaceAbove = cursorY - tooltipHeight > 20;
      const direction = hasSpaceAbove ? 'up' : 'down';
      setTooltipCursorPos({
        y: direction === 'up' ? cursorY - lineHeight : cursorY,
        direction,
        textareaInfo: { rect, paddingLeft: parseFloat(style.paddingLeft) || 12, lineHeight, paddingTop, fontFamily: style.fontFamily, fontSize: style.fontSize, currentLineIndex, fullText: text, textareaElement }
      });
    }
  };

  const handleTooltipBlur = () => {
    setTooltipInputText('');
    setMarkingModeEntity(null);
  };

  const handleLongPressStart = () => {
    longPressTimerRef.current = setTimeout(() => {
      setIsMarkingMode(prev => !prev);
      setMarkingModeEntity(null);
    }, LONG_PRESS_DURATION);
  };

  const handleLongPressEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleMarkingEntityClick = (entityName, entityType, rect) => {
    let entityData = null;
    if (entityType === 'character') entityData = characters.find(c => c.name === entityName);
    else if (entityType === 'scene') entityData = scenes.find(s => s.name === entityName);
    else if (entityType === 'setting') entityData = worldSettings.find(s => s.name === entityName);
    if (entityData) setMarkingModeEntity({ type: entityType, data: entityData, rect });
  };

  useEffect(() => {
    return () => { if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current); };
  }, []);

  useEffect(() => {
    const checkSpace = () => {
      if (!headerRef.current) return;
      const headerWidth = headerRef.current.clientWidth;
      const leftContent = leftContainerRef.current?.firstElementChild;
      const leftContentWidth = leftContent ? leftContent.scrollWidth : 0;
      const availableForLeft = headerWidth - 120 - 24;
      const extraSpace = availableForLeft - leftContentWidth;
      setVisibleLights(extraSpace >= 32 ? 3 : extraSpace >= 16 ? 2 : 1);
    };
    const observer = new ResizeObserver(checkSpace);
    if (headerRef.current) observer.observe(headerRef.current);
    setTimeout(checkSpace, 100);
    return () => observer.disconnect();
  }, [uiScale, novels, currentNovelId]);

  const isPerfMode = typeof window !== 'undefined' && localStorage.getItem('mobile_perf_mode') === 'true';
  const zoomStyle = { zoom: uiScale / 100, minHeight: `${10000 / uiScale}vh` };

  // ========== 渲染 ==========
  return (
    <div style={zoomStyle} className={`flex flex-col w-full bg-[var(--app-bg)] overflow-hidden ${isPerfMode ? 'perf-mode' : ''}`}
      onTouchStart={handlePinchStart} onTouchMove={handlePinchMove} onTouchEnd={handlePinchEnd}>
      {/* [新增] 性能模式下禁用所有 framer-motion 动画 */}
      <MotionConfig reducedMotion={isPerfMode ? 'always' : 'never'}>
        <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} data={data} numStyle={chapterNumStyle} onSelect={(id, isLeaf, path) => { handleSelectNode(id, isLeaf, path); setIsSearchOpen(false); }} />

        {!isZenMode && (
          <div ref={headerRef} className="flex-shrink-0 h-14 bg-[var(--panel-bg)] border-b border-[var(--border)] flex items-center justify-between px-3 shadow-sm z-50">
            <div ref={leftContainerRef} className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden mr-2">
              <NovelSelector novels={novels} currentId={currentNovelId} onSwitch={setCurrentNovelId} onCreate={createEmptyNovel} onDelete={deleteNovel} />
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={() => setIsSearchOpen(true)} className="p-2 rounded-full hover:bg-[var(--hover-bg)] text-[var(--text-sub)]"><Search size={18} /></button>
              <StatusIndicators dbSyncStatus={dbSyncStatus} wsStatus={wsStatus} webdavSyncStatus={webdavStatus} showWebdav={!!(webdavConfig?.enabled && webdavConfig?.url)} visibleLights={visibleLights} size="mobile" />
              <button onClick={toggleDayNight} className="p-2 rounded-full hover:bg-[var(--hover-bg)] text-[var(--text-sub)]">
                {(THEMES[currentThemeId]?.type ?? 'light') === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>




            </div>
          </div>
        )}

        <div className="flex-1 overflow-hidden relative bg-[var(--app-bg)]">
          {mobileTab === 'editor' && (
            <div className="h-full w-full flex flex-col">
              {!isZenMode && (
                <div className="h-10 border-b border-[var(--border)] bg-[var(--panel-bg)] flex items-center justify-between px-4 text-xs flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="flex bg-[var(--hover-bg)] p-0.5 rounded">
                      <button onClick={() => setViewMode('list')} className={`px-3 py-1 rounded ${viewMode === 'list' ? 'bg-[var(--panel-bg)] shadow text-[var(--accent)] font-bold' : 'text-[var(--text-sub)]'}`}>列表</button>
                      <button onClick={() => {
                        setViewMode('mindmap');
                        // [新增] 切换到思维导图时，只展开第一卷
                        if (data && data.length > 0) {
                          const { collapseAllNodes, setNodeExpanded } = useUIStore.getState();
                          collapseAllNodes();
                          setNodeExpanded(data[0].id, true);
                        }
                      }} className={`px-3 py-1 rounded ${viewMode === 'mindmap' ? 'bg-[var(--panel-bg)] shadow text-[var(--accent)] font-bold' : 'text-[var(--text-sub)]'}`}>脑图</button>
                    </div>
                    {permissions.ai_outline && <button onClick={() => setIsOutlineAiOpen(true)} className="text-yellow-600 font-bold flex items-center gap-1"><Sparkles size={12} />AI灵感</button>}
                    {permissions.ai_toxic && <button onClick={() => handleOpenToxicCheck(activeNodeId)} className="text-red-500 font-bold flex items-center gap-1"><ShieldAlert size={12} />毒点</button>}
                    {permissions.ai_chat && <button onClick={() => useModalStore.getState().setIsChatAiOpen(true)} className="text-purple-500 font-bold flex items-center gap-1"><MessageCircle size={12} />对话</button>}
                  </div>
                </div>
              )}

              <div className={`absolute z-50 ${isZenMode ? 'top-6 right-5' : 'top-0 right-4'}`}>
                <button onClick={() => !isMarkingMode && setIsZenMode(!isZenMode)} onContextMenu={(e) => e.preventDefault()} onTouchStart={handleLongPressStart} onTouchEnd={handleLongPressEnd} onTouchCancel={handleLongPressEnd} onMouseDown={handleLongPressStart} onMouseUp={handleLongPressEnd} onMouseLeave={handleLongPressEnd}
                  className={`p-2 rounded-full shadow-sm backdrop-blur-sm border ${isMarkingMode ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'bg-[var(--panel-bg)]/80 text-[var(--text-sub)] border-[var(--border)]'}`}>
                  {isZenMode ? <Shrink size={20} /> : <Expand size={20} />}
                </button>
                {isMarkingMode && <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse border-2 border-white" />}
              </div>

              <div className="flex-1 relative overflow-y-auto overflow-x-hidden" style={{ backgroundColor: currentWorkspaceColor }}
                onClick={(e) => {
                  if (viewMode !== 'list' || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
                  const isBackground = e.target === e.currentTarget || e.target.closest('.mx-auto');
                  if (!isBackground) return;
                  if (!window._bgClickState) window._bgClickState = { count: 0, lastTime: 0, lastX: 0, lastY: 0 };
                  const state = window._bgClickState;
                  const now = Date.now();
                  if (now - state.lastTime < 400 && Math.abs(e.clientX - state.lastX) < 30 && Math.abs(e.clientY - state.lastY) < 30) state.count++;
                  else state.count = 1;
                  state.lastTime = now; state.lastX = e.clientX; state.lastY = e.clientY;
                  const req = collapseTrigger === 'double' ? 2 : collapseTrigger === 'triple' ? 3 : 1;
                  if (state.count >= req) { handleGlobalBackgroundClick(); state.count = 0; }
                }}>
                {viewMode === 'list' ? (
                  <OutlinePanel data={data} handleUpdate={handleUpdateNode} handleDelete={handleDeleteNode} handleAddChild={handleAddChildNode} handleAddSibling={handleAddSiblingNode} handleSelectNode={handleSelectNode} activeNodeId={activeNodeId} chapterNumStyle={chapterNumStyle} nodeIndexMap={nodeIndexMap} handleAddRoot={handleAddRoot} editorMaxWidth={editorMaxWidth} onOpenChapterAi={handleOpenChapterAi} onOpenToxicCheck={handleOpenToxicCheck} permissions={permissions} isMobile={true} collapseTrigger={collapseTrigger} singleExpand={singleExpand} onInputChange={handleTooltipInput} onInputBlur={handleTooltipBlur} isMarkingMode={isMarkingMode} onMarkingEntityClick={handleMarkingEntityClick} onCloseMarkingTooltip={() => setMarkingModeEntity(null)} onMoveUp={handleMoveNodeUp} onInsertAfter={handleInsertAfter} />
                ) : (
                  <MindMapPanel data={data} handleGlobalBackgroundClick={handleGlobalBackgroundClick} mindMapWheelBehavior={mindMapWheelBehavior} handleUpdate={handleUpdateNode} handleSelectNode={handleSelectNode} nodeIndexMap={nodeIndexMap} chapterNumStyle={chapterNumStyle} collapseTrigger={collapseTrigger} />
                )}
              </div>

              {(mobileSmartTooltip || isMarkingMode) && <MobileSmartTooltip inputText={tooltipInputText} cursorPosition={tooltipCursorPos} enabled={mobileSmartTooltip || isMarkingMode} smartContextData={smartContextData} isMarkingMode={isMarkingMode} markingModeEntity={markingModeEntity} onCloseMarkingTooltip={() => setMarkingModeEntity(null)} uiScale={uiScale} />}
            </div>
          )}

          {mobileTab === 'database' && (
            <div className="h-full w-full flex flex-col bg-[var(--panel-bg)]">
              <div className="flex border-b border-[var(--border)] bg-[var(--panel-bg)] overflow-x-auto hide-scrollbar flex-shrink-0">
                {[['smart', Sparkles, '智能'], ['chars', Users, '角色'], ['scenes', Map, '场景'], ['world', BookOpen, '设定']].map(([key, Icon, label]) => (
                  <button key={key} onClick={() => setRightPanelTab(key)} className={`flex-1 min-w-[60px] py-3 text-xs font-bold border-b-2 flex flex-col justify-center items-center gap-1 ${rightPanelTab === key ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-bg)]' : 'border-transparent text-[var(--text-sub)]'}`}>
                    <Icon size={16} /> <span>{label}</span>
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-hidden flex flex-col">
                <RightPanel activeTab={rightPanelTab} activeNodeId={activeNodeId} smartContextData={smartContextData} novelId={currentNovelId} isMobile={true} collapseTrigger={collapseTrigger} uiScale={uiScale} operationLog={novel.operationLog} />
              </div>
            </div>
          )}

          {mobileTab === 'settings' && (
            <div className="h-full w-full flex flex-col bg-[var(--panel-bg)]">
              <SettingsPanel novels={novels} setNovels={setNovels} currentNovelId={currentNovelId} handleExportJSON={novel.handleExportJSON} handleImportJSON={novel.handleImportJSON} permissions={permissions} getStorageKey={getStorageKey} isMobile={true} addToast={addToast} openOperationLog={openOperationLog} />
            </div>
          )}
        </div>

        {!isZenMode && (
          <div className="flex-shrink-0 h-16 bg-[var(--panel-bg)] border-t border-[var(--border)] flex justify-around items-center pb-2 z-30 safe-area-pb">
            <button onClick={() => { setTooltipInputText(''); setMobileTab('editor'); }} className={`flex flex-col items-center justify-center w-full h-full gap-1 ${mobileTab === 'editor' ? 'text-[var(--accent)] font-bold' : 'text-[var(--text-sub)]'}`}>
              {viewMode === 'list' ? <AlignLeft size={20} /> : <Network size={20} />}<span className="text-[10px]">创作</span>
            </button>
            <button onClick={() => { setTooltipInputText(''); setMobileTab('database'); }} className={`flex flex-col items-center justify-center w-full h-full gap-1 ${mobileTab === 'database' ? 'text-[var(--accent)] font-bold' : 'text-[var(--text-sub)]'}`}>
              <Database size={20} /><span className="text-[10px]">资料库</span>
            </button>
            <button onClick={() => { setTooltipInputText(''); setMobileTab('settings'); }} className={`flex flex-col items-center justify-center w-full h-full gap-1 ${mobileTab === 'settings' ? 'text-[var(--accent)] font-bold' : 'text-[var(--text-sub)]'}`}>
              <Settings size={20} /><span className="text-[10px]">设置</span>
            </button>
          </div>
        )}
      </MotionConfig>
    </div>
  );
}
