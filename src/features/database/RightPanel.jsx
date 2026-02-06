import React, { useRef } from 'react';
import {
  Sparkles, Users, BookOpen, Settings, Map, Edit3
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ZenSmartWidget, HighlightText } from './components/ZenSmartWidget';
import CategoryList, { SortableExpandableCard } from './components/CategoryList';
import RelationEditor from './components/RelationEditor';
import CharacterSceneGraph from '../smart/CharacterSceneGraph';
import { DEFAULT_CHAR_FIELDS } from '../../constants';

import { useEntityStore } from '../../stores/entityStore';
import { useUIStore, useSettingsStore } from '../../stores'; // [修复] 引入 settingsStore

/**
 * RightPanel - 右侧面板组件
 * [激进重构] 完全从 entityStore 读取数据和操作方法
 * Props 精简到最少必要项
 */
export default function RightPanel({
  // === 必须的 Props（无法从 Store 获取）===
  activeTab,
  activeNodeId,
  smartContextData,
  novelId,
  isMobile = false,
  collapseTrigger = 'click',
  uiScale = 100,

  // === 关系变更回调（需要同步到服务器）===
  onRelationsChange,

  // === [新增] 操作日志 ===
  operationLog,
}) {
  // === 视觉设置 (从 settingsStore 获取) ===
  const {
    graphRotationSpeed,
    isGraphRotationEnabled,
    isGraphEnabled,
  } = useSettingsStore();

  // [新增] 性能模式检测
  const isPerfMode = typeof window !== 'undefined' && localStorage.getItem('mobile_perf_mode') === 'true';
  const animDuration = isPerfMode ? 0 : 0.2; // 性能模式时动画时长为0

  // === 完全从 Store 读取 ===
  const {
    isLoading, // [Fix] 从 Store 获取 Loading 状态，避免 Context 依赖
    // 数据
    characters,
    charCats,
    charFields,
    defaultCharColor,
    scenes,
    sceneCats,
    defaultSceneColor,
    worldSettings,
    settingCats,
    defaultSettingColor,
    relations,
    relationTypes,
    // [Fix] 移除这些从 entityStore 获取的视觉设置，改用 settingsStore
    // graphRotationSpeed,
    // isGraphRotationEnabled,
    // isGraphEnabled,

    // 操作方法
    addCharacter: storeAddCharacter,
    updateCharacter: storeUpdateCharacter,
    deleteCharacter: storeDeleteCharacter,
    moveCharacter,
    addScene: storeAddScene,
    updateScene: storeUpdateScene,
    deleteScene: storeDeleteScene,
    moveScene: moveSceneStore,
    addSetting: storeAddSetting,
    updateSetting: storeUpdateSetting,
    deleteSetting: storeDeleteSetting,
    moveSetting,
    addCat: storeAddCat,
    toggleCat,
    collapseAllCats,
    updateCat: storeUpdateCat,
    deleteCat: storeDeleteCat,
    reorderCats,
    reorderItems,
    moveItemUpDown,
    setRelationTypes,
  } = useEntityStore();

  // === [新增] 带日志记录的包装函数 ===
  // 角色
  const addCharacter = (catId) => {
    storeAddCharacter(catId);
    operationLog?.logCreate?.('character', '新角色');
  };
  const updateCharacter = (id, field, value, isCustom = false) => {
    const char = characters.find(c => c.id === id);
    const oldName = char?.name || '未命名';
    storeUpdateCharacter(id, field, value, isCustom);
    if (field === 'name' && value !== oldName) {
      operationLog?.logRename?.('character', oldName, value);
    }
  };
  const deleteCharacter = (id) => {
    const char = characters.find(c => c.id === id);
    storeDeleteCharacter(id);
    operationLog?.logDelete?.('character', char?.name || '未命名');
  };

  // 场景
  const addScene = (catId) => {
    storeAddScene(catId);
    operationLog?.logCreate?.('scene', '新场景');
  };
  const updateScene = (id, field, value) => {
    const scene = scenes.find(s => s.id === id);
    const oldName = scene?.name || '未命名';
    storeUpdateScene(id, field, value);
    if (field === 'name' && value !== oldName) {
      operationLog?.logRename?.('scene', oldName, value);
    }
  };
  const deleteScene = (id) => {
    const scene = scenes.find(s => s.id === id);
    storeDeleteScene(id);
    operationLog?.logDelete?.('scene', scene?.name || '未命名');
  };

  // 设定
  const addSetting = (catId) => {
    storeAddSetting(catId);
    operationLog?.logCreate?.('setting', '新设定');
  };
  const updateSetting = (id, field, value) => {
    const setting = worldSettings.find(s => s.id === id);
    const oldName = setting?.name || '未命名';
    storeUpdateSetting(id, field, value);
    if (field === 'name' && value !== oldName) {
      operationLog?.logRename?.('setting', oldName, value);
    }
  };
  const deleteSetting = (id) => {
    const setting = worldSettings.find(s => s.id === id);
    storeDeleteSetting(id);
    operationLog?.logDelete?.('setting', setting?.name || '未命名');
  };

  // 分类
  const addCat = (type, name, color) => {
    storeAddCat(type, name, color);
    const typeLabel = type === 'char' ? '角色分类' : type === 'scene' ? '场景分类' : '设定分类';
    operationLog?.logCreate?.('category', `${typeLabel}: ${name}`);
  };
  const updateCat = (type, id, updates) => {
    const cats = type === 'char' ? charCats : type === 'scene' ? sceneCats : settingCats;
    const cat = cats.find(c => c.id === id);
    const oldName = cat?.name || '未命名';
    storeUpdateCat(type, id, updates);
    if (updates.name && updates.name !== oldName) {
      const typeLabel = type === 'char' ? '角色分类' : type === 'scene' ? '场景分类' : '设定分类';
      operationLog?.logRename?.('category', `${typeLabel}: ${oldName}`, `${typeLabel}: ${updates.name}`);
    }
  };
  const deleteCat = (type, catId) => {
    const cats = type === 'char' ? charCats : type === 'scene' ? sceneCats : settingCats;
    const cat = cats.find(c => c.id === catId);
    storeDeleteCat(type, catId);
    const typeLabel = type === 'char' ? '角色分类' : type === 'scene' ? '场景分类' : '设定分类';
    operationLog?.logDelete?.('category', `${typeLabel}: ${cat?.name || '未命名'}`);
  };



  // [修复] 背景点击计数器，用于支持双击/三击折叠模式
  const bgClickCountRef = useRef(0);
  const bgClickTimerRef = useRef(null);

  // === 包装 Store 方法以匹配组件期望的签名 ===
  const handleAddCat = (type) => (name) => addCat(type, name,
    type === 'char' ? defaultCharColor : type === 'scene' ? defaultSceneColor : defaultSettingColor
  );
  const handleToggleCat = (type) => (id) => toggleCat(type, id);
  const handleUpdateCat = (type) => (id, updates) => updateCat(type, id, updates);
  const handleDeleteCat = (type) => (catId) => deleteCat(type, catId);

  const handleReorderCats = (type) => (activeId, overId) => reorderCats(type, activeId, overId);
  const handleReorderItems = (type) => (activeId, overId) => reorderItems(type, activeId, overId);
  const handleMoveUp = (type) => (id) => moveItemUpDown(type, id, 'up');
  const handleMoveDown = (type) => (id) => moveItemUpDown(type, id, 'down');


  // === Render ===
  if (isLoading) {
    return (
      <div className="h-full w-full p-4 space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200/20 dark:bg-gray-700/30 rounded w-1/3 mb-6"></div>
        {[1, 2, 3].map(i => (
          <div key={i} className="space-y-2">
            <div className="h-6 bg-gray-200/20 dark:bg-gray-700/30 rounded w-1/4"></div>
            <div className="h-24 bg-gray-200/20 dark:bg-gray-700/30 rounded-lg w-full"></div>
          </div>
        ))}
      </div>
    );
  }

  // [修复] 点击背景折叠所有分类
  const handleBackgroundClick = (e) => {
    // 确保点击的是背景而不是分类/项目
    if (e.target !== e.currentTarget) return;

    const requiredClicks = collapseTrigger === 'click' ? 1 : collapseTrigger === 'double' ? 2 : 3;

    bgClickCountRef.current += 1;
    if (bgClickTimerRef.current) clearTimeout(bgClickTimerRef.current);

    if (bgClickCountRef.current >= requiredClicks) {
      // 达到所需点击次数，强制折叠所有分类
      if (activeTab === 'chars') {
        collapseAllCats('char');
      } else if (activeTab === 'scenes') {
        collapseAllCats('scene');
      } else if (activeTab === 'world') {
        collapseAllCats('setting');
      }
      bgClickCountRef.current = 0;
    } else {
      bgClickTimerRef.current = setTimeout(() => {
        bgClickCountRef.current = 0;
      }, 400);
    }
  };

  return (
    <>
      {/* [修复] 添加 onClick={handleBackgroundClick} 支持点击背景折叠所有分类 */}
      <div className={`flex flex-col h-full bg-[var(--app-bg)] relative ${isMobile ? 'w-full' : ''}`} style={{ width: isMobile ? '100%' : '360px' }}>
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar" onClick={handleBackgroundClick}>
          <AnimatePresence mode="wait">
            {activeTab === 'smart' && (
              <motion.div
                key="smart"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: animDuration }}
                className="space-y-6"
              >
                {!activeNodeId ? (
                  <div className="text-center text-[var(--text-sub)] py-20"><Sparkles size={32} className="mx-auto mb-2 opacity-50" />请选择左侧章节<br /><span className="text-[10px] opacity-70">自动匹配相关角色与设定</span></div>
                ) : (
                  <>
                    <div className="bg-[var(--accent-bg)] p-2 rounded border border-[var(--accent)] text-[var(--accent)] text-xs font-bold mb-2">当前: {smartContextData.nodeTitle}</div>

                    {charCats.map(cat => {
                      const matchedChars = smartContextData.chars.filter(c => c.categoryId === cat.id);
                      if (matchedChars.length === 0) return null;
                      return (
                        <div key={cat.id} className="mb-4">
                          <h5 className="font-bold text-[var(--text-sub)] text-xs mb-2 flex items-center gap-1" style={{ color: cat.color || defaultCharColor }}><div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color || defaultCharColor }}></div>{cat.name}</h5>
                          {matchedChars.map(c => (<div key={c.id} className="p-3 rounded border-l-2 shadow-sm mb-2 transition-colors bg-[var(--panel-bg)] opacity-90" style={{ borderLeftColor: cat.color || defaultCharColor }}><div className="font-bold text-sm flex items-center text-[var(--text-main)]"><Users size={12} className="mr-1 opacity-70" /><HighlightText text={c.name} keyword={c.name} /></div>{(charFields || []).filter(f => f.showInCard !== false).map(field => { const val = c.extra_fields?.[field.label]; if (!val) return null; return (<div key={field.label} className="text-xs text-[var(--text-sub)] mt-1 flex flex-wrap gap-x-1 items-baseline"><span className="font-medium flex-shrink-0 whitespace-nowrap">{field.label}:</span><span className="opacity-90 break-all">{val}</span></div>); })}</div>))}
                        </div>
                      );
                    })}
                    {settingCats.map(cat => {
                      const matchedSettings = smartContextData.settings.filter(s => s.categoryId === cat.id);
                      if (matchedSettings.length === 0) return null;
                      return (
                        <div key={cat.id} className="mb-4">
                          <h5 className="font-bold text-[var(--text-sub)] text-xs mb-2 flex items-center gap-1" style={{ color: cat.color || defaultSettingColor }}><div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color || defaultSettingColor }}></div>{cat.name}</h5>
                          {matchedSettings.map(s => (<div key={s.id} className="p-3 rounded border-l-2 shadow-sm mb-2 transition-colors bg-[var(--panel-bg)]" style={{ borderLeftColor: cat.color || defaultSettingColor }}><div className="font-bold text-sm flex items-center text-[var(--text-main)]"><BookOpen size={12} className="mr-1 opacity-70" /><HighlightText text={s.name} keyword={s.name} /></div><div className="text-xs text-[var(--text-sub)] mt-1 line-clamp-3">{s.desc}</div></div>))}
                        </div>
                      );
                    })}
                    {sceneCats.map(cat => {
                      const matchedScenes = smartContextData.scenes.filter(s => s.categoryId === cat.id);
                      if (matchedScenes.length === 0) return null;
                      const color = cat.color || defaultSceneColor;
                      return (
                        <div key={cat.id} className="mb-4">
                          <h5 className="font-bold text-[var(--text-sub)] text-xs mb-2 flex items-center gap-1" style={{ color }}><div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}></div>{cat.name}</h5>
                          {matchedScenes.map(s => (<div key={s.id} className="p-3 rounded border-l-2 shadow-sm mb-2 transition-colors bg-[var(--panel-bg)]" style={{ borderLeftColor: color }}><div className="font-bold text-sm flex items-center text-[var(--text-main)]"><Map size={12} className="mr-1 opacity-70" /><HighlightText text={s.name} keyword={s.name} /></div><div className="text-xs text-[var(--text-sub)] mt-1 line-clamp-3">{s.desc}</div></div>))}
                        </div>
                      );
                    })}

                    {/* [修复] 手机端角色关系文字展示 - 放在所有卡片最下面，颜色与电脑端一致 */}
                    {isMobile && relations && relations.length > 0 && (() => {
                      const content = smartContextData.content || '';
                      const activeChars = characters.filter(c => content.includes(c.name));
                      const activeCharIds = activeChars.map(c => c.id);
                      const activeRelations = relations.filter(r =>
                        activeCharIds.includes(r.source_id) && activeCharIds.includes(r.target_id)
                      );
                      if (activeRelations.length === 0) return null;

                      // 获取角色颜色的辅助函数
                      const getCharColor = (char) => {
                        if (char.color) return char.color;
                        if (charCats && char.categoryId) {
                          const cat = charCats.find(c => c.id === char.categoryId);
                          if (cat && cat.color) return cat.color;
                        }
                        return defaultCharColor || '#6B7280';
                      };

                      // 关系类型颜色映射（与 relationConfig.js 一致）
                      const RELATION_COLORS = {
                        family: '#F59E0B', love: '#EC4899', friend: '#10B981',
                        hostile: '#6366F1', mentor: '#F97316', util: '#6B7280', custom: '#9CA3AF'
                      };
                      const getRelColor = (type) => RELATION_COLORS[type] || RELATION_COLORS.custom;

                      return (
                        <div className="mt-4 p-3 rounded-lg bg-[var(--panel-bg)] border border-[var(--border)]">
                          <h5 className="font-bold text-xs text-[var(--text-sub)] mb-2 flex items-center gap-1">
                            <Users size={12} />角色关系
                          </h5>
                          <div className="space-y-1.5">
                            {activeRelations.map((rel, idx) => {
                              const sourceChar = characters.find(c => c.id === rel.source_id);
                              const targetChar = characters.find(c => c.id === rel.target_id);
                              if (!sourceChar || !targetChar) return null;
                              const relationText = rel.relation_label || rel.relation_type || '关系';
                              const relColor = getRelColor(rel.relation_type);
                              return (
                                <div key={idx} className="text-xs flex items-center gap-1 flex-wrap">
                                  <span className="font-bold text-sm text-[var(--text-main)]"><HighlightText text={sourceChar.name} keyword={sourceChar.name} /></span>
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white" style={{ backgroundColor: relColor }}>{relationText}</span>
                                  <span className="font-bold text-sm text-[var(--text-main)]"><HighlightText text={targetChar.name} keyword={targetChar.name} /></span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
              </motion.div>
            )}

            {activeTab === 'chars' && (
              <motion.div
                key="chars"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: animDuration }}
              >
                <CategoryList
                  title="角色库" icon={Users} categories={charCats} items={characters} defaultColor={defaultCharColor} isMobile={isMobile}
                  collapseTrigger={collapseTrigger}
                  uiScale={uiScale}
                  onCollapseAll={() => collapseAllCats('char')}
                  onAddCat={handleAddCat('char')}
                  onToggleCat={handleToggleCat('char')}
                  onDeleteCat={handleDeleteCat('char')}
                  onUpdateCat={handleUpdateCat('char')}
                  onAddItem={(catId) => addCharacter(catId)}
                  onMoveItem={moveCharacter}
                  onReorderCat={handleReorderCats('char')}
                  onReorderItem={handleReorderItems('char')}
                  onMoveItemUp={handleMoveUp('char')}
                  onMoveItemDown={handleMoveDown('char')}
                  renderItem={(char, isMobile, index, allItems, catColor) => (
                    <SortableExpandableCard
                      key={char.id} id={char.id} categoryId={char.categoryId} title={char.name} isMobile={isMobile}
                      onRename={(newName) => updateCharacter(char.id, 'name', newName)}
                      onDelete={() => deleteCharacter(char.id)}
                      onMoveUp={() => handleMoveUp('char')(char.id)}
                      onMoveDown={() => handleMoveDown('char')(char.id)}
                      isFirst={index === 0}
                      isLast={index === allItems.length - 1}
                      borderColor={catColor}
                    >
                      <div className="space-y-3">
                        {((charFields?.length > 0) ? charFields : DEFAULT_CHAR_FIELDS).map(field => {

                          return (
                            <div key={field.label}><label className="text-[10px] text-[var(--text-sub)] font-bold block mb-1">{field.label}</label><textarea className="w-full text-xs bg-[var(--app-bg)] text-[var(--text-main)] border border-[var(--border)] rounded p-2 focus:bg-[var(--panel-bg)] outline-none resize-none" rows={2} value={char.extra_fields?.[field.label] || ''} onChange={(e) => updateCharacter(char.id, field.label, e.target.value, true)} onFocus={() => useUIStore.getState().setIsEditing(true)} onBlur={() => useUIStore.getState().setIsEditing(false)} placeholder={field.placeholder || "..."} /></div>
                          );
                        })}
                        {/* [新增] 角色关系编辑器 */}
                        <RelationEditor
                          characterId={char.id}
                          characterName={char.name}
                          novelId={novelId} // [修复] 使用传入的 novelId
                          characters={characters}
                          relations={relations}
                          onRelationsChange={onRelationsChange}
                          charCats={charCats}
                          defaultColor={defaultCharColor}
                          relationTypes={relationTypes}
                          setRelationTypes={setRelationTypes}
                          uiScale={uiScale} // [修复] 传递 uiScale 以修正坐标计算
                        />
                      </div>
                    </SortableExpandableCard>
                  )}
                />
              </motion.div>
            )}

            {activeTab === 'scenes' && (
              <motion.div
                key="scenes"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: animDuration }}
              >
                <CategoryList
                  title="场景管理" icon={Map} categories={sceneCats} items={scenes} defaultColor={defaultSceneColor} isMobile={isMobile}
                  collapseTrigger={collapseTrigger}
                  uiScale={uiScale}
                  onCollapseAll={() => collapseAllCats('scene')}
                  onAddCat={handleAddCat('scene')}
                  onToggleCat={handleToggleCat('scene')}
                  onDeleteCat={handleDeleteCat('scene')}
                  onUpdateCat={handleUpdateCat('scene')}
                  onAddItem={(catId) => addScene(catId)}
                  onMoveItem={(id, catId) => updateScene(id, 'categoryId', catId)}
                  onReorderCat={handleReorderCats('scene')}
                  onReorderItem={handleReorderItems('scene')}
                  onMoveItemUp={handleMoveUp('scene')}
                  onMoveItemDown={handleMoveDown('scene')}
                  renderItem={(scene, isMobile, index, allItems, catColor) => (
                    <SortableExpandableCard
                      key={scene.id} id={scene.id} categoryId={scene.categoryId} title={scene.name} isMobile={isMobile}
                      onRename={(newName) => updateScene(scene.id, 'name', newName)}
                      onDelete={() => deleteScene(scene.id)}
                      onMoveUp={() => handleMoveUp('scene')(scene.id)}
                      onMoveDown={() => handleMoveDown('scene')(scene.id)}
                      isFirst={index === 0}
                      isLast={index === allItems.length - 1}
                      borderColor={catColor}
                    >
                      <textarea className="w-full text-sm bg-[var(--app-bg)] text-[var(--text-main)] border border-[var(--border)] rounded p-2 focus:bg-[var(--panel-bg)] outline-none resize-y min-h-[100px]" value={scene.desc} onChange={(e) => updateScene(scene.id, 'desc', e.target.value)} onFocus={() => useUIStore.getState().setIsEditing(true)} onBlur={() => useUIStore.getState().setIsEditing(false)} placeholder="场景描述..." />
                    </SortableExpandableCard>
                  )}
                />
              </motion.div>
            )}

            {activeTab === 'world' && (
              <motion.div
                key="world"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: animDuration }}
              >
                <CategoryList
                  title="设定集" icon={BookOpen} categories={settingCats} items={worldSettings} defaultColor={defaultSettingColor} isMobile={isMobile}
                  collapseTrigger={collapseTrigger}
                  uiScale={uiScale}
                  onCollapseAll={() => collapseAllCats('setting')}
                  onAddCat={handleAddCat('setting')}
                  onToggleCat={handleToggleCat('setting')}
                  onDeleteCat={handleDeleteCat('setting')}
                  onUpdateCat={handleUpdateCat('setting')}
                  onAddItem={(catId) => addSetting(catId)}
                  onMoveItem={(id, catId) => updateSetting(id, 'categoryId', catId)}
                  onReorderCat={handleReorderCats('setting')}
                  onReorderItem={handleReorderItems('setting')}
                  onMoveItemUp={handleMoveUp('setting')}
                  onMoveItemDown={handleMoveDown('setting')}
                  renderItem={(setting, isMobile, index, allItems, catColor) => (
                    <SortableExpandableCard
                      key={setting.id} id={setting.id} categoryId={setting.categoryId} title={setting.name} isMobile={isMobile}
                      onRename={(newName) => updateSetting(setting.id, 'name', newName)}
                      onDelete={() => deleteSetting(setting.id)}
                      onMoveUp={() => handleMoveUp('setting')(setting.id)}
                      onMoveDown={() => handleMoveDown('setting')(setting.id)}
                      isFirst={index === 0}
                      isLast={index === allItems.length - 1}
                      borderColor={catColor}
                    >
                      <textarea className="w-full text-sm bg-[var(--app-bg)] text-[var(--text-main)] border border-[var(--border)] rounded p-2 focus:bg-[var(--panel-bg)] outline-none resize-y min-h-[100px]" value={setting.desc} onChange={(e) => updateSetting(setting.id, 'desc', e.target.value)} onFocus={() => useUIStore.getState().setIsEditing(true)} onBlur={() => useUIStore.getState().setIsEditing(false)} placeholder="设定内容..." />
                    </SortableExpandableCard>
                  )}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* [修复] 角色关系图 - 仅桌面端显示，手机端使用上方文字展示 */}
        {isGraphEnabled && !isMobile && activeTab === 'smart' && activeNodeId && (() => {
          const content = smartContextData.content || '';
          const activeChars = characters.filter(c => content.includes(c.name));
          const activeCharIds = activeChars.map(c => c.id);
          const hasRelations = relations && relations.some(r =>
            activeCharIds.includes(r.source_id) && activeCharIds.includes(r.target_id)
          );
          if (activeChars.length >= 2 && hasRelations) {
            return (
              <div
                className="absolute bottom-0 left-0 right-0 h-[400px] z-20 pointer-events-auto"
                style={{ background: 'transparent' }}
              >
                <CharacterSceneGraph
                  content={content}
                  rotationSpeed={graphRotationSpeed}
                  isRotationEnabled={isGraphRotationEnabled}
                  height="100%"
                  width="100%"
                />
              </div>
            );
          }
          return null;
        })()}
      </div>
    </>
  );
}

// 重新导出子组件供外部使用
export { ZenSmartWidget };
