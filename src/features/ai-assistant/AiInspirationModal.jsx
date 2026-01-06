// ==================================================
// File: frontend/src/components/AiInspirationModal.jsx
// ==================================================
import React, { useState, useEffect, useRef } from 'react';
import {
    Lightbulb, X, Send, Target, Flag, Ban, Hash,
    ChevronDown, ChevronRight, Settings2, Sparkles,
    User, Globe, Copy, Check, ArrowLeft, Loader2, Edit3
} from 'lucide-react';
import { DEFAULT_AI_CONFIG, STORAGE_PREFIX } from '../../constants';
import { apiClient } from '../../services/api';

// --- 子组件：结果展示独立弹窗 (支持编辑 + 自动高度) ---
const ResultModal = ({ isOpen, onClose, rawContent, ideas, setIdeas, isGenerating, onReGenerate }) => {
    if (!isOpen) return null;

    const [copiedIndex, setCopiedIndex] = useState(null);

    // 复制功能
    const handleCopy = async (text, idx) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedIndex(idx);
            setTimeout(() => setCopiedIndex(null), 2000);
        } catch (err) {
            console.error('Copy failed', err);
            // 兜底策略
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

    // 编辑功能：允许用户修改 AI 生成的内容
    const handleContentChange = (idx, newContent) => {
        const newIdeas = [...ideas];
        newIdeas[idx] = { ...newIdeas[idx], content: newContent };
        setIdeas(newIdeas);
    };

    // 自动调整 Textarea 高度
    const adjustHeight = (target) => {
        if (!target) return;
        target.style.height = 'auto';
        target.style.height = target.scrollHeight + 'px';
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            {/* [核心适配] 弹窗宽度响应式调整: w-[95%] max-w-[800px] */}
            <div className="bg-[var(--panel-bg)] w-[95%] max-w-[800px] h-[85vh] rounded-xl shadow-2xl border border-[var(--border)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 relative">

                {/* 顶部导航栏 */}
                <div className="flex justify-between items-center px-5 py-4 border-b border-[var(--border)] bg-[var(--app-bg)] shrink-0">
                    <button
                        onClick={onClose}
                        className="flex items-center gap-1 text-sm text-[var(--text-sub)] hover:text-[var(--text-main)] transition-colors"
                        disabled={isGenerating}
                    >
                        <ArrowLeft size={16} /> 返回编辑
                    </button>
                    <h3 className="font-bold text-[var(--text-main)] flex items-center gap-2">
                        {isGenerating ? <Loader2 size={18} className="animate-spin text-[var(--accent)]" /> : <Sparkles size={18} className="text-yellow-500" />}
                        {isGenerating ? 'AI 正在构思...' : '生成方案 (可直接修改)'}
                    </h3>
                    <div className="w-16"></div> {/* 占位，保持标题居中 */}
                </div>

                {/* 内容滚动区 */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-[var(--panel-bg)]">
                    {/* 状态 1: 加载中 */}
                    {isGenerating && (
                        <div className="flex flex-col items-center justify-center h-full text-[var(--text-sub)] opacity-70 gap-4">
                            <div className="relative">
                                <Loader2 size={48} className="animate-spin text-[var(--accent)]" />
                                <Sparkles size={20} className="absolute -top-2 -right-2 text-yellow-500 animate-bounce" />
                            </div>
                            <div className="text-center space-y-2">
                                <p className="text-base font-bold animate-pulse">正在全速生成中...</p>
                                <p className="text-xs opacity-60">请求已发送至后端，正在等待完整结果返回...</p>
                            </div>
                        </div>
                    )}

                    {/* 状态 2: 显示结构化结果 (卡片模式) */}
                    {!isGenerating && ideas && ideas.length > 0 ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {ideas.map((idea, idx) => (
                                <div key={idx} className="bg-[var(--app-bg)] rounded-xl border-l-4 border-yellow-400 shadow-sm hover:shadow-md transition-all duration-300 group">
                                    {/* 卡片头部 */}
                                    <div className="flex justify-between items-center p-3 border-b border-[var(--border)] bg-[var(--app-bg)]/50 rounded-t-xl">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded text-xs font-bold border border-yellow-200 dark:border-yellow-800">
                                                {idea.type || `方案 ${idx + 1}`}
                                            </span>
                                            <span className="text-[10px] text-[var(--text-sub)] flex items-center gap-1 opacity-60">
                                                <Edit3 size={10} /> 可编辑
                                            </span>
                                        </div>

                                        <button
                                            onClick={() => handleCopy(idea.content, idx)}
                                            className="text-[var(--text-sub)] hover:text-[var(--accent)] transition-colors p-1.5 rounded hover:bg-[var(--hover-bg)] relative"
                                            title="复制内容"
                                        >
                                            {copiedIndex === idx ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                                        </button>
                                    </div>

                                    {/* 卡片内容 (可编辑 Textarea) */}
                                    <textarea
                                        className="w-full p-4 text-sm text-[var(--text-main)] leading-relaxed font-mono bg-transparent border-none outline-none resize-none overflow-hidden focus:bg-[var(--panel-bg)] transition-colors"
                                        value={idea.content}
                                        onChange={(e) => { handleContentChange(idx, e.target.value); adjustHeight(e.target); }}
                                        onFocus={(e) => adjustHeight(e.target)}
                                        // 初始化时自动调整高度
                                        ref={(el) => adjustHeight(el)}
                                        spellCheck={false}
                                    />
                                </div>
                            ))}
                        </div>
                    ) : (
                        // 状态 3: 兜底文本展示 (如果后端解析 JSON 失败，返回了原始文本)
                        !isGenerating && rawContent && (
                            <div className="font-mono text-sm text-[var(--text-main)] leading-loose whitespace-pre-wrap animate-in fade-in bg-[var(--app-bg)] p-4 rounded border border-[var(--border)] opacity-80">
                                {rawContent}
                            </div>
                        )
                    )}
                </div>

                {/* 底部栏 */}
                <div className="p-4 border-t border-[var(--border)] bg-[var(--app-bg)] flex justify-end gap-3 shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-sm font-bold text-[var(--text-sub)] hover:bg-[var(--hover-bg)] transition-colors"
                        disabled={isGenerating}
                    >
                        关闭
                    </button>
                    {!isGenerating && (
                        <button
                            onClick={onReGenerate}
                            className="px-6 py-2 rounded-lg text-sm font-bold bg-[var(--accent)] text-white shadow hover:bg-[var(--accent)]/90 transition-all flex items-center gap-2"
                        >
                            <Sparkles size={16} /> 不满意？重试
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- 主组件 ---
// [优化] 改为接收 aiConfig prop，由父组件传入，确保配置来源一致
export default function AiInspirationModal({ isOpen, onClose, aiConfig: propsAiConfig }) {
    // 输入表单状态
    const [formData, setFormData] = useState({
        outline: '',
        goal: '',
        ending: '',
        taboos: '',
        count: '3',
        world: '',
        persona: ''
    });

    // UI 状态
    const [isExtraOpen, setIsExtraOpen] = useState(false);
    // [优化] 使用 props 传入的配置，fallback 到默认值
    const aiConfig = propsAiConfig || DEFAULT_AI_CONFIG;

    // 结果状态
    const [isResultModalOpen, setIsResultModalOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [rawContent, setRawContent] = useState(''); // 原始文本（如果解析失败）
    const [ideas, setIdeas] = useState([]); // 解析后的结构化数据 (State, 可编辑)

    // [移除] 不再从 localStorage 读取，改由 props 传入
    // useEffect(() => { ... localStorage.getItem ... }, [isOpen]);

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleGenerate = async () => {
        if (!aiConfig.apiKey) {
            alert('请先在“设置 -> AI设置”中配置 API Key');
            return;
        }
        if (!formData.outline.trim()) {
            alert('请输入粗纲或剧情点');
            return;
        }

        // --- 核心修复：Inspiration Modal 之前直接读取 undefined 的 aiConfig.model ---
        // 逻辑：尝试使用 aiConfig.models 中的第一个，如果没有则默认 gpt-3.5-turbo (这会失败如果不支持)
        let targetModel = 'gpt-3.5-turbo';
        if (aiConfig.models && aiConfig.models.length > 0) {
            targetModel = aiConfig.models[0].id;
        }
        // ---------------------------------------------------------------------

        // 打开结果弹窗，重置状态
        setIsResultModalOpen(true);
        setRawContent('');
        setIdeas([]);
        setIsGenerating(true);

        try {
            // [修复] 获取 Token 并添加到请求头
            const token = localStorage.getItem('novel_token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            // --- 核心修改：调用后端 Python 接口 ---
            const resData = await apiClient.post('/api/ai/generate', {
                // API 配置 (因为后端容器不知道前端的 LocalStorage，所以必须传过去)
                apiKey: aiConfig.apiKey,
                baseUrl: aiConfig.baseUrl,
                model: targetModel, // 使用修复后的 model ID

                // 剧情参数
                outline: formData.outline,
                goal: formData.goal,
                ending: formData.ending,
                taboos: formData.taboos,
                count: formData.count,
                world: formData.world,
                persona: formData.persona
            });

            // [RESTful] 成功获取数据 (HTTP 200)
            if (Array.isArray(resData.data)) {
                setIdeas(resData.data);
            }
            // [RESTful] 解析失败 (HTTP 206 Partial Content)
            else if (resData.data?.[0]?.content) {
                setIdeas([]);
                setRawContent(resData.data[0]?.content || JSON.stringify(resData)); // 显示原始文本
            }
            else if (resData.error) {
                throw new Error(resData.error);
            }
            else {
                throw new Error('Invalid response format');
            }

        } catch (error) {
            setRawContent(`[请求错误]: ${error.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* --- 输入层弹窗 --- */}
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
                {/* [核心适配] 弹窗宽度响应式调整: w-[95%] max-w-[600px] */}
                <div className="bg-[var(--panel-bg)] w-[95%] max-w-[600px] max-h-[90vh] rounded-xl shadow-2xl border border-[var(--border)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

                    {/* Header */}
                    <div className="flex justify-between items-center px-5 py-4 border-b border-[var(--border)] bg-[var(--app-bg)]">
                        <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
                            <Lightbulb className="text-yellow-500 fill-yellow-500/20" size={22} />
                            灵感风暴
                        </h2>
                        <button onClick={onClose} className="text-[var(--text-sub)] hover:text-[var(--text-main)] hover:bg-[var(--hover-bg)] p-1.5 rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                        {/* 粗纲输入 */}
                        <div className="mb-5">
                            <label className="flex items-center gap-1.5 text-sm font-bold text-[var(--text-main)] mb-2">
                                <Send size={16} className="text-[var(--accent)]" /> 粗纲/剧情点
                            </label>
                            {/* 修复：resize-none -> resize-y */}
                            <textarea
                                className="w-full h-32 p-3 bg-[var(--app-bg)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-main)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] resize-y transition-all placeholder:text-[var(--text-sub)]/50"
                                placeholder="简单写两句你想写啥，AI帮你深化成细纲..."
                                value={formData.outline}
                                onChange={(e) => handleChange('outline', e.target.value)}
                            />
                        </div>

                        {/* 双栏：目的 & 结局 */}
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-main)] mb-1.5">
                                    <Target size={14} className="text-red-500" /> 核心目的 (主题)
                                </label>
                                <input
                                    className="w-full p-2 bg-[var(--app-bg)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
                                    placeholder="如：装逼打脸 / 感情升温"
                                    value={formData.goal}
                                    onChange={(e) => handleChange('goal', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-main)] mb-1.5">
                                    <Flag size={14} className="text-blue-500" /> 本段落脚点 (结局)
                                </label>
                                <input
                                    className="w-full p-2 bg-[var(--app-bg)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
                                    placeholder="如：主角拿到宝物安全离开"
                                    value={formData.ending}
                                    onChange={(e) => handleChange('ending', e.target.value)}
                                />
                            </div>
                        </div>

                        {/* 双栏：禁忌 & 数量 */}
                        <div className="grid grid-cols-2 gap-4 mb-5">
                            <div>
                                <label className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-main)] mb-1.5">
                                    <Ban size={14} className="text-red-500" /> 禁忌/避雷
                                </label>
                                <input
                                    className="w-full p-2 bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-lg text-sm text-[var(--text-main)] outline-none focus:border-red-400 placeholder:text-red-300"
                                    placeholder="如：不要心理描写，不要路人废话"
                                    value={formData.taboos}
                                    onChange={(e) => handleChange('taboos', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-main)] mb-1.5">
                                    <Hash size={14} className="text-[var(--accent)]" /> 灵感方案数量
                                </label>
                                <select
                                    className="w-full p-2 bg-[var(--app-bg)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
                                    value={formData.count}
                                    onChange={(e) => handleChange('count', e.target.value)}
                                >
                                    <option value="1">1个方案</option>
                                    <option value="2">2个方案</option>
                                    <option value="3">3个方案</option>
                                </select>
                            </div>
                        </div>

                        {/* 折叠区：更多背景 */}
                        <div className="border-t border-[var(--border)] pt-2">
                            <button
                                onClick={() => setIsExtraOpen(!isExtraOpen)}
                                className="flex items-center gap-1 text-xs font-bold text-[var(--text-sub)] hover:text-[var(--text-main)] py-2 transition-colors"
                            >
                                <Settings2 size={14} /> 更多背景/人设 {isExtraOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            </button>

                            {isExtraOpen && (
                                <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-1">
                                    <div>
                                        <label className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-main)] mb-1.5 opacity-80">
                                            <Globe size={14} className="text-emerald-500" /> 世界观 / 风格
                                        </label>
                                        {/* 修复：resize-none -> resize-y */}
                                        <textarea
                                            className="w-full h-16 p-2 bg-[var(--app-bg)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-main)] outline-none focus:border-[var(--accent)] resize-y"
                                            placeholder="例如：赛博朋克武侠，等级森严..."
                                            value={formData.world}
                                            onChange={(e) => handleChange('world', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-main)] mb-1.5 opacity-80">
                                            <User size={14} className="text-orange-500" /> 当前场景人设
                                        </label>
                                        {/* 修复：resize-none -> resize-y */}
                                        <textarea
                                            className="w-full h-16 p-2 bg-[var(--app-bg)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-main)] outline-none focus:border-[var(--accent)] resize-y"
                                            placeholder="例如：主角（高冷）；反派（话痨）..."
                                            value={formData.persona}
                                            onChange={(e) => handleChange('persona', e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-[var(--border)] bg-[var(--app-bg)] flex justify-end">
                        <button
                            onClick={handleGenerate}
                            className="px-6 py-2.5 rounded-lg font-bold text-white shadow-md flex items-center gap-2 transition-all bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 hover:shadow-lg active:scale-95"
                        >
                            <Sparkles size={18} className="fill-white/20" /> 开始生成
                        </button>
                    </div>
                </div>
            </div>

            {/* --- 输出层独立弹窗 (覆盖在输入层之上) --- */}
            <ResultModal
                isOpen={isResultModalOpen}
                onClose={() => setIsResultModalOpen(false)}
                rawContent={rawContent}
                ideas={ideas}
                setIdeas={setIdeas}
                isGenerating={isGenerating}
                onReGenerate={handleGenerate}
            />
        </>
    );
}
