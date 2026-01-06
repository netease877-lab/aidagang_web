// ==================================================
// File: frontend/src/components/AiChapterModal.jsx (Refactored)
// ==================================================
import React, { useState, useEffect, useMemo } from 'react';
import {
    X, Sparkles, User, MapPin, ChevronDown, ChevronRight,
    RefreshCw, Loader2, Layers, History,
    Globe, Lightbulb, PenTool, Target,
    Sliders, Settings, Play, Flag
} from 'lucide-react';
import { DEFAULT_AI_CONFIG, DEFAULT_CHAPTER_AI_CONFIG, STORAGE_PREFIX, MOCK_CHARACTERS, MOCK_SCENES, DEFAULT_STYLES } from '../../constants';
import { useSettingsStore } from '../../stores';
import { cleanAiIdeasResponse } from '../../utils/aiResponseCleaner';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '../../services/api';

// 引入拆分后的子组件
import ResourceSelector from './components/ResourceSelector';
import ChapterResultModal from './components/ChapterResultModal';


const FALLBACK_STYLES = [
    { icon: '🎲', label: '随机' },
    { icon: '🔥', label: '冲突/打脸' },
    { icon: '🧩', label: '铺垫/解谜' },
    { icon: '💬', label: '日常/感情' },
    { icon: '⚔️', label: '战斗/副本' }
];

// --- 主组件 ---
// [核心]: 接收 getStorageKey, permissions, onFetchContext, onInsertContent
export default function AiChapterModal({
    isOpen,
    onClose,
    characters,
    scenes,
    charCats: propsCharCats,
    sceneCats: propsSceneCats,
    prevContext,
    onFetchPrev,
    getStorageKey,
    permissions,
    onFetchContext,
    onInsertContent,
    activeChapter // [新增] 父组件传递的当前章节信息
}) {
    // State
    // [新增] 上下文模式
    const [contextMode, setContextMode] = useState('prev_1');

    // [新增] 加载保存的配置（分书保存）
    const loadSavedConfig = () => {
        const key = getStorageKey('chapter_ai_form');
        const saved = localStorage.getItem(key);
        if (saved) {
            try {
                const config = JSON.parse(saved);
                setFormData(prev => ({
                    ...prev,
                    inspiration: config.inspiration || '',
                    goal: config.goal || '',
                    start: config.start || '',
                    outcome: config.outcome || '',
                    taboos: config.taboos || '',
                    volumeContext: config.volumeContext || '',
                    globalContext: config.globalContext || '',
                    isStartForced: config.isStartForced || false,
                    isOutcomeForced: config.isOutcomeForced || false,
                    style: config.style || '🎲 随机'
                }));
                if (config.selectedCharIds) setSelectedCharIds(new Set(config.selectedCharIds));
                if (config.selectedSceneIds) setSelectedSceneIds(new Set(config.selectedSceneIds));
            } catch (e) { console.warn('[ChapterAI] Load config failed:', e); }
        }
    };

    // [新增] 保存配置（点击生成时调用）
    const saveConfig = () => {
        const key = getStorageKey('chapter_ai_form');
        const config = {
            inspiration: formData.inspiration,
            goal: formData.goal,
            start: formData.start,
            outcome: formData.outcome,
            taboos: formData.taboos,
            volumeContext: formData.volumeContext,
            globalContext: formData.globalContext,
            isStartForced: formData.isStartForced,
            isOutcomeForced: formData.isOutcomeForced,
            style: formData.style,
            selectedCharIds: Array.from(selectedCharIds),
            selectedSceneIds: Array.from(selectedSceneIds)
        };
        localStorage.setItem(key, JSON.stringify(config));
    };

    // [新增] 自动清空字段状态（长按激活）
    const [autoClearFields, setAutoClearFields] = useState({});

    // [新增] 长按处理
    const longPressTimerRef = React.useRef(null);
    const handleClearBtnMouseDown = (fieldName) => {
        longPressTimerRef.current = setTimeout(() => {
            // 长按：切换自动清空状态
            setAutoClearFields(prev => {
                const newState = { ...prev, [fieldName]: !prev[fieldName] };
                localStorage.setItem(getStorageKey('chapter_ai_auto_clear'), JSON.stringify(newState));
                return newState;
            });
        }, 600); // 600ms 长按阈值
    };
    const handleClearBtnMouseUp = () => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    };

    // [新增] 监听打开，读取记忆并获取上下文
    useEffect(() => {
        if (isOpen) {
            const savedMode = localStorage.getItem(getStorageKey('ai_context_mode')) || 'prev_1';
            setContextMode(savedMode);

            // [新增] 加载自动清空配置
            const savedAutoClear = localStorage.getItem(getStorageKey('chapter_ai_auto_clear'));
            const autoClear = savedAutoClear ? JSON.parse(savedAutoClear) : {};
            setAutoClearFields(autoClear);

            // [新增] 加载分书保存的表单配置
            loadSavedConfig();

            // [新增] 应用自动清空：打开时清空已激活的字段
            setFormData(prev => ({
                ...prev,
                inspiration: autoClear.inspiration ? '' : prev.inspiration,
                goal: autoClear.goal ? '' : prev.goal,
                start: autoClear.start ? '' : prev.start,
                outcome: autoClear.outcome ? '' : prev.outcome,
                taboos: autoClear.taboos ? '' : prev.taboos,
                volumeContext: autoClear.volumeContext ? '' : prev.volumeContext,
                globalContext: autoClear.globalContext ? '' : prev.globalContext
            }));

            // [修复] 确保 onFetchContext 存在才调用
            if (onFetchContext) {
                const content = onFetchContext(savedMode);
                setFormData(prev => ({ ...prev, prevContent: content }));
            }
        }
    }, [isOpen, getStorageKey, onFetchContext]);

    // [新增] 切换模式
    const handleContextModeChange = (e) => {
        const newMode = e.target.value;
        setContextMode(newMode);
        localStorage.setItem(getStorageKey('ai_context_mode'), newMode);
        if (onFetchContext) {
            const content = onFetchContext(newMode);
            setFormData(prev => ({ ...prev, prevContent: content }));
        }
    };
    const [formData, setFormData] = useState({
        globalContext: '', volumeContext: '',
        prevContent: '',
        inspiration: '', goal: '', start: '', outcome: '', taboos: '',
        sceneCount: 4, ideaCount: '3', style: '🎲 随机',
        isStartForced: false,
        isOutcomeForced: false
    });
    const [selectedCharIds, setSelectedCharIds] = useState(new Set());
    const [selectedSceneIds, setSelectedSceneIds] = useState(new Set());

    // UI State
    const [modalType, setModalType] = useState(null);
    const [activeCharCat, setActiveCharCat] = useState(null);
    const [activeSceneCat, setActiveSceneCat] = useState(null);
    const [styleMenuOpen, setStyleMenuOpen] = useState(false);

    // Result State
    const [generatedIdeas, setGeneratedIdeas] = useState([]);
    const [rawContent, setRawContent] = useState('');
    const [isResultOpen, setIsResultOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    const [isGlobalExpanded, setIsGlobalExpanded] = useState(false);
    // [手机版] 折叠状态
    const [isMobileGoalsExpanded, setIsMobileGoalsExpanded] = useState(true);
    const [isMobileResourceExpanded, setIsMobileResourceExpanded] = useState(false);
    const [isMobileContextExpanded, setIsMobileContextExpanded] = useState(false);

    // Config State - [修复] 从 settingsStore 获取配置
    const storeAiConfig = useSettingsStore(state => state.aiConfig);
    const storeChapterAiConfig = useSettingsStore(state => state.chapterAiConfig);
    const storeAiStyles = useSettingsStore(state => state.aiStyles);
    const storeCharFields = useSettingsStore(state => state.charFields) || []; // [新增] 获取字段模板顺序
    const baseConfig = storeAiConfig || DEFAULT_AI_CONFIG;
    const chapterConfig = storeChapterAiConfig || DEFAULT_CHAPTER_AI_CONFIG;
    const availableStyles = (storeAiStyles && storeAiStyles.length > 0) ? storeAiStyles : (DEFAULT_STYLES || FALLBACK_STYLES);

    // Data Processing - 使用传入的分类数据，显示所有分类（包括空分类）
    const charCats = useMemo(() => {
        if (!propsCharCats || propsCharCats.length === 0) {
            // 回退到旧逻辑
            const sourceChars = (characters && characters.length > 0) ? characters : MOCK_CHARACTERS;
            const groups = {};
            sourceChars.forEach(c => { if (!groups[c.categoryId]) groups[c.categoryId] = []; groups[c.categoryId].push(c); });
            return Object.keys(groups).map(catId => ({ id: catId, name: '其他角色', items: groups[catId] }));
        }
        // 使用传入的分类，为每个分类分配对应的角色
        return propsCharCats.map(cat => ({
            id: cat.id,
            name: cat.name,
            items: (characters || []).filter(c => c.categoryId === cat.id)
        }));
    }, [characters, propsCharCats]);

    const sceneCats = useMemo(() => {
        if (!propsSceneCats || propsSceneCats.length === 0) {
            // 回退到旧逻辑
            const sourceScenes = (scenes && scenes.length > 0) ? scenes : MOCK_SCENES;
            const groups = {};
            sourceScenes.forEach(s => { if (!groups[s.categoryId]) groups[s.categoryId] = []; groups[s.categoryId].push(s); });
            return Object.keys(groups).map(catId => ({ id: catId, name: '其他场景', items: groups[catId] }));
        }
        // 使用传入的分类，为每个分类分配对应的场景
        return propsSceneCats.map(cat => ({
            id: cat.id,
            name: cat.name,
            items: (scenes || []).filter(s => s.categoryId === cat.id)
        }));
    }, [scenes, propsSceneCats]);

    // [修复] 移除从 localStorage 读取配置的逻辑，现在直接从 store 获取
    useEffect(() => {
        if (isOpen) {
            // 仅处理 prevContent 兜底逻辑
            if (!formData.prevContent && prevContext) {
                setFormData(prev => ({ ...prev, prevContent: prevContext }));
            }
        }
    }, [isOpen, prevContext, getStorageKey]);

    useEffect(() => {
        if (isOpen && prevContext !== undefined) {
            setFormData(prev => ({ ...prev, prevContent: prevContext || '' }));
        }
    }, [prevContext, isOpen]);

    const handleGenerate = async () => {
        if (!baseConfig.apiKey) { alert('请先配置 API Key'); return; }
        if (!formData.inspiration.trim()) { alert('请输入本章灵感'); return; }

        // [新增] 点击生成时保存配置
        saveConfig();

        setIsGenerating(true);
        setGeneratedIdeas([]);
        setRawContent('');

        let targetModel = chapterConfig.model;
        const availableModels = baseConfig.models || [];
        const isModelValid = availableModels.some(m => m.id === targetModel);
        if (!isModelValid && availableModels.length > 0) {
            targetModel = availableModels[0].id;
        }

        try {
            const allChars = (characters && characters.length > 0) ? characters : MOCK_CHARACTERS;
            const selectedCharsText = Array.from(selectedCharIds).map(id => {
                const c = allChars.find(i => i.id === id);
                if (!c) return '';
                // [统一格式] 与 ToxicCheck 保持一致：角色名: [字段1: 值1] [字段2: 值2]
                const parts = [];
                storeCharFields.forEach(f => {
                    const val = c.extra_fields?.[f.label];
                    if (val && String(val).trim()) {
                        parts.push(`[${f.label}: ${val}]`);
                    }
                });
                return parts.length > 0 ? `${c.name}: ${parts.join(' ')}` : c.name;
            }).filter(Boolean).join('\n');

            const allScenes = (scenes && scenes.length > 0) ? scenes : MOCK_SCENES;
            const selectedScenesText = Array.from(selectedSceneIds).map(id => {
                const s = allScenes.find(i => i.id === id);
                if (!s) return '';
                // [统一格式] 与 ToxicCheck 保持一致：场景名: [字段1: 值1] [字段2: 值2]
                const parts = [];
                if (s.desc && String(s.desc).trim()) {
                    parts.push(`[描述: ${s.desc}]`);
                }
                if (s.extra_fields) {
                    Object.entries(s.extra_fields).forEach(([k, v]) => {
                        if (v && String(v).trim()) {
                            parts.push(`[${k}: ${v}]`);
                        }
                    });
                }
                return parts.length > 0 ? `${s.name}: ${parts.join(' ')}` : s.name;
            }).filter(Boolean).join('\n');

            let prompt = chapterConfig.promptTemplate || DEFAULT_CHAPTER_AI_CONFIG.promptTemplate;

            prompt = prompt
                .replace(/{{global_context}}/g, formData.globalContext || '无')
                .replace(/{{volume_context}}/g, formData.volumeContext || '无')
                .replace(/{{prev_context}}/g, formData.prevContent || '无')
                .replace(/{{inspiration}}/g, formData.inspiration || '无')
                .replace(/{{goal}}/g, formData.goal || '无')
                .replace(/{{outcome}}/g, formData.outcome || '无')
                .replace(/{{start}}/g, formData.start || '无')
                .replace(/{{taboos}}/g, formData.taboos || '无')
                .replace(/{{style}}/g, formData.style || '无')
                .replace(/{{characters}}/g, selectedCharsText || '未指定')
                .replace(/{{scenes}}/g, selectedScenesText || '未指定')
                .replace(/{{count}}/g, formData.ideaCount)
                .replace(/{{scene_count}}/g, formData.sceneCount)
                .replace(/{{chapter_num}}/g, 'X');

            let instructions = [];
            instructions.push(`必须生成 ${formData.ideaCount} 个不同的方案。`);
            instructions.push(`每个方案的 'content' 字段中，请列出约 ${formData.sceneCount} 个细分场景步骤。`);

            if (formData.isStartForced && formData.start.trim()) {
                instructions.push(`【强制要求】细纲的第一个场景必须严格使用这句话作为开头："${formData.start.trim()}"`);
            }
            if (formData.isOutcomeForced && formData.outcome.trim()) {
                instructions.push(`【强制要求】细纲的最后一个场景必须严格以这个结局收尾："${formData.outcome.trim()}"`);
            }

            prompt += `\n\n【重要指令】\n` + instructions.join('\n');

            // [严格模式] 禁止 Markdown 格式
            prompt += `\n\n【严格模式】忽略所有聊天礼仪。只输出纯文本内容，禁止使用任何Markdown格式（如、#、-等）。不要对内容进行格式化包装，直接返回原始内容。`;

            // [修复] 获取 Token 并添加到请求头
            const token = localStorage.getItem('novel_token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const resData = await apiClient.post('/api/ai/generate', {
                apiKey: baseConfig.apiKey, baseUrl: baseConfig.baseUrl, model: targetModel, timeout: baseConfig.timeout || 60,
                messages: [{ role: "user", content: prompt }]
            });
            let finalData = null;
            let finalRaw = '';

            // [RESTful] 成功 (HTTP 200) 且数据为数组
            if (Array.isArray(resData.data)) {
                finalData = resData.data;
            } else if (resData.error) {
                throw new Error(resData.error);
            } else {
                // 后端解析失败 (HTTP 206) 或非标准格式，使用统一清洗函数
                const rawText = resData.data?.[0]?.content || JSON.stringify(resData);
                finalRaw = rawText;

                // 使用统一的 AI 响应清洗函数
                const cleaned = cleanAiIdeasResponse(rawText);
                if (cleaned.success && Array.isArray(cleaned.data)) {
                    finalData = cleaned.data;
                }
            }

            if (finalData) {
                setGeneratedIdeas(finalData);
                setIsResultOpen(true);
            } else {
                setRawContent(finalRaw);
                setIsResultOpen(true);
            }
        } catch (e) {
            // [优化] 对常见错误提供友好提示
            let errMsg = e.message || '未知错误';
            if (errMsg.includes('timeout') || errMsg.includes('Timeout') || errMsg.includes('deadline exceeded')) {
                errMsg = '⏱️ AI 请求超时，请检查：\n1. 网络连接是否正常\n2. AI 服务是否正在运行\n3. 设置中的超时时间是否足够';
            } else if (errMsg.includes('fetch') || errMsg.includes('network')) {
                errMsg = '🌐 网络连接失败，请检查网络或 AI 服务地址是否正确';
            }
            setRawContent(`错误: ${errMsg}`);
            setIsResultOpen(true);
        } finally {
            setIsGenerating(false);
        }
    };



    const getResourceBtnText = (set, itemsMap) => {
        if (set.size === 0) return '未选择';
        const names = [];
        set.forEach(id => {
            for (const cat of itemsMap) {
                const found = cat.items.find(i => i.id === id);
                if (found) { names.push(found.name || found.title); break; }
            }
        });
        return names.slice(0, 2).join(', ') + (names.length > 2 ? ` 等${names.length}项` : '');
    };

    return (
        <div className={`fixed inset-0 flex items-center justify-center font-sans text-[var(--text-main)] ${isOpen ? 'z-[1100]' : 'z-[-1]'}`}>
            <AnimatePresence>
                {isOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
                        />
                        {/* Input Modal */}
                        {/* [核心适配] 手机端 95dvh，电脑端 65dvh */}
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            transition={{ duration: 0.2 }}
                            className="w-[96%] max-w-[950px] h-[95dvh] lg:h-[65dvh] bg-[var(--panel-bg)] rounded-xl shadow-2xl flex flex-col overflow-hidden border border-[var(--border)] relative z-10 pointer-events-auto"
                        >
                            {/* Header */}
                            <div className="px-5 h-14 border-b border-[var(--border)] flex justify-between items-center bg-[var(--panel-bg)] shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="font-bold text-[var(--text-main)] text-lg flex items-center gap-2">
                                        <Lightbulb className="text-yellow-500 fill-yellow-500/20" size={20} /> 细纲灵感功能
                                    </div>
                                </div>
                                {/* [新增] 当前章节信息 - 居中显示 */}
                                {activeChapter && (
                                    <div className="text-sm font-medium text-[var(--text-sub)] truncate max-w-[40%]">
                                        第{activeChapter.index}章 {activeChapter.title}
                                    </div>
                                )}
                                <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-red-500/10 text-[var(--text-sub)] hover:text-red-500 flex items-center justify-center transition"><X size={20} /></button>
                            </div>

                            {/* Body (3-Column Compact Layout) - 手机端单列可滚动 */}
                            <div className="flex-1 grid grid-cols-1 lg:grid-cols-[240px_1fr_260px] overflow-y-auto lg:overflow-hidden bg-[var(--app-bg)]">

                                {/* Left Sidebar - 手机端放最后 */}
                                <div className="bg-[var(--panel-bg)] border-r border-[var(--border)] p-3 flex flex-col gap-3 lg:overflow-y-auto custom-scrollbar lg:h-full lg:order-1 order-3 border-t lg:border-t-0">

                                    {/* Context (上下文) */}
                                    <div className="flex-1 flex flex-col min-h-[160px]">
                                        {/* [UI 调整] 标题栏：只保留标题，移除下拉框 */}
                                        <div className="mb-2 flex justify-between items-center">
                                            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-sub)] flex items-center gap-1.5">
                                                <History size={12} className="text-[var(--accent)]" /> 上下文 (Context)
                                            </div>
                                            {/* 原来的下拉框移走了 */}
                                        </div>

                                        <div className="bg-[var(--app-bg)] border border-[var(--border)] rounded-lg p-3 flex-1 flex flex-col">
                                            {/* [UI 调整] 内容区顶部：改为 justify-between，左侧放下拉框，右侧放按钮 */}
                                            <div className="flex justify-between items-center mb-2 shrink-0">
                                                {/* 下拉框移到这里 */}
                                                <select
                                                    value={contextMode}
                                                    onChange={handleContextModeChange}
                                                    className="text-[10px] border border-[var(--border)] rounded px-1 py-0.5 bg-[var(--panel-bg)] text-[var(--text-main)] outline-none focus:border-[var(--accent)] cursor-pointer h-6 shadow-sm max-w-[120px]"
                                                >
                                                    <option value="prev_1">上一章 (可编辑)</option>
                                                    <option value="prev_10">上十章 (自动锁定)</option>
                                                </select>
                                                {/* 纯图标按钮 */}
                                                <button
                                                    type="button"
                                                    title="清空"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setFormData(prev => ({ ...prev, prevContent: '' }));
                                                    }}
                                                    className="w-6 h-6 flex items-center justify-center text-red-500 hover:text-red-600 cursor-pointer bg-[var(--panel-bg)] rounded border border-red-500/30 shadow-sm hover:bg-red-500/10 transition active:scale-95"
                                                >
                                                    <X size={12} />
                                                </button>
                                                <button
                                                    type="button"
                                                    title="获取上文"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        if (onFetchContext) {
                                                            const content = onFetchContext(contextMode);
                                                            setFormData(prev => ({ ...prev, prevContent: content }));
                                                        } else if (prevContext) {
                                                            setFormData(prev => ({ ...prev, prevContent: prevContext }));
                                                        }
                                                        if (onFetchPrev) onFetchPrev();
                                                    }}
                                                    className="w-6 h-6 flex items-center justify-center text-[var(--accent)] cursor-pointer bg-[var(--panel-bg)] rounded border border-[var(--accent)]/30 shadow-sm hover:bg-[var(--accent-bg)] transition active:scale-95"
                                                >
                                                    <RefreshCw size={12} />
                                                </button>
                                            </div>
                                            <textarea
                                                className={`flex-1 w-full border border-[var(--border)] rounded-md p-2 text-xs font-mono text-[var(--text-main)] resize-y outline-none transition min-h-[120px] custom-scrollbar
                                        ${contextMode === 'prev_10' ? 'bg-[var(--hover-bg)] cursor-not-allowed' : 'bg-[var(--panel-bg)] focus:border-[var(--accent)]'}`}
                                                placeholder="点击获取或手动输入..."
                                                value={formData.prevContent}
                                                onChange={e => setFormData({ ...formData, prevContent: e.target.value })}
                                                readOnly={contextMode === 'prev_10'} // 锁定
                                            />
                                        </div>
                                    </div>

                                    {/* Global Setting */}
                                    <div className="shrink-0">
                                        <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-sub)] mb-2 flex items-center gap-1.5 mt-2">
                                            <Globe size={12} className="text-blue-500" /> 世界观设定
                                        </div>
                                        <div className="border border-[var(--border)] rounded-lg bg-[var(--panel-bg)] overflow-hidden">
                                            <button onClick={() => setIsGlobalExpanded(!isGlobalExpanded)} className="w-full flex items-center justify-between p-2.5 bg-[var(--app-bg)] hover:bg-[var(--hover-bg)] transition text-xs font-semibold text-[var(--text-main)]">
                                                <span>展开全局设定</span>
                                                {isGlobalExpanded ? <ChevronDown size={12} className="text-[var(--text-sub)]" /> : <ChevronRight size={12} className="text-[var(--text-sub)]" />}
                                            </button>
                                            {isGlobalExpanded && (
                                                <div className="p-3 space-y-3 bg-[var(--panel-bg)] border-t border-[var(--border)] animate-in slide-in-from-top-1">
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between items-center">
                                                            <label className="text-[10px] font-bold text-[var(--text-sub)] uppercase">当前卷纲</label>
                                                            {(formData.volumeContext || autoClearFields.volumeContext) && <button
                                                                onClick={() => setFormData({ ...formData, volumeContext: '' })}
                                                                onMouseDown={() => handleClearBtnMouseDown('volumeContext')}
                                                                onMouseUp={handleClearBtnMouseUp}
                                                                onMouseLeave={handleClearBtnMouseUp}
                                                                onTouchStart={() => handleClearBtnMouseDown('volumeContext')}
                                                                onTouchEnd={handleClearBtnMouseUp}
                                                                onContextMenu={(e) => e.preventDefault()}
                                                                className={`w-4 h-4 rounded-full flex items-center justify-center transition ${autoClearFields.volumeContext ? 'bg-[var(--accent)] text-white' : 'bg-[var(--border)] hover:bg-red-400 text-[var(--text-sub)] hover:text-white'}`}
                                                                title={autoClearFields.volumeContext ? '长按取消自动清空' : '长按激活自动清空'}
                                                            ><X size={10} /></button>}
                                                        </div>
                                                        <textarea className="w-full h-20 p-2 text-xs bg-[var(--app-bg)] border border-[var(--border)] rounded focus:border-[var(--accent)] outline-none resize-y text-[var(--text-main)]"
                                                            placeholder="本卷目标..." value={formData.volumeContext} onChange={e => setFormData({ ...formData, volumeContext: e.target.value })} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between items-center">
                                                            <label className="text-[10px] font-bold text-[var(--text-sub)] uppercase">全书核心</label>
                                                            {(formData.globalContext || autoClearFields.globalContext) && <button
                                                                onClick={() => setFormData({ ...formData, globalContext: '' })}
                                                                onMouseDown={() => handleClearBtnMouseDown('globalContext')}
                                                                onMouseUp={handleClearBtnMouseUp}
                                                                onMouseLeave={handleClearBtnMouseUp}
                                                                onTouchStart={() => handleClearBtnMouseDown('globalContext')}
                                                                onTouchEnd={handleClearBtnMouseUp}
                                                                onContextMenu={(e) => e.preventDefault()}
                                                                className={`w-4 h-4 rounded-full flex items-center justify-center transition ${autoClearFields.globalContext ? 'bg-[var(--accent)] text-white' : 'bg-[var(--border)] hover:bg-red-400 text-[var(--text-sub)] hover:text-white'}`}
                                                                title={autoClearFields.globalContext ? '长按取消自动清空' : '长按激活自动清空'}
                                                            ><X size={10} /></button>}
                                                        </div>
                                                        <textarea className="w-full h-20 p-2 text-xs bg-[var(--app-bg)] border border-[var(--border)] rounded focus:border-[var(--accent)] outline-none resize-y text-[var(--text-main)]"
                                                            placeholder="全书主线..." value={formData.globalContext} onChange={e => setFormData({ ...formData, globalContext: e.target.value })} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Tip */}
                                    <div className="shrink-0 mt-auto bg-[var(--accent-bg)] p-3 rounded-lg border border-[var(--accent)]/30">
                                        <div className="flex items-start gap-2">
                                            <Lightbulb size={12} className="text-[var(--accent)] mt-0.5 shrink-0" />
                                            <p className="text-[10px] text-[var(--text-main)] leading-relaxed">
                                                在中间输入框中可以随意输入对话、动作片段，AI 会自动为您整理逻辑。
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Middle: Main Editor - Compact */}
                                <div className="p-4 flex flex-col gap-3 overflow-y-auto custom-scrollbar lg:order-2 order-1 min-h-[40vh]">
                                    <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-sub)] flex items-center justify-between">
                                        <span className="flex items-center gap-1.5"><PenTool size={12} className="text-purple-500" /> 本章灵感风暴</span>
                                        {(formData.inspiration || autoClearFields.inspiration) && <button
                                            onClick={() => setFormData({ ...formData, inspiration: '' })}
                                            onMouseDown={() => handleClearBtnMouseDown('inspiration')}
                                            onMouseUp={handleClearBtnMouseUp}
                                            onMouseLeave={handleClearBtnMouseUp}
                                            onTouchStart={() => handleClearBtnMouseDown('inspiration')}
                                            onTouchEnd={handleClearBtnMouseUp}
                                            onContextMenu={(e) => e.preventDefault()}
                                            className={`px-1.5 py-0.5 rounded text-[9px] flex items-center gap-0.5 transition ${autoClearFields.inspiration ? 'bg-[var(--accent)] text-white' : 'bg-[var(--border)] hover:bg-red-400 text-[var(--text-sub)] hover:text-white'}`}
                                            title={autoClearFields.inspiration ? '长按取消自动清空' : '长按激活自动清空'}
                                        ><X size={10} />清空</button>}
                                    </div>
                                    <textarea className="flex-1 w-full p-3 bg-[var(--panel-bg)] border border-[var(--border)] rounded-lg shadow-sm focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30 resize-y text-sm text-[var(--text-main)] leading-relaxed outline-none transition"
                                        style={{ minHeight: '150px', height: localStorage.getItem(getStorageKey('chapter_insp_h')) || 'auto' }}
                                        onMouseUp={(e) => localStorage.setItem(getStorageKey('chapter_insp_h'), e.target.style.height)}
                                        placeholder={"# 核心冲突\n在这里输入你脑海中的画面...\n\n- 主角说：...\n- 反派动作：..."}
                                        value={formData.inspiration}
                                        onChange={e => setFormData({ ...formData, inspiration: e.target.value })}
                                    />

                                    {/* 生成参数 - 电脑版显示在中间区域底部 */}
                                    <div className="hidden lg:flex items-center gap-4 bg-[var(--panel-bg)] p-3 rounded-lg border border-[var(--border)]">
                                        <div className="flex-1">
                                            <div className="flex justify-between text-[11px] text-[var(--text-sub)] font-bold mb-1">
                                                <span>细分场景数</span>
                                                <span className="text-[var(--accent)]">{formData.sceneCount}</span>
                                            </div>
                                            <input type="range" min="2" max="10" value={formData.sceneCount} onChange={e => setFormData({ ...formData, sceneCount: parseInt(e.target.value) })}
                                                className="w-full h-1.5 bg-[var(--border)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]" />
                                        </div>
                                        <div className="w-px h-8 bg-[var(--border)]"></div>
                                        <div className="flex-1">
                                            <span className="block text-[11px] text-[var(--text-sub)] font-bold mb-1">生成方案数</span>
                                            <div className="flex bg-[var(--app-bg)] rounded p-0.5">
                                                {['1', '3', '5', '7', '9'].map(num => (
                                                    <button key={num} onClick={() => setFormData({ ...formData, ideaCount: num })}
                                                        className={`flex-1 py-0.5 text-[10px] rounded transition font-medium ${formData.ideaCount === num ? 'bg-[var(--panel-bg)] shadow-sm text-[var(--accent)] font-bold' : 'hover:bg-[var(--hover-bg)] text-[var(--text-sub)]'}`}>
                                                        {num}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Sidebar: 手机端放中间，电脑端空间不足时可滚动 */}
                                <div className="bg-[var(--panel-bg)] border-l border-[var(--border)] p-2 flex flex-col gap-2 lg:order-3 order-2 border-t lg:border-t-0 lg:border-l lg:overflow-y-auto custom-scrollbar">

                                    {/* Goals - 手机版可折叠 */}
                                    <div>
                                        <button onClick={() => setIsMobileGoalsExpanded(!isMobileGoalsExpanded)} className="lg:hidden w-full flex justify-between items-center text-[11px] font-bold uppercase tracking-wider text-[var(--text-sub)] mb-2">
                                            <span className="flex items-center gap-1.5"><Target size={12} className="text-red-500" /> 目标与约束</span>
                                            {isMobileGoalsExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                        </button>
                                        <div className="hidden lg:flex text-[11px] font-bold uppercase tracking-wider text-[var(--text-sub)] mb-2 items-center gap-1.5">
                                            <Target size={12} className="text-red-500" /> 目标与约束
                                        </div>
                                        <div className={`space-y-2 ${isMobileGoalsExpanded ? '' : 'hidden'} lg:block`}>
                                            <div>
                                                <label className="block text-[10px] font-bold text-[var(--text-sub)] mb-0.5">🎯 核心爽点</label>
                                                <div className="relative">
                                                    <input className="w-full h-7 px-2 pr-7 rounded bg-[var(--app-bg)] border border-[var(--border)] text-xs text-[var(--text-main)] focus:bg-[var(--panel-bg)] focus:border-[var(--accent)] outline-none transition"
                                                        placeholder="例如：扮猪吃虎" value={formData.goal} onChange={e => setFormData({ ...formData, goal: e.target.value })} />
                                                    {(formData.goal || autoClearFields.goal) && <button
                                                        onClick={() => setFormData({ ...formData, goal: '' })}
                                                        onMouseDown={() => handleClearBtnMouseDown('goal')}
                                                        onMouseUp={handleClearBtnMouseUp}
                                                        onMouseLeave={handleClearBtnMouseUp}
                                                        onTouchStart={() => handleClearBtnMouseDown('goal')}
                                                        onTouchEnd={handleClearBtnMouseUp}
                                                        onContextMenu={(e) => e.preventDefault()}
                                                        className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center transition ${autoClearFields.goal ? 'bg-[var(--accent)] text-white' : 'bg-[var(--border)] hover:bg-red-400 text-[var(--text-sub)] hover:text-white'}`}
                                                        title={autoClearFields.goal ? '长按取消自动清空' : '长按激活自动清空'}
                                                    ><X size={10} /></button>}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="flex justify-between items-center mb-0.5">
                                                    <label className="text-[10px] font-bold text-[var(--text-sub)] flex items-center gap-1"><Play size={8} className="fill-current" /> 本章开头</label>
                                                    <div className="flex items-center gap-0.5">
                                                        <input type="checkbox" id="forceStart" checked={formData.isStartForced} onChange={e => setFormData({ ...formData, isStartForced: e.target.checked })} className="w-2.5 h-2.5 cursor-pointer accent-[var(--accent)]" />
                                                        <label htmlFor="forceStart" className="text-[9px] text-[var(--text-sub)] cursor-pointer select-none">强制</label>
                                                    </div>
                                                </div>
                                                <div className="relative">
                                                    <input className="w-full h-7 px-2 pr-7 rounded bg-[var(--app-bg)] border border-[var(--border)] text-xs text-[var(--text-main)] focus:bg-[var(--panel-bg)] focus:border-[var(--accent)] outline-none transition"
                                                        placeholder="例如：承接上文，主角醒来" value={formData.start} onChange={e => setFormData({ ...formData, start: e.target.value })} />
                                                    {(formData.start || autoClearFields.start) && <button
                                                        onClick={() => setFormData({ ...formData, start: '' })}
                                                        onMouseDown={() => handleClearBtnMouseDown('start')}
                                                        onMouseUp={handleClearBtnMouseUp}
                                                        onMouseLeave={handleClearBtnMouseUp}
                                                        onTouchStart={() => handleClearBtnMouseDown('start')}
                                                        onTouchEnd={handleClearBtnMouseUp}
                                                        onContextMenu={(e) => e.preventDefault()}
                                                        className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center transition ${autoClearFields.start ? 'bg-[var(--accent)] text-white' : 'bg-[var(--border)] hover:bg-red-400 text-[var(--text-sub)] hover:text-white'}`}
                                                        title={autoClearFields.start ? '长按取消自动清空' : '长按激活自动清空'}
                                                    ><X size={10} /></button>}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="flex justify-between items-center mb-0.5">
                                                    <label className="text-[10px] font-bold text-[var(--text-sub)] flex items-center gap-1"><Flag size={8} className="fill-current" /> 本章结尾</label>
                                                    <div className="flex items-center gap-0.5">
                                                        <input type="checkbox" id="forceOutcome" checked={formData.isOutcomeForced} onChange={e => setFormData({ ...formData, isOutcomeForced: e.target.checked })} className="w-2.5 h-2.5 cursor-pointer accent-[var(--accent)]" />
                                                        <label htmlFor="forceOutcome" className="text-[9px] text-[var(--text-sub)] cursor-pointer select-none">强制</label>
                                                    </div>
                                                </div>
                                                <div className="relative">
                                                    <input className="w-full h-7 px-2 pr-7 rounded bg-[var(--app-bg)] border border-[var(--border)] text-xs text-[var(--text-main)] focus:bg-[var(--panel-bg)] focus:border-[var(--accent)] outline-none transition"
                                                        placeholder="例如：获得宝物" value={formData.outcome} onChange={e => setFormData({ ...formData, outcome: e.target.value })} />
                                                    {(formData.outcome || autoClearFields.outcome) && <button
                                                        onClick={() => setFormData({ ...formData, outcome: '' })}
                                                        onMouseDown={() => handleClearBtnMouseDown('outcome')}
                                                        onMouseUp={handleClearBtnMouseUp}
                                                        onMouseLeave={handleClearBtnMouseUp}
                                                        onTouchStart={() => handleClearBtnMouseDown('outcome')}
                                                        onTouchEnd={handleClearBtnMouseUp}
                                                        onContextMenu={(e) => e.preventDefault()}
                                                        className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center transition ${autoClearFields.outcome ? 'bg-[var(--accent)] text-white' : 'bg-[var(--border)] hover:bg-red-400 text-[var(--text-sub)] hover:text-white'}`}
                                                        title={autoClearFields.outcome ? '长按取消自动清空' : '长按激活自动清空'}
                                                    ><X size={10} /></button>}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-[var(--text-sub)] mb-0.5">⛔ 避雷禁忌</label>
                                                <div className="relative">
                                                    <input className="w-full h-7 px-2 pr-7 rounded bg-[var(--app-bg)] border border-[var(--border)] text-xs text-[var(--text-main)] focus:bg-[var(--panel-bg)] focus:border-[var(--accent)] outline-none transition"
                                                        placeholder="例如：不写心理活动" value={formData.taboos} onChange={e => setFormData({ ...formData, taboos: e.target.value })} />
                                                    {(formData.taboos || autoClearFields.taboos) && <button
                                                        onClick={() => setFormData({ ...formData, taboos: '' })}
                                                        onMouseDown={() => handleClearBtnMouseDown('taboos')}
                                                        onMouseUp={handleClearBtnMouseUp}
                                                        onMouseLeave={handleClearBtnMouseUp}
                                                        onTouchStart={() => handleClearBtnMouseDown('taboos')}
                                                        onTouchEnd={handleClearBtnMouseUp}
                                                        onContextMenu={(e) => e.preventDefault()}
                                                        className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center transition ${autoClearFields.taboos ? 'bg-[var(--accent)] text-white' : 'bg-[var(--border)] hover:bg-red-400 text-[var(--text-sub)] hover:text-white'}`}
                                                        title={autoClearFields.taboos ? '长按取消自动清空' : '长按激活自动清空'}
                                                    ><X size={10} /></button>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Resource Config - 手机版可折叠 */}
                                    <div>
                                        <button onClick={() => setIsMobileResourceExpanded(!isMobileResourceExpanded)} className="lg:hidden w-full flex justify-between items-center text-[11px] font-bold uppercase tracking-wider text-[var(--text-sub)] mb-2">
                                            <span className="flex items-center gap-1.5"><Layers size={12} className="text-emerald-500" /> 资源配置</span>
                                            {isMobileResourceExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                        </button>
                                        <div className="hidden lg:flex text-[11px] font-bold uppercase tracking-wider text-[var(--text-sub)] mb-2 items-center gap-1.5">
                                            <Layers size={12} className="text-emerald-500" /> 资源配置
                                        </div>
                                        <div className={`space-y-1.5 ${isMobileResourceExpanded ? '' : 'hidden'} lg:block`}>
                                            <button onClick={() => { setModalType('char'); setActiveCharCat(charCats[0]?.id); }}
                                                className="w-full flex items-center gap-2 p-2 bg-[var(--app-bg)] border border-[var(--border)] rounded-lg cursor-pointer transition hover:border-[var(--text-sub)] hover:bg-[var(--hover-bg)] group text-left">
                                                <div className="w-6 h-6 rounded-md bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                                                    <User size={12} />
                                                </div>
                                                <div className="flex-1 overflow-hidden">
                                                    <div className={`text-xs font-medium truncate ${selectedCharIds.size > 0 ? 'text-[var(--text-main)]' : 'text-[var(--text-sub)]'}`}>
                                                        {selectedCharIds.size > 0 ? getResourceBtnText(selectedCharIds, charCats) : '登场人物'}
                                                    </div>
                                                </div>
                                                <ChevronRight size={10} className="text-[var(--text-sub)]" />
                                            </button>
                                            <button onClick={() => { setModalType('scene'); setActiveSceneCat(sceneCats[0]?.id); }}
                                                className="w-full flex items-center gap-2 p-2 bg-[var(--app-bg)] border border-[var(--border)] rounded-lg cursor-pointer transition hover:border-[var(--text-sub)] hover:bg-[var(--hover-bg)] group text-left">
                                                <div className="w-6 h-6 rounded-md bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                                                    <MapPin size={12} />
                                                </div>
                                                <div className="flex-1 overflow-hidden">
                                                    <div className={`text-xs font-medium truncate ${selectedSceneIds.size > 0 ? 'text-[var(--text-main)]' : 'text-[var(--text-sub)]'}`}>
                                                        {selectedSceneIds.size > 0 ? getResourceBtnText(selectedSceneIds, sceneCats) : '发生场景'}
                                                    </div>
                                                </div>
                                                <ChevronRight size={10} className="text-[var(--text-sub)]" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Style - 在分割线之前 */}
                                    <div className="relative">
                                        <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-sub)] mb-2 flex items-center gap-1.5">
                                            <Sliders size={12} className="text-purple-500" /> 风格基调
                                        </div>
                                        <button onClick={() => setStyleMenuOpen(!styleMenuOpen)}
                                            className="w-full flex items-center gap-2 p-2 bg-[var(--app-bg)] border border-[var(--border)] rounded-lg cursor-pointer transition hover:border-[var(--text-sub)] hover:bg-[var(--hover-bg)] group text-left relative">
                                            <div className="w-6 h-6 rounded-md bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                                                <Sliders size={12} />
                                            </div>
                                            <div className="flex-1 overflow-hidden">
                                                <div className="text-xs font-bold text-[var(--text-main)] truncate">{formData.style}</div>
                                            </div>
                                            <ChevronDown size={10} className="text-[var(--text-sub)]" />
                                        </button>

                                        {styleMenuOpen && (
                                            <>
                                                <div className="fixed inset-0 z-10" onClick={() => setStyleMenuOpen(false)}></div>
                                                <div className="absolute bottom-full left-0 w-full mb-1 bg-[var(--panel-bg)] border border-[var(--border)] rounded-lg shadow-xl z-20 py-1 flex flex-col animate-in slide-in-from-bottom-2 max-h-48 overflow-y-auto">
                                                    {(availableStyles || []).map((opt, idx) => (
                                                        <div key={idx} onClick={() => { setFormData({ ...formData, style: opt.label }); setStyleMenuOpen(false); }}
                                                            className={`px-3 py-2 text-[13px] flex items-center gap-2 cursor-pointer hover:bg-[var(--hover-bg)] transition ${formData.style === opt.label ? 'bg-[var(--accent-bg)] text-[var(--accent)] font-semibold' : 'text-[var(--text-main)]'}`}>
                                                            <span className="text-xs">{opt.icon || '✨'}</span>
                                                            {opt.label}
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <div className="h-px bg-[var(--border)] my-2"></div>

                                    {/* 生成参数 - 手机版显示在按钮上方 */}
                                    <div className="lg:hidden space-y-3 mb-3">
                                        <div>
                                            <div className="flex justify-between text-[11px] text-[var(--text-sub)] font-bold mb-1">
                                                <span>细分场景数</span>
                                                <span className="text-[var(--accent)]">{formData.sceneCount}</span>
                                            </div>
                                            <input type="range" min="2" max="10" value={formData.sceneCount} onChange={e => setFormData({ ...formData, sceneCount: parseInt(e.target.value) })}
                                                className="w-full h-1.5 bg-[var(--border)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]" />
                                        </div>
                                        <div>
                                            <span className="block text-[11px] text-[var(--text-sub)] font-bold mb-1">生成方案数</span>
                                            <div className="flex bg-[var(--app-bg)] rounded p-0.5">
                                                {['1', '3', '5', '7', '9'].map(num => (
                                                    <button key={num} onClick={() => setFormData({ ...formData, ideaCount: num })}
                                                        className={`flex-1 py-1 text-[11px] rounded transition font-medium ${formData.ideaCount === num ? 'bg-[var(--panel-bg)] shadow-sm text-[var(--accent)] font-bold' : 'hover:bg-[var(--hover-bg)] text-[var(--text-sub)]'}`}>
                                                        {num}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Generate Button */}
                                    <button onClick={handleGenerate} disabled={isGenerating}
                                        className="w-full py-2.5 bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white font-bold rounded-lg shadow-md shadow-[var(--accent)]/20 transform active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                                        {isGenerating ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                                        {isGenerating ? 'AI 正在构思...' : '开始生成细纲'}
                                    </button>


                                </div>
                            </div>
                        </motion.div>

                        {/* Resource Selector Modals */}
                        <ResourceSelector isOpen={modalType === 'char'} onClose={() => setModalType(null)}
                            title="选择登场人物" icon={User} colorClass="bg-blue-600" dataCats={charCats}
                            selectedIds={selectedCharIds} onToggle={(id) => { const newSet = new Set(selectedCharIds); if (newSet.has(id)) newSet.delete(id); else newSet.add(id); setSelectedCharIds(newSet); }}
                            activeCatId={activeCharCat} setActiveCatId={setActiveCharCat}
                            fieldOrder={storeCharFields.map(f => f.label)} />

                        <ResourceSelector isOpen={modalType === 'scene'} onClose={() => setModalType(null)}
                            title="选择发生场景" icon={MapPin} colorClass="bg-emerald-600" dataCats={sceneCats}
                            selectedIds={selectedSceneIds} onToggle={(id) => { const newSet = new Set(selectedSceneIds); if (newSet.has(id)) newSet.delete(id); else newSet.add(id); setSelectedSceneIds(newSet); }}
                            activeCatId={activeSceneCat} setActiveCatId={setActiveSceneCat} />

                        {/* Chapter Result Modal */}
                        <ChapterResultModal
                            isOpen={isResultOpen}
                            onClose={() => setIsResultOpen(false)}
                            onCloseAll={() => { setIsResultOpen(false); onClose(); }}
                            ideas={generatedIdeas}
                            setIdeas={setGeneratedIdeas}
                            rawContent={rawContent}
                            isGenerating={isGenerating}
                            onInsertContent={onInsertContent}
                            activeChapter={activeChapter}
                        />

                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
