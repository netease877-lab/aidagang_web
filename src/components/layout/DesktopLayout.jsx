// ==================================================
// File: frontend/src/components/layout/DesktopLayout.jsx
// [激进重构] 完全删除 EditorContext 依赖，直接从 Stores/Contexts/User 获取
// ==================================================
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Network, AlignLeft, Download, Expand, Shrink, BookOpen,
  Sparkles, Users, Settings, Sun, Moon, Lightbulb, Map, User, LogOut, ShieldAlert,
  Search, MessageCircle
} from 'lucide-react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';

// 组件导入
import OutlinePanel from '../../features/editor/OutlinePanel';
import SearchModal from '../common/SearchModal';
import StatusIndicators from '../common/StatusIndicators';
import MindMapPanel from '../../features/editor/MindMapPanel';
import RightPanel, { ZenSmartWidget } from '../../features/database/RightPanel';
import SettingsPanel from '../../features/settings/SettingsPanel';
import CharacterSceneGraph from '../../features/smart/CharacterSceneGraph';
import ChangePasswordModal from '../ChangePasswordModal';

// 常量
import { THEMES, DEFAULT_CHAR_FIELDS, DEFAULT_CHAPTER_TEMPLATES } from '../../constants';

// [激进重构] 直接导入 Stores 和 Contexts
// [新增] 引入新的 wsStore
import { useUIStore, useEditorStore, useModalStore, useEntityStore, useSettingsStore, useWsStore } from '../../stores';
import { useNovel, useUser, useToast } from '../../contexts';
import { SyncStatusWidget, NovelSelector } from '../AppWidgets';

// 全屏动画统一配置 (使用 framer-motion 确保同步)
const zenTransition = { duration: 0.35, ease: [0.4, 0, 0.2, 1] }; // Material Design 标准缓动

export default function DesktopLayout() {
  // ========== 从 Zustand Stores 获取状态 ==========
  const viewMode = useUIStore(state => state.viewMode);
  const setViewMode = useUIStore(state => state.setViewMode);
  const rightPanelTab = useUIStore(state => state.rightPanelTab);
  const setRightPanelTab = useUIStore(state => state.setRightPanelTab);
  const isZenMode = useUIStore(state => state.isZenMode);
  const setIsZenMode = useUIStore(state => state.setIsZenMode);
  const isTopBarHovered = useUIStore(state => state.isTopBarHovered);
  const setIsTopBarHovered = useUIStore(state => state.setIsTopBarHovered);

  // [修复] 从 Store 获取真实的 WebSocket 状态
  const wsStatus = useWsStore(state => state.status);
  const webdavStatus = useWsStore(state => state.webdavStatus);

  const activeNodeId = useEditorStore(state => state.activeNodeId);
  const setActiveNodeId = useEditorStore(state => state.setActiveNodeId);
  const smartContextData = useEditorStore(state => state.smartContextData) || { chars: [], scenes: [], settings: [], content: '', nodeTitle: '' };
  const nodeIndexMap = useEditorStore(state => state.nodeIndexMap) || new Map();

  const setIsOutlineAiOpen = useModalStore(state => state.setIsOutlineAiOpen);
  const setOperationLogOpen = useModalStore(state => state.setOperationLogOpen);

  // Entity Store
  const characters = useEntityStore(state => state.characters);
  const scenes = useEntityStore(state => state.scenes);
  const worldSettings = useEntityStore(state => state.worldSettings);
  const relations = useEntityStore(state => state.relations);
  const data = useEntityStore(state => state.data); // [Refactor] Direct access to outline data
  // [新增] 标记模式需要的分类和配置
  const charCats = useEntityStore(state => state.charCats);
  const sceneCats = useEntityStore(state => state.sceneCats);
  const settingCats = useEntityStore(state => state.settingCats);
  const charFields = useEntityStore(state => state.charFields);
  const defaultCharColor = useEntityStore(state => state.defaultCharColor);
  const defaultSceneColor = useEntityStore(state => state.defaultSceneColor);
  const defaultSettingColor = useEntityStore(state => state.defaultSettingColor);

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
          console.warn('[DesktopLayout] UI 渲染用户为 User 超过 3 秒，跳转登录');
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
  const chapterNumberingMode = useSettingsStore(state => state.chapterNumberingMode);
  const editorMaxWidth = useSettingsStore(state => state.editorMaxWidth);
  const mindMapWheelBehavior = useSettingsStore(state => state.mindMapWheelBehavior);
  const zenAutoPopup = useSettingsStore(state => state.zenAutoPopup);
  const zenCardStyle = useSettingsStore(state => state.zenCardStyle);
  const uiScale = useSettingsStore(state => state.uiScale);
  const isSeamlessBg = useSettingsStore(state => state.isSeamlessBg);
  const workspaceBgColor = useSettingsStore(state => state.workspaceBgColor);
  const currentWorkspaceColor = isSeamlessBg ? 'transparent' : workspaceBgColor;
  const collapseTrigger = useSettingsStore(state => state.collapseTrigger);
  const singleExpand = useSettingsStore(state => state.singleExpand);
  const isGraphEnabled = useSettingsStore(state => state.isGraphEnabled);
  const isGraphRotationEnabled = useSettingsStore(state => state.isGraphRotationEnabled);
  const graphRotationSpeed = useSettingsStore(state => state.graphRotationSpeed);
  const isGraphShowInZen = useSettingsStore(state => state.isGraphShowInZen);
  const webdavConfig = useSettingsStore(state => state.webdavConfig); // [优化] 用于判断 WebDAV 是否已启用

  // ========== 本地状态 ==========
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const prevMatchCountRef = useRef(0);

  // [新增] 专注模式标记功能（彩蛋）
  const [isZenMarkingMode, setIsZenMarkingMode] = useState(false);
  const [selectedMarkingEntity, setSelectedMarkingEntity] = useState(null); // { type: 'character'|'scene'|'setting', data: {...} }
  const zenBtnLongPressRef = useRef(null);

  // ========== 方法 ==========
  const setCurrentThemeId = useSettingsStore(state => state.setCurrentThemeId);
  const toggleDayNight = useCallback(() => {
    // [修复] 切换日/夜模式：纯本地逻辑，不与服务器同步
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
    // 注意：此处不再调用 user.updateConfig
  }, [currentThemeId, setCurrentThemeId]);

  const handleAdminJump = useCallback(() => {
    // [修改] 使用相对路径跳转，适配同域部署或反向代理
    window.open('/ztadmin', '_blank');
  }, []);

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
    if (isLeaf) {
      setRightPanelTab('smart');
    }
  }, [setActiveNodeId, setRightPanelTab]);

  const handleOpenChapterAi = useCallback((chapterId) => {
    useEditorStore.getState().setActiveChapterIdForAi(chapterId);
    useModalStore.getState().setIsChapterAiOpen(true);
  }, []);

  const handleOpenToxicCheck = useCallback((nodeId) => {
    useEditorStore.getState().setActiveNodeIdForToxic(nodeId);
    useModalStore.getState().setIsToxicCheckOpen(true);
  }, []);

  const handleGlobalBackgroundClick = useCallback((e) => {
    // 直接调用 handleToggleAccordion() 折叠所有节点
    // 点击次数检测已在 onClick 中完成
    if (handleToggleAccordion) handleToggleAccordion();
  }, [handleToggleAccordion]);

  const handleDesktopInputChange = useCallback((text) => {
    const hasCharMatch = characters.some(c => c.name && text.includes(c.name));
    const hasSceneMatch = scenes.some(s => s.name && text.includes(s.name));
    const hasSettingMatch = worldSettings.some(s => s.name && text.includes(s.name));
    const currentCount = (hasCharMatch ? 1 : 0) + (hasSceneMatch ? 1 : 0) + (hasSettingMatch ? 1 : 0);

    if (currentCount > prevMatchCountRef.current && currentCount > 0) {
      setRightPanelTab('smart');
    }
    prevMatchCountRef.current = currentCount;
  }, [characters, scenes, worldSettings, setRightPanelTab]);

  const handleExportText = useCallback(() => {
    // [修复] 根据当前视图模式选择导出格式
    if (viewMode === 'mindmap') {
      // 思维导图模式：导出思维导图格式
      if (novel.handleExportMindmap) {
        novel.handleExportMindmap();
      } else if (novel.handleExportText) {
        novel.handleExportText(); // 回退
      }
    } else {
      // 大纲列表模式：导出文本格式
      if (novel.handleExportText) {
        novel.handleExportText();
      }
    }
  }, [novel, viewMode]);

  const openOperationLog = useCallback(() => {
    setOperationLogOpen(true);
  }, [setOperationLogOpen]);

  // 快捷键
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      // [新增] ESC 键退出标记模式
      if (e.key === 'Escape' && isZenMarkingMode) {
        setIsZenMarkingMode(false);
        setSelectedMarkingEntity(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isZenMarkingMode]);

  // [新增] 标记模式：点击高亮实体的回调
  const handleMarkingEntityClick = useCallback((entityName, entityType, rect) => {
    let entityData = null;
    let color = null;
    if (entityType === 'character') {
      entityData = characters.find(c => c.name === entityName);
      const cat = charCats.find(cat => cat.id === entityData?.category_id);
      color = cat?.color || defaultCharColor;
    } else if (entityType === 'scene') {
      entityData = scenes.find(s => s.name === entityName);
      const cat = sceneCats.find(cat => cat.id === entityData?.category_id);
      color = cat?.color || defaultSceneColor;
    } else if (entityType === 'setting') {
      entityData = worldSettings.find(s => s.name === entityName);
      const cat = settingCats.find(cat => cat.id === entityData?.category_id);
      color = cat?.color || defaultSettingColor;
    }
    if (entityData) {
      setSelectedMarkingEntity({ type: entityType, data: entityData, color });
    }
  }, [characters, scenes, worldSettings, charCats, sceneCats, settingCats, defaultCharColor, defaultSceneColor, defaultSettingColor]);

  // ========== 渲染 ==========
  return (
    <>
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        data={data}
        numStyle={chapterNumStyle}
        onSelect={(id, isLeaf, path) => {
          handleSelectNode(id, isLeaf, path);
          setIsSearchOpen(false);
        }}
      />

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
        createdAt={currentUser?.created_at}
        addToast={addToast}
      />

      <div style={{ zoom: uiScale / 100 }} className="flex flex-col h-full w-full">
        {/* --- 顶部导航栏 --- */}
        {/* [正确方案] 始终使用 relative 定位，通过 height 和 marginTop 动画控制显示/隐藏 */}
        <motion.div
          initial={false}
          animate={{
            height: isZenMode && !isTopBarHovered ? 0 : 56,
            opacity: isZenMode && !isTopBarHovered ? 0 : 1
          }}
          transition={zenTransition}
          className={`relative flex justify-between items-center shadow-sm w-full bg-[var(--panel-bg)] border-b border-[var(--border)] z-50
          ${isZenMode && !isTopBarHovered ? 'pointer-events-none' : ''}`}
          onMouseEnter={() => isZenMode && setIsTopBarHovered(true)}
          onMouseLeave={() => isZenMode && setIsTopBarHovered(false)}
        >
          {isZenMode && (
            <div className="absolute -bottom-4 left-0 w-full h-4 z-50 bg-transparent" onMouseEnter={() => setIsTopBarHovered(true)}></div>
          )}

          {/* 左侧 */}
          <div className="flex items-center gap-4 px-4">
            <NovelSelector
              novels={novels}
              currentId={currentNovelId}
              onSwitch={setCurrentNovelId}
              onCreate={createEmptyNovel}
              onDelete={deleteNovel}
            />
          </div>

          {/* 右侧 */}
          <div className="flex items-center gap-3 px-4">
            <button onClick={() => setIsSearchOpen(true)} className="p-2 rounded-full text-[var(--text-sub)] hover:text-[var(--accent)] hover:bg-[var(--hover-bg)]" title="全局搜索 (Ctrl+F)">
              <Search size={20} />
            </button>

            {permissions.ai_chat && (
              <button onClick={() => useModalStore.getState().setIsChatAiOpen(true)} className="p-2 rounded-full text-[var(--text-sub)] hover:text-purple-500 hover:bg-[var(--hover-bg)]" title="AI 对话">
                <MessageCircle size={20} />
              </button>
            )}

            {permissions.ai_toxic && (
              <button onClick={() => handleOpenToxicCheck(activeNodeId)} className="p-2 rounded-full text-[var(--text-sub)] hover:text-red-500 hover:bg-[var(--hover-bg)]" title="AI 毒点检查">
                <ShieldAlert size={20} />
              </button>
            )}

            {permissions.ai_outline && (
              <button onClick={() => setIsOutlineAiOpen(true)} className="p-2 rounded-full text-[var(--text-sub)] hover:text-yellow-500 hover:bg-[var(--hover-bg)]" title="大纲灵感">
                <Lightbulb size={20} />
              </button>
            )}

            <StatusIndicators dbSyncStatus={dbSyncStatus} wsStatus={wsStatus} webdavSyncStatus={webdavStatus} showWebdav={!!(webdavConfig?.enabled && webdavConfig?.url)} size="desktop" />

            {/* 用户信息 - 点击用户名区域弹出修改密码 */}
            <div
              onClick={() => setIsChangePasswordOpen(true)}
              className="flex items-center gap-2 mr-2 bg-[var(--accent-bg)] px-3 py-1.5 rounded-full border border-[var(--accent)]/30 cursor-pointer hover:bg-[var(--accent)]/10 transition-colors"
              title="点击修改密码"
            >
              {permissions.admin && (
                <button onClick={(e) => { e.stopPropagation(); handleAdminJump(); }} className="mr-2 bg-red-500 hover:bg-red-600 text-white p-1 rounded-full" title="进入管理后台">
                  <ShieldAlert size={12} />
                </button>
              )}
              <div className="w-5 h-5 rounded-full bg-[var(--accent)] text-white flex items-center justify-center font-bold text-xs uppercase">
                {currentUser?.email ? currentUser.email.substring(0, 1) : <User size={12} />}
              </div>
              <span className="text-xs font-bold text-[var(--accent)] hidden sm:inline">
                {currentUser?.nickname || currentUser?.email || 'User'}
              </span>
              <button onClick={(e) => { e.stopPropagation(); localStorage.removeItem('novel_token'); window.location.reload(); }} className="text-[var(--text-sub)] hover:text-red-500 ml-2" title="退出登录">
                <LogOut size={14} />
              </button>
            </div>

            <button onClick={toggleDayNight} className="p-2 rounded text-[var(--text-sub)] hover:text-[var(--accent)] hover:bg-[var(--hover-bg)]" title="切换日间/夜间模式">
              {(THEMES[currentThemeId]?.type ?? 'light') === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <div className="flex bg-[var(--hover-bg)] p-0.5 rounded text-xs">
              <button onClick={() => setViewMode('list')} className={`px-2 py-1.5 rounded transition-all ${viewMode === 'list' ? 'bg-[var(--panel-bg)] shadow text-[var(--accent)] font-bold' : 'text-[var(--text-sub)]'}`}>
                <AlignLeft size={14} className="inline mr-1" />大纲列表
              </button>
              <button onClick={() => {
                setViewMode('mindmap');
                // [新增] 切换到思维导图时，只展开第一卷
                if (data && data.length > 0) {
                  const { collapseAllNodes, setNodeExpanded } = useUIStore.getState();
                  collapseAllNodes();
                  setNodeExpanded(data[0].id, true);
                }
              }} className={`px-2 py-1.5 rounded transition-all ${viewMode === 'mindmap' ? 'bg-[var(--panel-bg)] shadow text-[var(--accent)] font-bold' : 'text-[var(--text-sub)]'}`}>
                <Network size={14} className="inline mr-1" />思维导图
              </button>
            </div>

            <button onClick={handleExportText} className="text-[var(--text-sub)] hover:text-[var(--accent)] hover:bg-[var(--hover-bg)] p-2 rounded" title="导出为文本">
              <Download size={16} />
            </button>
          </div>
        </motion.div>

        {isZenMode && !isTopBarHovered && (
          <div className="fixed top-0 left-0 w-full h-2 z-[60] cursor-pointer" onMouseEnter={() => setIsTopBarHovered(true)}></div>
        )}

        {/* --- 主内容区域 --- */}
        <LayoutGroup>
          <div className="flex-1 flex overflow-hidden relative">
            <motion.div
              layout
              transition={zenTransition}
              className={`relative flex flex-col h-full min-w-0 flex-1 border-r border-[var(--border)]`}
            >
              <div className="absolute top-6 right-6 z-40">
                <button
                  onClick={() => {
                    // 长按已触发时不执行（计时器已清空表示长按完成）
                    if (zenBtnLongPressRef.current === 'triggered') {
                      zenBtnLongPressRef.current = null;
                      return;
                    }
                    // 清除可能存在的计时器
                    if (zenBtnLongPressRef.current) {
                      clearTimeout(zenBtnLongPressRef.current);
                      zenBtnLongPressRef.current = null;
                    }
                    // 执行正常的切换专注模式
                    setIsZenMode(!isZenMode);
                    if (isZenMode) {
                      // 退出专注模式时也退出标记模式
                      setIsZenMarkingMode(false);
                      setSelectedMarkingEntity(null);
                    }
                  }}
                  onMouseDown={() => {
                    // [彩蛋] 长按检测：仅在专注模式下生效
                    if (isZenMode) {
                      zenBtnLongPressRef.current = setTimeout(() => {
                        // 长按触发：切换标记模式
                        setIsZenMarkingMode(prev => {
                          if (prev) setSelectedMarkingEntity(null); // 退出时清空选中
                          return !prev;
                        });
                        zenBtnLongPressRef.current = 'triggered'; // 标记长按已触发
                      }, 500);
                    }
                  }}
                  onMouseUp={() => {
                    // 短按时清除计时器（onClick 会处理逻辑）
                    if (zenBtnLongPressRef.current && zenBtnLongPressRef.current !== 'triggered') {
                      clearTimeout(zenBtnLongPressRef.current);
                      zenBtnLongPressRef.current = null;
                    }
                  }}
                  onMouseLeave={() => {
                    if (zenBtnLongPressRef.current && zenBtnLongPressRef.current !== 'triggered') {
                      clearTimeout(zenBtnLongPressRef.current);
                      zenBtnLongPressRef.current = null;
                    }
                  }}
                  className={`bg-[var(--panel-bg)]/80 hover:bg-[var(--panel-bg)] p-2 rounded-full shadow-sm backdrop-blur-sm border border-[var(--border)] transition-all ${isZenMarkingMode ? 'text-[var(--accent)] ring-2 ring-[var(--accent)]' : 'text-[var(--text-sub)] hover:text-[var(--accent)]'
                    }`}
                  title={isZenMarkingMode ? "标记模式 (长按退出)" : isZenMode ? "退出专注模式 (长按进入标记模式)" : "进入专注模式"}
                >
                  {isZenMode ? <Shrink size={20} /> : <Expand size={20} />}
                </button>
              </div>

              {/* 专注模式：ZenSmartWidget - 标记模式时只显示选中的实体，否则显示所有匹配 */}
              {isZenMode && (
                <ZenSmartWidget
                  smartContextData={
                    isZenMarkingMode && selectedMarkingEntity
                      ? {
                        // 标记模式：只显示选中的实体
                        chars: selectedMarkingEntity.type === 'character' ? [{ ...selectedMarkingEntity.data, categoryId: selectedMarkingEntity.data.category_id }] : [],
                        scenes: selectedMarkingEntity.type === 'scene' ? [{ ...selectedMarkingEntity.data, categoryId: selectedMarkingEntity.data.category_id }] : [],
                        settings: selectedMarkingEntity.type === 'setting' ? [{ ...selectedMarkingEntity.data, categoryId: selectedMarkingEntity.data.category_id }] : [],
                        content: smartContextData?.content || '',
                        nodeTitle: smartContextData?.nodeTitle || '',
                        nodeId: smartContextData?.nodeId,
                        timestamp: Date.now()
                      }
                      : smartContextData
                  }
                  autoPopup={isZenMarkingMode ? true : zenAutoPopup}
                  cardStyleKey={zenCardStyle}
                  showAllFields={isZenMarkingMode} // [新增] 标记模式下显示所有字段
                />
              )}

              {isGraphEnabled && isGraphShowInZen && isZenMode && activeNodeId && (() => {
                const content = smartContextData?.content || '';
                const activeChars = characters.filter(c => content.includes(c.name));
                const activeCharIds = activeChars.map(c => c.id);
                const hasRelations = relations && relations.some(r => activeCharIds.includes(r.source_id) && activeCharIds.includes(r.target_id));
                if (activeChars.length >= 2 && hasRelations) {
                  return (
                    <AnimatePresence>
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.5 }}
                        className="absolute top-32 left-6 z-50 pointer-events-auto"
                        style={{ width: '320px', height: '400px', background: 'transparent' }}
                      >
                        <CharacterSceneGraph content={content} rotationSpeed={graphRotationSpeed} isRotationEnabled={isGraphRotationEnabled} zenMode={true} height="100%" width="100%" />
                      </motion.div>
                    </AnimatePresence>
                  );
                }
                return null;
              })()}

              <div
                className={`flex-1 relative transition-colors duration-300 hide-scrollbar ${viewMode === 'list' ? 'overflow-auto' : 'overflow-hidden'}`}
                style={{ backgroundColor: currentWorkspaceColor, overflowAnchor: 'none' }} // [修复] 禁用滚动锚定，防止展开时跳动
                onClick={(e) => {
                  if (viewMode !== 'list') return;
                  // [修复] 编辑模式下不触发强制折叠
                  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
                  const req = collapseTrigger === 'double' ? 2 : collapseTrigger === 'triple' ? 3 : 1;
                  if (e.detail === req) handleGlobalBackgroundClick(e);
                }}
              >
                {viewMode === 'list' ? (
                  <OutlinePanel
                    data={data}
                    handleUpdate={handleUpdateNode}
                    handleDelete={handleDeleteNode}
                    handleAddChild={handleAddChildNode}
                    handleAddSibling={handleAddSiblingNode}
                    handleSelectNode={handleSelectNode}
                    activeNodeId={activeNodeId}
                    chapterNumStyle={chapterNumStyle}
                    nodeIndexMap={nodeIndexMap}
                    handleAddRoot={handleAddRoot}
                    editorMaxWidth={editorMaxWidth}
                    onOpenChapterAi={handleOpenChapterAi}
                    onOpenToxicCheck={handleOpenToxicCheck}
                    permissions={permissions}
                    collapseTrigger={collapseTrigger}
                    singleExpand={singleExpand}
                    onInputChange={handleDesktopInputChange}
                    onMoveUp={handleMoveNodeUp}
                    onInsertAfter={handleInsertAfter}
                    isMarkingMode={isZenMode && isZenMarkingMode}
                    onMarkingEntityClick={handleMarkingEntityClick}
                    onCloseMarkingTooltip={() => setSelectedMarkingEntity(null)}
                  />
                ) : (
                  <MindMapPanel
                    data={data}
                    handleGlobalBackgroundClick={handleGlobalBackgroundClick}
                    mindMapWheelBehavior={mindMapWheelBehavior}
                    handleUpdate={handleUpdateNode}
                    handleSelectNode={handleSelectNode}
                    nodeIndexMap={nodeIndexMap}
                    chapterNumStyle={chapterNumStyle}
                    collapseTrigger={collapseTrigger}
                  />
                )}
              </div>
            </motion.div>

            {/* 右侧面板 */}
            <motion.div
              animate={{
                width: isZenMode ? 0 : 360,
                opacity: isZenMode ? 0 : 1,
                borderLeftWidth: isZenMode ? 0 : 1
              }}
              transition={zenTransition}
              className={`flex-shrink-0 flex flex-col h-full bg-[var(--panel-bg)] border-l border-[var(--border)] shadow-xl overflow-hidden`}
            >
              <div className="flex border-b border-[var(--border)] flex-shrink-0 bg-[var(--panel-bg)]" style={{ width: '360px' }}>
                {[
                  ['smart', Sparkles, '智能'],
                  ['chars', Users, '角色'],
                  ['scenes', Map, '场景'],
                  ['world', BookOpen, '设定'],
                  ['settings', Settings, '设置']
                ].map(([key, Icon, label]) => (
                  <button
                    key={key}
                    onClick={() => setRightPanelTab(key)}
                    className={`flex-1 py-3 text-xs font-bold border-b-2 transition-colors flex justify-center items-center gap-1 
                    ${rightPanelTab === key ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-bg)]' : 'border-transparent text-[var(--text-sub)] hover:text-[var(--text-main)]'}`}
                  >
                    <Icon size={14} /> {label}
                  </button>
                ))}
              </div>

              {rightPanelTab === 'settings' ? (
                <SettingsPanel
                  novels={novels}
                  setNovels={setNovels}
                  currentNovelId={currentNovelId}
                  handleExportJSON={novel.handleExportJSON}
                  handleImportJSON={novel.handleImportJSON}
                  permissions={permissions}
                  getStorageKey={getStorageKey}
                  openOperationLog={openOperationLog}
                  addToast={addToast}
                />
              ) : (
                <RightPanel
                  activeTab={rightPanelTab}
                  activeNodeId={activeNodeId}
                  smartContextData={smartContextData}
                  novelId={currentNovelId}
                  collapseTrigger={collapseTrigger}
                  uiScale={uiScale}
                  operationLog={novel.operationLog}
                />
              )}
            </motion.div>
          </div>
        </LayoutGroup>
      </div >
    </>
  );
}
