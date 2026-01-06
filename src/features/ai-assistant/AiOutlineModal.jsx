import React, { useState, useEffect } from 'react';
import { Lightbulb, X, Sparkles, Loader2, Copy, Check, Edit3, ArrowLeft, Send, Target, Flag, Ban, Hash } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DEFAULT_AI_CONFIG, DEFAULT_OUTLINE_AI_CONFIG } from '../../constants';
import { useSettingsStore } from '../../stores';
import { cleanAiIdeasResponse } from '../../utils/aiResponseCleaner';
import { apiClient } from '../../services/api';

// --- 子组件：结果展示独立弹窗 (保持不变) ---
const OutlineResultModal = ({ isOpen, onClose, ideas, setIdeas, rawContent }) => {


    const [copiedIndex, setCopiedIndex] = useState(null);

    const handleCopy = async (text, idx) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedIndex(idx);
            setTimeout(() => setCopiedIndex(null), 2000);
        } catch (err) {
            console.error('Copy failed');
            // 兜底复制
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            setCopiedIndex(idx);
            setTimeout(() => setCopiedIndex(null), 2000);
        }
    };

    const handleContentChange = (idx, newContent) => {
        const newIdeas = [...ideas];
        newIdeas[idx] = { ...newIdeas[idx], content: newContent };
        setIdeas(newIdeas);
    };

    const adjustHeight = (e) => {
        e.target.style.height = 'auto';
        e.target.style.height = e.target.scrollHeight + 'px';
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center pointer-events-auto">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        transition={{ duration: 0.2 }}
                        className="bg-[var(--panel-bg)] w-[900px] h-[85vh] rounded-xl shadow-2xl border border-[var(--border)] flex flex-col overflow-hidden relative z-10"
                    >
                        {/* Header */}
                        <div className="flex justify-between items-center px-5 py-4 border-b border-[var(--border)] bg-[var(--app-bg)] shrink-0">
                            <button onClick={onClose} className="flex items-center gap-1 text-sm text-[var(--text-sub)] hover:text-[var(--text-main)] transition-colors">
                                <ArrowLeft size={16} /> 返回编辑
                            </button>
                            <h3 className="font-bold text-[var(--text-main)] flex items-center gap-2 absolute left-1/2 -translate-x-1/2">
                                <Sparkles size={18} className="text-yellow-500" /> 生成结果
                            </h3>
                            <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-[var(--hover-bg)] text-[var(--text-sub)] flex items-center justify-center transition">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-[var(--panel-bg)]">
                            {ideas.length > 0 ? (
                                <div className="space-y-6">
                                    {ideas.map((idea, idx) => (
                                        <div key={idx} className="bg-[var(--app-bg)] rounded-xl border-l-4 border-blue-400 shadow-sm hover:shadow-md transition-all duration-300">
                                            <div className="flex justify-between items-center p-3 border-b border-[var(--border)] bg-[var(--app-bg)]/50 rounded-t-xl">
                                                <div className="flex items-center gap-2">
                                                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-bold border border-blue-200">
                                                        {idea.type || `方案 ${idx + 1}`}
                                                    </span>
                                                    <span className="text-[10px] text-[var(--text-sub)] flex items-center gap-1 opacity-60">
                                                        <Edit3 size={10} /> 可编辑
                                                    </span>
                                                </div>
                                                <button onClick={() => handleCopy(idea.content, idx)} className="text-[var(--text-sub)] hover:text-[var(--accent)] p-1.5 rounded hover:bg-[var(--hover-bg)]" title="复制内容">
                                                    {copiedIndex === idx ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                                                </button>
                                            </div>
                                            <textarea
                                                className="w-full p-4 text-sm text-[var(--text-main)] leading-relaxed font-mono bg-transparent border-none outline-none resize-none overflow-hidden focus:bg-[var(--panel-bg)] transition-colors"
                                                value={idea.content}
                                                onChange={(e) => { handleContentChange(idx, e.target.value); adjustHeight(e); }}
                                                onFocus={adjustHeight}
                                                rows={Math.max(3, (idea.content?.split('\n').length || 1) + 1)}
                                                spellCheck={false}
                                            />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="bg-[var(--app-bg)] rounded-xl border border-[var(--border)] shadow-sm relative group">
                                    <div className="flex justify-between items-center p-2 border-b border-[var(--border)] bg-[var(--hover-bg)]/50">
                                        <span className="text-xs font-bold text-red-500 flex items-center gap-1">⚠️ 格式解析失败，显示原始文本</span>
                                        <button onClick={() => handleCopy(rawContent, 'raw')} className="text-[var(--text-sub)] hover:text-[var(--accent)] p-1.5 rounded hover:bg-[var(--hover-bg)]" title="复制全部">
                                            {copiedIndex === 'raw' ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                                        </button>
                                    </div>
                                    <div className="p-4 text-sm whitespace-pre-wrap text-[var(--text-main)] font-mono leading-loose">
                                        {rawContent || "没有内容"}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-[var(--border)] bg-[var(--app-bg)] flex justify-end gap-3 shrink-0">
                            <button onClick={onClose} className="px-6 py-2 rounded-lg text-sm font-bold bg-[var(--accent)] text-white shadow hover:bg-[var(--accent)]/90 transition-all">
                                完成
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

// --- 主组件 ---
// [核心]: 接收 getStorageKey
export default function AiOutlineModal({ isOpen, onClose, getStorageKey }) {
    const [formData, setFormData] = useState({ outline: '', goal: '', outcome: '', avoid: '', count: '3' });
    // [修复] 从 settingsStore 获取配置，替代 localStorage
    const storeAiConfig = useSettingsStore(state => state.aiConfig);
    const storeOutlineAiConfig = useSettingsStore(state => state.outlineAiConfig);
    const baseConfig = storeAiConfig || DEFAULT_AI_CONFIG;
    const outlineConfig = storeOutlineAiConfig || DEFAULT_OUTLINE_AI_CONFIG;

    const [isGenerating, setIsGenerating] = useState(false);
    const [ideas, setIdeas] = useState([]);
    const [rawContent, setRawContent] = useState('');
    const [isResultOpen, setIsResultOpen] = useState(false);

    // [新增] 自动清空字段状态（长按激活）
    const [autoClearFields, setAutoClearFields] = useState({});

    // [新增] 长按处理
    const longPressTimerRef = React.useRef(null);
    const handleClearBtnMouseDown = (fieldName) => {
        longPressTimerRef.current = setTimeout(() => {
            // 长按：切换自动清空状态
            setAutoClearFields(prev => {
                const newState = { ...prev, [fieldName]: !prev[fieldName] };
                localStorage.setItem(getStorageKey('outline_ai_auto_clear'), JSON.stringify(newState));
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

    // [新增] 加载保存的配置
    const loadSavedConfig = () => {
        const key = getStorageKey('outline_ai_form');
        const saved = localStorage.getItem(key);
        if (saved) {
            try {
                const config = JSON.parse(saved);
                setFormData(prev => ({
                    ...prev,
                    outline: config.outline || '',
                    goal: config.goal || '',
                    outcome: config.outcome || '',
                    avoid: config.avoid || '',
                    count: config.count || '3'
                }));
            } catch (e) { console.warn('[OutlineAI] Load config failed:', e); }
        }
    };

    // [新增] 保存配置
    const saveConfig = () => {
        const key = getStorageKey('outline_ai_form');
        const config = {
            outline: formData.outline,
            goal: formData.goal,
            outcome: formData.outcome,
            avoid: formData.avoid,
            count: formData.count
        };
        localStorage.setItem(key, JSON.stringify(config));
    };

    // [新增] 监听打开，读取记忆并应用自动清空
    useEffect(() => {
        if (isOpen) {
            // 1. 加载自动清空配置
            const savedAutoClear = localStorage.getItem(getStorageKey('outline_ai_auto_clear'));
            const autoClear = savedAutoClear ? JSON.parse(savedAutoClear) : {};
            setAutoClearFields(autoClear);

            // 2. 加载分书保存的表单配置
            loadSavedConfig();

            // 3. 应用自动清空：打开时清空已激活的字段
            setFormData(prev => ({
                ...prev,
                outline: autoClear.outline ? '' : prev.outline,
                goal: autoClear.goal ? '' : prev.goal,
                outcome: autoClear.outcome ? '' : prev.outcome,
                avoid: autoClear.avoid ? '' : prev.avoid
            }));
        }
    }, [isOpen, getStorageKey]);

    const handleGenerate = async () => {
        if (!baseConfig.apiKey) { alert('请先在“设置 -> AI配置”中配置 API Key'); return; }
        if (!formData.outline.trim()) { alert('请输入核心脑洞'); return; }

        // [新增] 点击生成时保存配置
        saveConfig();

        setIsGenerating(true);
        setIdeas([]);
        setRawContent('');

        // 模型回退逻辑
        let targetModel = outlineConfig.model;
        const availableModels = baseConfig.models || [];
        const isModelValid = availableModels.some(m => m.id === targetModel);
        if (!isModelValid && availableModels.length > 0) {
            targetModel = availableModels[0].id;
        }

        try {
            let prompt = outlineConfig.promptTemplate || DEFAULT_OUTLINE_AI_CONFIG.promptTemplate;
            prompt = prompt.replace('{{outline}}', formData.outline)
                .replace('{{goal}}', formData.goal)
                .replace('{{outcome}}', formData.outcome)
                .replace('{{avoid}}', formData.avoid)
                .replace('{{count}}', formData.count);

            if (!outlineConfig.promptTemplate.includes('{{count}}')) {
                prompt += `\n\n【重要指令】请务必生成 ${formData.count} 个不同的方案。`;
            }

            // [严格模式] 禁止 Markdown 格式
            prompt += `\n\n【严格模式】忽略所有聊天礼仪。只输出纯文本内容，禁止使用任何Markdown格式（如、#、-等）。不要对内容进行格式化包装，直接返回原始内容。`;

            // [修复] 获取 Token 并添加到请求头
            const token = localStorage.getItem('novel_token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const resData = await apiClient.post('/api/ai/generate', {
                apiKey: baseConfig.apiKey,
                baseUrl: baseConfig.baseUrl,
                model: targetModel,
                timeout: baseConfig.timeout || 60,
                messages: [{ role: "user", content: prompt }]
            });

            // apiClient 已处理 JSON 解析

            let finalData = null;
            let finalRaw = '';

            // [RESTful] 成功获取数据 (HTTP 200)
            if (Array.isArray(resData.data)) {
                finalData = resData.data;
            }
            // [RESTful] 检查 HTTP 206 或原始文本，并使用统一清洗函数
            else if (resData.error) {
                throw new Error(resData.error);
            }
            else {
                const rawText = resData.data?.[0]?.content || JSON.stringify(resData);
                finalRaw = rawText;

                // 使用统一的 AI 响应清洗函数
                const cleaned = cleanAiIdeasResponse(rawText);
                if (cleaned.success && Array.isArray(cleaned.data)) {
                    finalData = cleaned.data;
                }
            }

            if (finalData) {
                setIdeas(finalData);
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



    return (
        <div className={`fixed inset-0 flex items-center justify-center ${isOpen ? 'z-[1100]' : 'z-[-1]'}`}>
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
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            transition={{ duration: 0.2 }}
                            className="bg-[var(--panel-bg)] w-[95%] max-w-[600px] h-[85vh] sm:h-[80vh] rounded-xl shadow-2xl border border-[var(--border)] flex flex-col overflow-visible relative z-10 pointer-events-auto"
                        >
                            {/* 顶部 */}
                            <div className="flex justify-between items-center px-5 py-4 border-b border-[var(--border)] bg-[var(--app-bg)]">
                                <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
                                    <Lightbulb className="text-yellow-500 fill-yellow-500/20" size={22} />
                                    大纲灵感生成
                                </h2>
                                <button onClick={onClose}><X size={20} className="text-[var(--text-sub)] hover:text-[var(--text-main)]" /></button>
                            </div>

                            {/* 输入表单 (单栏布局) */}
                            <div className="flex-1 overflow-y-auto p-6 pb-24 custom-scrollbar">
                                <div className="space-y-5">
                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2"><Send size={16} className="text-[var(--accent)]" /> 核心脑洞 / 粗纲</label>
                                            {(formData.outline || autoClearFields.outline) && <button
                                                onClick={() => setFormData({ ...formData, outline: '' })}
                                                onMouseDown={() => handleClearBtnMouseDown('outline')}
                                                onMouseUp={handleClearBtnMouseUp}
                                                onMouseLeave={handleClearBtnMouseUp}
                                                onTouchStart={() => handleClearBtnMouseDown('outline')}
                                                onTouchEnd={handleClearBtnMouseUp}
                                                onContextMenu={(e) => e.preventDefault()}
                                                className={`px-1.5 py-0.5 rounded text-[10px] flex items-center gap-0.5 transition ${autoClearFields.outline ? 'bg-[var(--accent)] text-white' : 'bg-[var(--border)] hover:bg-red-400 text-[var(--text-sub)] hover:text-white'}`}
                                                title={autoClearFields.outline ? '长按取消自动清空' : '长按激活自动清空'}
                                            ><X size={12} />清空</button>}
                                        </div>
                                        {/* 允许垂直拉伸 */}
                                        <textarea
                                            className="w-full p-3 bg-[var(--app-bg)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-main)] outline-none focus:border-[var(--accent)] resize-y focus:ring-1 focus:ring-[var(--accent)] placeholder:text-[var(--text-sub)]/50 leading-relaxed"
                                            style={{ height: localStorage.getItem(getStorageKey('outline_h')) || '160px' }}
                                            onMouseUp={(e) => localStorage.setItem(getStorageKey('outline_h'), e.target.style.height)}
                                            placeholder={`例如：\n主角重生回到十年前，此时全球即将进入冰河时代。\n他利用先知先觉囤积了百亿物资，打造了末日堡垒。\n前世背叛他的女神来敲门，他...`}
                                            value={formData.outline}
                                            onChange={e => setFormData({ ...formData, outline: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-bold text-[var(--text-main)] block mb-1 flex items-center gap-1"><Target size={14} className="text-red-500" /> 核心爽点</label>
                                            <div className="relative">
                                                <input className="w-full p-2 pr-7 bg-[var(--app-bg)] border border-[var(--border)] rounded text-sm text-[var(--text-main)] outline-none focus:border-[var(--accent)]" placeholder="如：扮猪吃虎 / 囤货流" value={formData.goal} onChange={e => setFormData({ ...formData, goal: e.target.value })} />
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
                                            <label className="text-xs font-bold text-[var(--text-main)] block mb-1 flex items-center gap-1"><Flag size={14} className="text-blue-500" /> 预期结局</label>
                                            <div className="relative">
                                                <input className="w-full p-2 pr-7 bg-[var(--app-bg)] border border-[var(--border)] rounded text-sm text-[var(--text-main)] outline-none focus:border-[var(--accent)]" placeholder="如：建立最强基地" value={formData.outcome} onChange={e => setFormData({ ...formData, outcome: e.target.value })} />
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
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-[var(--text-main)] block mb-1 flex items-center gap-1"><Ban size={14} className="text-red-500" /> ⛔ 避雷禁忌</label>
                                        <div className="relative">
                                            <input className="w-full p-2 pr-7 bg-[var(--app-bg)] border border-[var(--border)] rounded text-sm text-[var(--text-main)] outline-none focus:border-[var(--accent)]" placeholder="如：不写圣母情节" value={formData.avoid} onChange={e => setFormData({ ...formData, avoid: e.target.value })} />
                                            {(formData.avoid || autoClearFields.avoid) && <button
                                                onClick={() => setFormData({ ...formData, avoid: '' })}
                                                onMouseDown={() => handleClearBtnMouseDown('avoid')}
                                                onMouseUp={handleClearBtnMouseUp}
                                                onMouseLeave={handleClearBtnMouseUp}
                                                onTouchStart={() => handleClearBtnMouseDown('avoid')}
                                                onTouchEnd={handleClearBtnMouseUp}
                                                onContextMenu={(e) => e.preventDefault()}
                                                className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center transition ${autoClearFields.avoid ? 'bg-[var(--accent)] text-white' : 'bg-[var(--border)] hover:bg-red-400 text-[var(--text-sub)] hover:text-white'}`}
                                                title={autoClearFields.avoid ? '长按取消自动清空' : '长按激活自动清空'}
                                            ><X size={10} /></button>}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-[var(--text-main)] block mb-1 flex items-center gap-1"><Hash size={14} className="text-[var(--accent)]" /> 方案数量</label>
                                        <div className="flex bg-[var(--app-bg)] border border-[var(--border)] rounded p-0.5">
                                            {['1', '2', '3', '4', '5'].map(num => (
                                                <button key={num} onClick={() => setFormData({ ...formData, count: num })}
                                                    className={`flex-1 py-2 text-sm rounded transition font-medium ${formData.count === num ? 'bg-[var(--panel-bg)] shadow-sm text-[var(--accent)] font-bold' : 'hover:bg-[var(--hover-bg)] text-[var(--text-sub)]'}`}>
                                                    {num}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 border-t border-[var(--border)] bg-[var(--app-bg)] flex justify-end">
                                <button onClick={handleGenerate} disabled={isGenerating} className="px-8 py-2.5 rounded-lg font-bold text-white shadow-md flex items-center justify-center gap-2 transition-all bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 hover:shadow-lg transform active:scale-95">
                                    {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles />} {isGenerating ? '正在构思...' : '开始生成'}
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* 独立结果弹窗 */}
            <OutlineResultModal
                isOpen={isResultOpen}
                onClose={() => setIsResultOpen(false)}
                ideas={ideas}
                setIdeas={setIdeas}
                rawContent={rawContent}
            />
        </div>
    );
}
