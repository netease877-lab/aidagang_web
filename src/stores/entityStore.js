/**
 * Entity Store - 实体数据状态管理
 * [激进重构] 完整的 CRUD 操作，不再依赖 NovelContext
 * 
 * 包含：角色(characters)、场景(scenes)、设定(worldSettings) 及其分类
 * 所有操作都在 Store 内完成，通过 subscribe 与外部同步
 */
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { arrayMove } from '@dnd-kit/sortable';
import { useSettingsStore } from './settingsStore'; // [新增] 引入设置 Store 以获取用户模板

// 生成唯一ID
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const useEntityStore = create(
    subscribeWithSelector((set, get) => ({
        // ==================== 大纲/章节数据 (Core) ====================
        data: [],
        chapterTemplates: [],
        isLoading: true, // [新增] 全局加载状态 (替代 NovelContext)

        setData: (data) => set({ data }),
        setChapterTemplates: (tpl) => set({ chapterTemplates: tpl }),
        setLoading: (loading) => set({ isLoading: loading }), // [新增]

        // ==================== 角色相关 ====================
        characters: [],
        charCats: [],
        charFields: [],
        defaultCharColor: '#22c55e',

        setCharacters: (chars) => set({ characters: chars }),
        setCharCats: (cats) => set({ charCats: cats }),
        setCharFields: (fields) => set({ charFields: fields }),
        setDefaultCharColor: (color) => set({ defaultCharColor: color }),

        // 角色操作
        addCharacter: (catId) => {
            const { charFields, characters, defaultCharColor } = get();
            const extra_fields = {};
            charFields.forEach(f => extra_fields[f.label] = '');
            set({
                characters: [...characters, {
                    id: generateId(),
                    categoryId: catId,
                    name: '新角色',
                    extra_fields,
                    color: defaultCharColor,
                    version: 1,
                    sortOrder: characters.length
                }]
            });
        },

        updateCharacter: (id, field, value, isCustom = false) => {
            set(state => ({
                characters: state.characters.map(c => {
                    if (c.id !== id) return c;
                    const base = isCustom
                        ? { ...c, extra_fields: { ...c.extra_fields, [field]: value } }
                        : { ...c, [field]: value };
                    return { ...base }; // [修复] 移除前端自增版本号
                })
            }));
        },

        deleteCharacter: (id) => {
            set(state => ({ characters: state.characters.filter(c => c.id !== id) }));
        },

        moveCharacter: (charId, targetCatId) => {
            set(state => ({
                characters: state.characters.map(c =>
                    c.id === charId ? { ...c, categoryId: targetCatId } : c // [修复] 移除前端自增版本号
                )
            }));
        },

        // ==================== 场景相关 ====================
        scenes: [],
        sceneCats: [],
        defaultSceneColor: '#0ea5e9',

        setScenes: (scenes) => set({ scenes }),
        setSceneCats: (cats) => set({ sceneCats: cats }),
        setDefaultSceneColor: (color) => set({ defaultSceneColor: color }),

        // 场景操作
        addScene: (catId) => {
            const { scenes, defaultSceneColor } = get();
            set({
                scenes: [...scenes, {
                    id: generateId(),
                    categoryId: catId,
                    name: '新场景',
                    desc: '',
                    color: defaultSceneColor,
                    version: 1,
                    sortOrder: scenes.length
                }]
            });
        },

        updateScene: (id, field, value) => {
            set(state => ({
                scenes: state.scenes.map(s =>
                    s.id === id ? { ...s, [field]: value } : s // [修复] 移除前端自增版本号
                )
            }));
        },

        deleteScene: (id) => {
            set(state => ({ scenes: state.scenes.filter(s => s.id !== id) }));
        },

        moveScene: (sceneId, targetCatId) => {
            set(state => ({
                scenes: state.scenes.map(s =>
                    s.id === sceneId ? { ...s, categoryId: targetCatId } : s // [修复] 移除前端自增版本号
                )
            }));
        },

        // ==================== 设定相关 ====================
        worldSettings: [],
        settingCats: [],
        defaultSettingColor: '#a855f7',

        setWorldSettings: (settings) => set({ worldSettings: settings }),
        setSettingCats: (cats) => set({ settingCats: cats }),
        setDefaultSettingColor: (color) => set({ defaultSettingColor: color }),

        // 设定操作
        addSetting: (catId) => {
            const { worldSettings, defaultSettingColor } = get();
            set({
                worldSettings: [...worldSettings, {
                    id: generateId(),
                    categoryId: catId,
                    name: '新设定',
                    desc: '',
                    color: defaultSettingColor,
                    version: 1,
                    sortOrder: worldSettings.length
                }]
            });
        },

        updateSetting: (id, field, value) => {
            set(state => ({
                worldSettings: state.worldSettings.map(s =>
                    s.id === id ? { ...s, [field]: value } : s // [修复] 移除前端自增版本号
                )
            }));
        },

        deleteSetting: (id) => {
            set(state => ({ worldSettings: state.worldSettings.filter(s => s.id !== id) }));
        },

        moveSetting: (settingId, targetCatId) => {
            set(state => ({
                worldSettings: state.worldSettings.map(s =>
                    s.id === settingId ? { ...s, categoryId: targetCatId } : s // [修复] 移除前端自增版本号
                )
            }));
        },

        // ==================== 分类操作（通用）====================
        addCat: (type, name, defaultColor) => {
            const catsKey = `${type}Cats`;
            set(state => {
                const cats = state[catsKey] || [];
                if (cats.some(c => c.name === name)) {
                    return state;
                }
                return {
                    [catsKey]: [...cats, {
                        id: generateId(),
                        name,
                        isExpanded: true,
                        color: defaultColor,
                        version: 1,
                        sortOrder: cats.length
                    }]
                };
            });
        },

        toggleCat: (type, id) => {
            const catsKey = `${type}Cats`;
            set(state => ({
                [catsKey]: state[catsKey].map(c =>
                    c.id === id ? { ...c, isExpanded: !c.isExpanded } : c
                )
            }));
        },

        // [修复] 强制折叠所有分类（而非切换）
        collapseAllCats: (type) => {
            const catsKey = `${type}Cats`;
            set(state => ({
                [catsKey]: state[catsKey].map(c => ({ ...c, isExpanded: false }))
            }));
        },

        updateCat: (type, id, updates) => {
            const catsKey = `${type}Cats`;
            set(state => ({
                [catsKey]: state[catsKey].map(c =>
                    c.id === id ? { ...c, ...updates } : c // [修复] 移除前端自增版本号
                )
            }));
        },

        deleteCat: (type, catId) => {
            const catsKey = `${type}Cats`;
            const itemsKey = type === 'char' ? 'characters' : type === 'scene' ? 'scenes' : 'worldSettings';
            set(state => ({
                [catsKey]: state[catsKey].filter(c => c.id !== catId),
                [itemsKey]: state[itemsKey].filter(i => i.categoryId !== catId)
            }));
        },

        // ==================== 排序操作 ====================
        reorderCats: (type, activeId, overId) => {
            const catsKey = `${type}Cats`;
            set(state => {
                const cats = state[catsKey];
                const oldIndex = cats.findIndex(c => c.id === activeId);
                const newIndex = cats.findIndex(c => c.id === overId);
                if (oldIndex === -1 || newIndex === -1) return state;

                const newCats = arrayMove(cats, oldIndex, newIndex);
                return {
                    [catsKey]: newCats.map((cat, index) => {
                        // [修复] 移除旧的 snake_case 字段，确保 Diff 纯粹
                        const { sort_order, ...rest } = cat;
                        return {
                            ...rest,
                            sortOrder: index
                        };
                    })
                };
            });
        },

        reorderItems: (type, activeId, overId) => {
            const itemsKey = type === 'char' ? 'characters' : type === 'scene' ? 'scenes' : 'worldSettings';
            set(state => {
                const items = state[itemsKey];
                const oldIndex = items.findIndex(item => item.id === activeId);
                const newIndex = items.findIndex(item => item.id === overId);
                if (oldIndex === -1 || newIndex === -1) return state;
                if (items[oldIndex].categoryId !== items[newIndex].categoryId) return state;

                const newItems = arrayMove(items, oldIndex, newIndex);
                return {
                    [itemsKey]: newItems.map((item, index) => {
                        // [修复] 移除旧的 snake_case 字段，确保 Diff 纯粹
                        const { sort_order, ...rest } = item;
                        return {
                            ...rest,
                            sortOrder: index
                        };
                    })
                };
            });
        },

        moveItemUpDown: (type, id, direction) => {
            const itemsKey = type === 'char' ? 'characters' : type === 'scene' ? 'scenes' : 'worldSettings';
            set(state => {
                const items = state[itemsKey];
                const idx = items.findIndex(item => item.id === id);
                if (idx === -1) return state;

                const targetItem = items[idx];
                const sameCategory = items.filter(i => i.categoryId === targetItem.categoryId);
                const posInCat = sameCategory.findIndex(i => i.id === id);

                if (direction === 'up' && posInCat === 0) return state;
                if (direction === 'down' && posInCat === sameCategory.length - 1) return state;

                const swapIdx = direction === 'up' ? posInCat - 1 : posInCat + 1;
                const swapItemId = sameCategory[swapIdx].id;
                const swapGlobalIdx = items.findIndex(i => i.id === swapItemId);

                const newItems = arrayMove(items, idx, swapGlobalIdx);
                return {
                    [itemsKey]: newItems.map((item, index) => ({
                        ...item,
                        sortOrder: index // [修复] 移除前端自增版本号
                    }))
                };
            });
        },

        // ==================== 关系相关 ====================
        relations: [],
        relationTypes: [],

        setRelations: (rels) => set({ relations: rels }),
        setRelationTypes: (types) => set({ relationTypes: types }),

        addRelation: (sourceId, targetId, type, label) => {
            set(state => ({
                relations: [...state.relations, {
                    id: generateId(),
                    source_id: sourceId,
                    target_id: targetId,
                    relation_type: type,
                    relation_label: label
                }]
            }));
        },

        updateRelation: (id, updates) => {
            set(state => ({
                relations: state.relations.map(r => r.id === id ? { ...r, ...updates } : r)
            }));
        },

        deleteRelation: (id) => {
            set(state => ({ relations: state.relations.filter(r => r.id !== id) }));
        },

        // ==================== 关系图设置 ====================
        isGraphEnabled: true,
        isGraphRotationEnabled: true,
        graphRotationSpeed: 0.002,

        setIsGraphEnabled: (val) => set({ isGraphEnabled: val }),
        setIsGraphRotationEnabled: (val) => set({ isGraphRotationEnabled: val }),
        setGraphRotationSpeed: (speed) => set({ graphRotationSpeed: speed }),

        // ==================== 批量同步方法 ====================
        syncFromNovel: (novelData) => {
            const state = get(); // [修复] 获取当前状态以保留 UI 状态

            // [新增] 获取用户定义的模板，强制覆盖服务器返回的模板
            const userTemplates = useSettingsStore.getState().chapterTemplates;
            const finalTemplates = (userTemplates && userTemplates.length > 0)
                ? userTemplates
                : (novelData.chapterTemplates || []);

            // [修复] 角色字段也优先使用设置中的配置
            const userCharFields = useSettingsStore.getState().charFields;
            const finalCharFields = (userCharFields && userCharFields.length > 0)
                ? userCharFields
                : (novelData.charFields || []);

            set({
                data: novelData.data || [],
                chapterTemplates: finalTemplates,
                characters: (novelData.characters || []).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
                // [修复] 保留分类的 isExpanded 状态（UI 状态不应被服务器数据覆盖）
                charCats: (novelData.charCats || []).map(cat => ({
                    ...cat,
                    isExpanded: state.charCats.find(c => c.id === cat.id)?.isExpanded ?? cat.isExpanded
                })).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
                scenes: (novelData.scenes || []).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
                sceneCats: (novelData.sceneCats || []).map(cat => ({
                    ...cat,
                    isExpanded: state.sceneCats.find(c => c.id === cat.id)?.isExpanded ?? cat.isExpanded
                })).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
                worldSettings: (novelData.worldSettings || []).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
                settingCats: (novelData.settingCats || []).map(cat => ({
                    ...cat,
                    isExpanded: state.settingCats.find(c => c.id === cat.id)?.isExpanded ?? cat.isExpanded
                })).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
                relations: novelData.relations || [],
                charFields: finalCharFields,
            });
        },

        // [新增] 重置所有数据 - 用于登出时清空缓存
        reset: () => {
            set({
                data: [],
                chapterTemplates: [],
                characters: [],
                charCats: [],
                scenes: [],
                sceneCats: [],
                worldSettings: [],
                settingCats: [],
                relations: [],
                charFields: [],
            });
        },

        syncFromConfig: (config) => {
            if (config) {
                // [修复] 颜色配置优先使用 settingsStore 里的值
                const settings = useSettingsStore.getState();
                set({
                    defaultCharColor: settings.defaultCharColor || config.defCharColor || '#22c55e',
                    defaultSceneColor: settings.defaultSceneColor || config.defSceneColor || '#0ea5e9',
                    defaultSettingColor: settings.defaultSettingColor || config.defSetColor || '#a855f7',
                    relationTypes: config.relationTypes || [],
                    charFields: config.charFields || [],
                    isGraphEnabled: config.graphEnabled !== false,
                    isGraphRotationEnabled: config.graphRotation !== false,
                    graphRotationSpeed: config.graphSpeed || 0.002,
                });
            }
        },

        // 获取完整状态快照（用于同步回 NovelContext）
        getSnapshot: () => {
            const state = get();
            return {
                data: state.data,
                chapterTemplates: state.chapterTemplates,
                characters: state.characters,
                charCats: state.charCats,
                scenes: state.scenes,
                sceneCats: state.sceneCats,
                worldSettings: state.worldSettings,
                settingCats: state.settingCats,
                relations: state.relations,
            };
        },
    }))
);
