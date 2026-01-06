import React, { useState, useEffect } from 'react';
import {
    AlertTriangle, X, Search, CheckCircle2,
    AlertCircle, Activity, Brain, UserX,
    Zap, Sparkles, ChevronRight, Loader2,
    BookOpen, Target
} from 'lucide-react';
import { useNovel } from '../../contexts/NovelContext';
import { useEntityStore, useSettingsStore, useEditorStore, useUIStore } from '../../stores';  // [激进重构] 直接订阅 stores
import { DEFAULT_AI_CONFIG, DEFAULT_TOXIC_AI_CONFIG, toChineseNum } from '../../constants';
import { extractChapterNumber, extractChapterInfo } from '../../utils/chapterParser';
import { cleanAiIssuesResponse } from '../../utils/aiResponseCleaner';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '../../services/api';

// ------------------------------------------------------------------
// 子组件：检查结果卡片
// ------------------------------------------------------------------
const IssueCard = ({ issue, index, onJumpToChapter }) => {
    const severityColors = {
        high: 'border-red-500/50 bg-red-500/5 text-red-600',
        medium: 'border-amber-500/50 bg-amber-500/5 text-amber-600',
        low: 'border-blue-500/50 bg-blue-500/5 text-blue-600'
    };

    const severityIcon = {
        high: <AlertCircle size={18} />,
        medium: <AlertTriangle size={18} />,
        low: <Activity size={18} />
    };

    const colorClass = severityColors[issue.severity] || severityColors.low;

    // 使用 chapterParser.js 中的 extractChapterInfo

    // 尝试从多个字段中提取章节信息
    const chapterFromTitle = issue.chapterTitle;
    const chapterFromDesc = extractChapterInfo(issue.description);
    const chapterFromLocation = extractChapterInfo(issue.location);
    const displayChapter = chapterFromTitle || chapterFromDesc || chapterFromLocation;
    const jumpTarget = displayChapter;

    return (
        <div className={`p-4 rounded-lg border mb-3 text-sm ${colorClass}`}>
            <div className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0">{severityIcon[issue.severity] || severityIcon.low}</div>
                <div className="flex-1 space-y-2">
                    {/* [改进] 章节标题及跳转按钮 - 从多个字段提取 */}
                    {displayChapter && (
                        <div className="flex items-center justify-between bg-black/5 -mx-4 -mt-4 px-4 py-2 rounded-t-lg mb-2">
                            <span className="text-xs font-bold flex items-center gap-1">
                                <BookOpen size={14} />
                                {displayChapter}
                            </span>
                            {onJumpToChapter && (
                                <button
                                    onClick={() => onJumpToChapter(jumpTarget)}
                                    className="text-xs px-2 py-1 rounded bg-white/50 hover:bg-white/80 transition-colors flex items-center gap-1 font-medium"
                                >
                                    跳转 <ChevronRight size={12} />
                                </button>
                            )}
                        </div>
                    )}

                    <div className="flex items-center justify-between">
                        <span className="font-bold flex items-center gap-2">
                            {issue.type}
                            {issue.location && (
                                <span className="text-xs font-normal opacity-70 px-2 py-0.5 rounded-full bg-white/20">
                                    {issue.location}
                                </span>
                            )}
                        </span>
                    </div>

                    <p className="opacity-90 leading-relaxed">{issue.description}</p>

                    {issue.suggestion && (
                        <div className="mt-3 pt-3 border-t border-black/5 flex gap-2">
                            <Sparkles size={14} className="mt-0.5 flex-shrink-0 opacity-70" />
                            <div className="flex-1">
                                <span className="font-medium opacity-80 text-xs uppercase tracking-wider mb-1 block">建议改进</span>
                                <p className="opacity-90">{issue.suggestion}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

IssueCard.propTypes = {
    issue: PropTypes.shape({
        type: PropTypes.string,
        severity: PropTypes.string,
        description: PropTypes.string,
        location: PropTypes.string,
        suggestion: PropTypes.string,
        chapterTitle: PropTypes.string // [新增]
    }).isRequired,
    index: PropTypes.number,
    onJumpToChapter: PropTypes.func // [新增]
};

// ------------------------------------------------------------------
// [新增] 子组件：独立结果展示弹窗（参考 AiOutlineModal 的 OutlineResultModal）
// ------------------------------------------------------------------
const ToxicResultModal = ({ isOpen, onClose, results, onJumpToChapter, onCloseAll }) => {
    return (
        <AnimatePresence>
            {(isOpen && results) && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center">
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
                        className="bg-[var(--panel-bg)] w-[900px] max-w-[95vw] h-[85vh] rounded-xl shadow-2xl border border-[var(--border)] flex flex-col overflow-hidden relative z-10"
                    >
                        {/* Header */}
                        <div className="flex justify-between items-center px-5 py-4 border-b border-[var(--border)] bg-[var(--app-bg)] shrink-0">
                            <button onClick={onClose} className="flex items-center gap-1 text-sm text-[var(--text-sub)] hover:text-[var(--text-main)] transition-colors">
                                <ChevronRight size={16} className="rotate-180" /> 返回配置
                            </button>
                            <h3 className="font-bold text-[var(--text-main)] flex items-center gap-2 absolute left-1/2 -translate-x-1/2">
                                <Sparkles size={18} className="text-yellow-500" /> 毒点检查结果
                                <span className="text-xs font-normal px-2 py-1 bg-black/5 rounded-full text-[var(--text-sub)]">
                                    发现 {results.length} 个问题
                                </span>
                            </h3>
                            <button onClick={onCloseAll} className="w-8 h-8 rounded-full hover:bg-[var(--hover-bg)] text-[var(--text-sub)] flex items-center justify-center transition">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 hide-scrollbar bg-[var(--panel-bg)]">
                            {results.length === 0 ? (
                                <div className="p-8 rounded-xl border border-green-200 bg-green-50 text-green-800 text-center">
                                    <Sparkles size={32} className="mx-auto mb-3 opacity-50" />
                                    <p className="font-bold">太棒了！</p>
                                    <p className="opacity-80">未发现明显的毒点或逻辑漏洞。</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {results.map((issue, idx) => (
                                        <IssueCard key={idx} issue={issue} index={idx} onJumpToChapter={onJumpToChapter} />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-[var(--border)] bg-[var(--app-bg)] flex justify-end gap-3 shrink-0">
                            <button onClick={onCloseAll} className="px-6 py-2 rounded-lg text-sm font-bold bg-[var(--accent)] text-white shadow hover:bg-[var(--accent)]/90 transition-all">
                                完成
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

// ------------------------------------------------------------------
// 主组件：毒点检查弹窗
// ------------------------------------------------------------------
const AiToxicCheckModal = ({
    isOpen,
    onClose,
    targetNodeId = null,
    getStorageKey,
    onSelectChapter, // [新增] 外部传入的章节选中回调
    onFetchContext,  // [新增] 复用EditorPage的章节遍历逻辑
    charFields = []  // [新增] 角色字段配置，复用智能功能逻辑
}) => {
    // [激进重构] 从 entityStore 直接获取实体数据
    const { data: novelData, characters, relations } = useEntityStore();
    const { currentNovelId, handleUpdateNode } = useNovel();
    // [修复] 从 EditorStore 获取 activeNodeId setter
    const setActiveNodeId = useEditorStore(state => state.setActiveNodeId);

    // Config States - [修复] 从 settingsStore 获取配置
    const storeAiConfig = useSettingsStore(state => state.aiConfig);
    const storeToxicAiConfig = useSettingsStore(state => state.toxicAiConfig);
    const storeChapterNumStyle = useSettingsStore(state => state.chapterNumStyle);
    const storeChapterNumberingMode = useSettingsStore(state => state.chapterNumberingMode);
    const baseConfig = storeAiConfig || DEFAULT_AI_CONFIG;
    const toxicConfig = storeToxicAiConfig || DEFAULT_TOXIC_AI_CONFIG;
    // [修复] 从 EditorStore 获取已计算的章节索引表
    const nodeIndexMap = useEditorStore(state => state.nodeIndexMap) || {};

    // [新增] 选中的章节 ID (支持弹窗内选择)
    const [selectedNodeId, setSelectedNodeId] = useState(targetNodeId);
    const [isChecking, setIsChecking] = useState(false);
    const [results, setResults] = useState(null);
    const [error, setError] = useState('');
    const [chapterSearchTerm, setChapterSearchTerm] = useState(''); // [新增] 章节搜索
    const [expandedVolumes, setExpandedVolumes] = useState({}); // [新增] 卷展开状态
    const [isResultOpen, setIsResultOpen] = useState(false); // [新增] 独立结果弹窗
    const [hasLastResult, setHasLastResult] = useState(false); // [新增] 是否有上次结果
    const chapterNumStyle = storeChapterNumStyle || 'chinese'; // [修复] 从 store 读取章节编号样式

    // 检查选项状态
    const [checkScope, setCheckScope] = useState('full'); // current, full
    const [checkTypes, setCheckTypes] = useState({
        logic: true,      // 逻辑漏洞
        character: true,  // 人设崩塌
        pacing: true,     // 节奏问题
        expectation: true,// 期待感/爽点
        system: false     // 战力/设定 (默认关)
    });

    // [新增] 加载保存的配置和结果状态
    useEffect(() => {
        if (isOpen) {
            setResults(null);
            setError('');
            setIsChecking(false);
            setSelectedNodeId(targetNodeId);

            // 1. 加载偏好配置
            const savedConfig = localStorage.getItem(getStorageKey('toxic_ai_config_local'));
            if (savedConfig) {
                try {
                    const parsed = JSON.parse(savedConfig);
                    if (parsed.scope) setCheckScope(parsed.scope);
                    if (parsed.types) setCheckTypes(prev => ({ ...prev, ...parsed.types }));
                } catch (e) { console.warn('Load toxic config failed', e); }
            }

            // 2. 检查是否有暂存结果
            const lastResult = localStorage.getItem(getStorageKey('toxic_ai_last_result'));
            setHasLastResult(!!lastResult);
        }
    }, [isOpen, targetNodeId, getStorageKey]);

    // [新增] 保存配置
    const saveConfig = () => {
        const config = { scope: checkScope, types: checkTypes };
        localStorage.setItem(getStorageKey('toxic_ai_config_local'), JSON.stringify(config));
    };

    // [新增] 恢复上次结果
    const restoreLastResult = () => {
        const lastResult = localStorage.getItem(getStorageKey('toxic_ai_last_result'));
        if (lastResult) {
            try {
                const parsed = JSON.parse(lastResult);
                setResults(parsed);
                setIsResultOpen(true);
            } catch (e) {
                console.error('Restore result failed', e);
                setHasLastResult(false);
            }
        }
    };

    // 切换选项
    const toggleType = (key) => {
        setCheckTypes(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // [新增] 跳转到问题章节（支持多种章节格式）
    const handleJumpToChapter = (chapterText) => {
        if (!chapterText || !novelData) return;

        // 1. 尝试从文本中提取章节编号
        const chapterNum = extractChapterNumber(chapterText);

        // 2. 收集所有章节（扁平化）+ 记录路径
        const allChapters = [];
        const collectChapters = (nodes, parentPath = []) => {
            for (const node of nodes) {
                const currentPath = [...parentPath, { id: node.id, title: node.title }];
                if (node.type === 'chapter') {
                    allChapters.push({ node, path: currentPath });
                }
                if (node.children) {
                    collectChapters(node.children, currentPath);
                }
            }
        };
        collectChapters(novelData);

        // 3. 根据章节编号或标题匹配
        let targetInfo = null;

        if (chapterNum !== null && chapterNum > 0) {
            // 按章节序号查找（1-indexed）
            if (chapterNum <= allChapters.length) {
                targetInfo = allChapters[chapterNum - 1];
            }
        }

        // 4. 回退：按标题模糊匹配
        if (!targetInfo) {
            targetInfo = allChapters.find(item =>
                item.node.title && (
                    item.node.title.includes(chapterText) ||
                    chapterText.includes(item.node.title) ||
                    item.node.title.toLowerCase() === chapterText.toLowerCase()
                )
            );
        }

        if (targetInfo) {
            const { node: targetChapter, path } = targetInfo;

            // [修复] 优先使用外部回调（如果提供）
            if (onSelectChapter) {
                setIsResultOpen(false);
                onClose();
                // [修复] isLeaf=false 以便展开章节节点
                onSelectChapter(targetChapter.id, false, path);
                return;
            }

            // 回退: 内部处理（展开路径中所有父节点）
            // [重构] 使用 uiStore 方法
            if (path && path.length > 0) {
                const { setNodesExpanded } = useUIStore.getState();
                const idsToExpand = path.map(nodeInfo => nodeInfo.id);
                setNodesExpanded(idsToExpand, true);
            }
            setActiveNodeId(targetChapter.id);
            setIsResultOpen(false);
            setTimeout(() => {
                onClose();
            }, 50);
        }
    };

    // 使用 chapterParser.js 中的 extractChapterNumber

    // 核心：执行检查
    const handleCheck = async () => {
        // [修复] 检查配置是否完整
        if (!baseConfig.apiKey) {
            setError("请先在设置中配置 AI API Key");
            return;
        }

        if (!selectedNodeId && checkScope === 'current') {
            setError("请选择要检查的章节");
            return;
        }

        // [新增] 开始检查前保存配置
        saveConfig();

        setIsChecking(true);
        setError('');
        setResults(null);

        // 模型回退逻辑 (Standard Pattern)
        let targetModel = toxicConfig.model;
        const availableModels = baseConfig.models || [];
        const isModelValid = availableModels.some(m => m.id === targetModel);
        if (!isModelValid && availableModels.length > 0) {
            targetModel = availableModels[0].id;
        }
        if (!targetModel) targetModel = 'gpt-3.5-turbo'; // Last resort

        try {
            const promptData = await preparePromptData();
            // [修复] 使用配置中的 Prompt 模板
            const messages = constructPrompt(promptData, toxicConfig.promptTemplate || DEFAULT_TOXIC_AI_CONFIG.promptTemplate);

            // [修复] 使用本地配置，添加 Token
            const token = localStorage.getItem('novel_token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const result = await apiClient.post('/api/ai/generate', {
                apiKey: baseConfig.apiKey,
                baseUrl: baseConfig.baseUrl,
                model: targetModel,
                timeout: baseConfig.timeout || 60,
                messages
            });

            if (result && result.data) {
                // 使用统一的 AI 响应清洗函数
                const rawText = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
                const cleaned = cleanAiIssuesResponse(rawText);

                let issuesArray = [];
                if (cleaned.success && Array.isArray(cleaned.data)) {
                    issuesArray = cleaned.data;
                } else {
                    // 回退：尝试直接解析
                    const rawIssues = typeof result.data === 'string'
                        ? JSON.parse(result.data)
                        : result.data;
                    issuesArray = Array.isArray(rawIssues) ? rawIssues : (rawIssues.issues || []);
                }

                // [新增] 字段标准化 - 容错处理不同 AI 返回格式
                const normalizedResults = issuesArray.map(issue => ({
                    // 章节标题容错：支持多种字段名
                    chapterTitle: issue.chapterTitle || issue.chapter_title || issue.chapter || issue['章节'] || issue['章节标题'] || null,
                    // 类型
                    type: issue.type || issue['类型'] || issue.category || '未分类',
                    // 严重程度标准化
                    severity: normalizeSeverity(issue.severity || issue['严重程度'] || issue.level || 'medium'),
                    // 描述
                    description: issue.description || issue['描述'] || issue.desc || issue.problem || '',
                    // 建议
                    suggestion: issue.suggestion || issue['建议'] || issue.fix || issue.advice || '',
                    // 原有字段保持兼容
                    location: issue.location || issue['位置'] || null
                }));

                setResults(normalizedResults);
                setIsResultOpen(true); // [新增] 打开独立结果弹窗
                setHasLastResult(true); // [新增] 标记有结果

                // [新增] 暂存结果
                localStorage.setItem(getStorageKey('toxic_ai_last_result'), JSON.stringify(normalizedResults));

            } else {
                throw new Error("AI 返回数据格式异常");
            }
        } catch (e) {
            console.error("Toxic check failed:", e);
            // [优化] 错误提示
            let errMsg = e.message || '未知错误';
            if (errMsg.includes('timeout') || errMsg.includes('Timeout') || errMsg.includes('deadline exceeded')) {
                errMsg = '⏱️ AI 请求超时，请检查：\n1. 网络连接是否正常\n2. AI 服务是否正在运行\n3. 设置中的超时时间是否足够';
            } else if (errMsg.includes('fetch') || errMsg.includes('network')) {
                errMsg = '🌐 网络连接失败，请检查网络或 AI 服务地址是否正确';
            } else if (errMsg.includes('BUSY') || errMsg.includes('正在处理另一个请求') || errMsg.includes('Provider returned error')) {
                errMsg = '⚠️ AI 服务繁忙，正在处理其他请求，请稍后再试 (Code: BUSY)';
            }
            setError(errMsg);
        } finally {
            setIsChecking(false);
        }
    };

    // [新增] 严重程度标准化
    const normalizeSeverity = (val) => {
        if (!val) return 'medium';
        const lower = val.toString().toLowerCase();
        if (['high', '高', '严重', 'critical', 'error'].some(k => lower.includes(k))) return 'high';
        if (['low', '低', '轻微', 'minor', 'info'].some(k => lower.includes(k))) return 'low';
        return 'medium';
    };

    // 辅助：准备 Prompt 数据
    const preparePromptData = async () => {
        // [真实实现]从本地 state 提取数据
        let title = "未命名章节";
        let summary = "";
        let chapterChars = [];

        // 1. 查找目标节点 (当前章节)
        const findNode = (nodes, id) => {
            for (const node of nodes) {
                if (node.id === id) return node;
                if (node.children) {
                    const found = findNode(node.children, id);
                    if (found) return found;
                }
            }
            return null;
        };

        const targetNode = selectedNodeId ? findNode(novelData || [], selectedNodeId) : null;

        if (checkScope === 'full') {
            title = "全书大纲 (自动汇总)";

            // [复用] 使用 EditorPage 传入的 onFetchContext 获取全书内容
            if (onFetchContext) {
                summary = onFetchContext('full'); // 'full' 模式获取全书
            }

            if (!summary) summary = "(大纲尚为空)";

            // 全书检查时，提取所有主要角色的完整信息
            // [复用] 与 MobileSmartTooltip 保持一致的逻辑
            chapterChars = characters.slice(0, 10).map(c => { // 限制前10个主要角色
                let info = c.name || "未命名角色";
                const parts = [];

                // 1. 使用 charFields 配置读取 extra_fields
                const extraFields = c.extra_fields;
                if (extraFields && charFields.length > 0) {
                    const parsed = typeof extraFields === 'string' ? JSON.parse(extraFields) : extraFields;
                    charFields.forEach(field => {
                        const val = parsed?.[field.label];
                        if (val && String(val).trim().length > 0) {
                            parts.push(`[${field.label}: ${val}]`);
                        }
                    });
                }

                // 2. 如果没有 charFields 匹配，回退到 desc
                if (parts.length === 0) {
                    const desc = c.desc || "";
                    if (desc) {
                        parts.push(desc);
                    }
                }

                if (parts.length > 0) {
                    info += `: ${parts.join(' ')}`;
                }

                return info;
            });

        } else if (targetNode) {
            title = targetNode.title || "未命名";
            summary = targetNode.content || "(暂无内容)";

            // 2. 提取角色信息 (基于 relations 或 文本匹配)
            // 2.1 优先使用关系表
            const relatedIds = relations
                .filter(r => r.source_id === selectedNodeId || r.target_id === selectedNodeId)
                .map(r => r.source_id === selectedNodeId ? r.target_id : r.source_id);

            // 2.2 其次文本匹配 (简单版)
            const matchedChars = characters.filter(c =>
                (c.name && summary.includes(c.name)) || relatedIds.includes(c.id)
            );

            chapterChars = matchedChars.map(c => {
                let info = c.name || "未命名角色";
                const parts = [];

                // 1. 使用 charFields 配置读取 extra_fields
                const extraFields = c.extra_fields;
                if (extraFields && charFields.length > 0) {
                    try {
                        const parsed = typeof extraFields === 'string' ? JSON.parse(extraFields) : extraFields;
                        charFields.forEach(field => {
                            const val = parsed?.[field.label];
                            if (val && String(val).trim().length > 0) {
                                parts.push(`[${field.label}: ${val}]`);
                            }
                        });
                    } catch (e) { }
                }

                // 2. 如果没有 charFields 匹配，回退到 desc/content
                if (parts.length === 0) {
                    const desc = c.desc || c.description || c.content || "";
                    if (desc) {
                        parts.push(desc);
                    }
                }

                if (parts.length > 0) {
                    info += `: ${parts.join(' ')}`;
                }

                return info;
            });
        }

        return {
            title,
            summary,
            characters: chapterChars.length > 0 ? chapterChars : ["(未检测到主要角色, 请仅基于剧情逻辑分析)"],
            scope: checkScope,
            types: Object.keys(checkTypes).filter(k => checkTypes[k])
        };
    };

    // 辅助：构造 Prompt 消息
    const constructPrompt = (data, template) => {
        // 如果没有模板，使用默认硬编码逻辑 (虽然应该总是有模板)
        if (!template) {
            return [{ role: "user", content: JSON.stringify(data) }];
        }

        // 替换模板变量
        let content = template;
        content = content.replace('{{title}}', data.title || '')
            .replace('{{content}}', data.summary || '')
            .replace('{{characters}}', data.characters.join('\n') || '无主要相关人物');

        // [严格模式] 禁止 Markdown 格式
        content += `\n\n【严格模式】忽略所有聊天礼仪。只输出纯文本内容，禁止使用任何Markdown格式（如、#、-等）。不要对内容进行格式化包装，直接返回原始内容。`;

        return [
            {
                role: "user",
                content: content
            }
        ];
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4">
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
                        className="bg-[var(--panel-bg)] w-full max-w-md max-h-[90vh] rounded-xl shadow-2xl flex flex-col border border-[var(--border)] overflow-hidden relative z-10"
                    >

                        {/* Header - 紧凑 */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                            <div className="flex items-center gap-2 text-[var(--text-main)]">
                                <AlertTriangle size={18} className="text-[var(--accent)]" />
                                <h2 className="text-base font-bold">AI 毒点检查</h2>
                            </div>
                            <button onClick={onClose} className="p-1.5 hover:bg-black/5 rounded-full text-[var(--text-sub)] transition-colors">
                                <X size={18} />
                            </button>
                        </div>


                        {/* Body - 单列紧凑布局 */}
                        <div className="flex-1 overflow-y-auto p-4 hide-scrollbar">

                            {/* 配置区 */}
                            <div className="space-y-4">

                                {/* 检查范围 */}
                                <div className="mb-6">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-sm font-bold text-[var(--text-sub)] flex items-center gap-2">
                                            <Target size={14} /> 检查范围
                                        </h3>
                                        {hasLastResult && (
                                            <button
                                                onClick={restoreLastResult}
                                                className="px-2 py-1 bg-[var(--accent)]/10 text-[var(--accent)] text-xs rounded border border-[var(--accent)]/20 hover:bg-[var(--accent)]/20 transition-colors flex items-center gap-1"
                                                title="查看上次分析结果"
                                            >
                                                <Activity size={12} /> 恢复结果
                                            </button>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${checkScope === 'full' ? 'border-[var(--accent)] bg-[var(--accent)]/5 text-[var(--accent)]' : 'border-[var(--border)] hover:bg-[var(--hover-bg)]'}`}>
                                            <input
                                                type="radio"
                                                name="scope"
                                                checked={checkScope === 'full'}
                                                onChange={() => setCheckScope('full')}
                                                className="w-4 h-4 accent-[var(--accent)]"
                                            />
                                            <span className="font-medium">全书大纲 (默认)</span>
                                        </label>

                                        <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${checkScope === 'current' ? 'border-[var(--accent)] bg-[var(--accent)]/5 text-[var(--accent)]' : 'border-[var(--border)] hover:bg-[var(--hover-bg)]'}`}>
                                            <input
                                                type="radio"
                                                name="scope"
                                                checked={checkScope === 'current'}
                                                onChange={() => setCheckScope('current')}
                                                className="w-4 h-4 accent-[var(--accent)]"
                                            />
                                            <span className="font-medium">指定章节检查</span>
                                        </label>

                                        {/* [优化] 可搜索的章节树形选择器 */}
                                        {checkScope === 'current' && (
                                            <div className="mt-3 border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--app-bg)]">
                                                {/* 搜索框 */}
                                                <div className="p-2 border-b border-[var(--border)] bg-[var(--panel-bg)]">
                                                    <input
                                                        type="text"
                                                        placeholder="🔍 搜索章节标题..."
                                                        className="w-full px-3 py-1.5 text-xs rounded border border-[var(--border)] bg-[var(--panel-bg)] text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
                                                        value={chapterSearchTerm || ''}
                                                        onChange={(e) => setChapterSearchTerm(e.target.value)}
                                                    />
                                                </div>
                                                {/* 章节列表 (按卷分组，可折叠) */}
                                                <div className="max-h-48 overflow-y-auto hide-scrollbar">
                                                    {novelData && (() => {
                                                        const searchLower = (chapterSearchTerm || '').toLowerCase();
                                                        const isSearching = searchLower.length > 0;

                                                        const renderVolume = (volume, volIndex) => {
                                                            // 只渲染 volume 类型的节点
                                                            if (volume.type !== 'volume') return null;

                                                            // 获取该卷下所有章节 (过滤搜索)
                                                            const allChapters = (volume.children || []).filter(ch => ch.type === 'chapter');

                                                            // [修复] 搜索时同时匹配前缀和标题，使用正确的章节索引
                                                            const filteredChapters = allChapters.map((ch, idx) => {
                                                                // 优先从 nodeIndexMap 获取正确的章节编号（支持连续编号模式）
                                                                const indexData = nodeIndexMap[ch.id];
                                                                const chapterIndex = indexData?.chIndex || (idx + 1);
                                                                return { ...ch, chapterIndex, localIndex: idx + 1 };
                                                            }).filter((ch) => {
                                                                if (!searchLower) return true;

                                                                // 使用正确的章节编号
                                                                const chNum = ch.chapterIndex;
                                                                const prefixChinese = `第${toChineseNum(chNum)}章`;
                                                                const prefixArabic = `第${chNum}章`;
                                                                const title = ch.title || '未命名章节';

                                                                // 组合搜索：前缀+标题
                                                                const fullTextChinese = `${prefixChinese} ${title}`.toLowerCase();
                                                                const fullTextArabic = `${prefixArabic} ${title}`.toLowerCase();
                                                                const titleOnly = title.toLowerCase();

                                                                return fullTextChinese.includes(searchLower) ||
                                                                    fullTextArabic.includes(searchLower) ||
                                                                    titleOnly.includes(searchLower);
                                                            });

                                                            // 没有匹配则不显示该卷
                                                            if (filteredChapters.length === 0) return null;

                                                            // 展开逻辑：搜索时自动展开有匹配的卷，否则看手动展开状态
                                                            const isExpanded = isSearching || expandedVolumes[volume.id];

                                                            const toggleVolume = () => {
                                                                setExpandedVolumes(prev => ({
                                                                    ...prev,
                                                                    [volume.id]: !prev[volume.id]
                                                                }));
                                                            };

                                                            return (
                                                                <div key={volume.id} className="mb-0.5">
                                                                    {/* 卷标题 (可点击展开) */}
                                                                    <button
                                                                        onClick={toggleVolume}
                                                                        className="w-full px-3 py-2 text-[11px] font-bold text-[var(--text-sub)] bg-[var(--hover-bg)] sticky top-0 flex items-center gap-1 hover:bg-[var(--border)] transition-colors"
                                                                    >
                                                                        <ChevronRight size={12} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                                                        📁 {volume.title || `第${volIndex + 1}卷`}
                                                                        <span className="text-[var(--text-sub)]/60 ml-1">({allChapters.length}章)</span>
                                                                        {filteredChapters.length !== allChapters.length && (
                                                                            <span className="text-[var(--accent)] ml-auto text-[10px]">匹配 {filteredChapters.length}</span>
                                                                        )}
                                                                    </button>
                                                                    {/* 章节列表 (仅展开时显示) */}
                                                                    {isExpanded && filteredChapters.map((ch, chIdx) => (
                                                                        <button
                                                                            key={ch.id}
                                                                            onClick={() => setSelectedNodeId(ch.id)}
                                                                            className={`w-full text-left px-4 py-1.5 text-xs hover:bg-[var(--hover-bg)] transition-colors flex items-center gap-2 ${selectedNodeId === ch.id ? 'bg-[var(--accent)]/10 text-[var(--accent)] font-bold' : 'text-[var(--text-main)]'}`}
                                                                        >
                                                                            {/* [修复] 使用正确的章节索引（支持连续编号模式） */}
                                                                            {chapterNumStyle !== 'none' && (
                                                                                <span className="text-[var(--text-sub)] text-right mr-1">
                                                                                    {chapterNumStyle === 'chinese' ? `第${toChineseNum(ch.chapterIndex)}章` : `第${ch.chapterIndex}章`}
                                                                                </span>
                                                                            )}
                                                                            <span className="truncate flex-1">{ch.title || '未命名章节'}</span>
                                                                            {selectedNodeId === ch.id && <CheckCircle2 size={14} className="text-[var(--accent)]" />}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            );
                                                        };

                                                        const volumeElements = novelData.map((vol, idx) => renderVolume(vol, idx)).filter(Boolean);

                                                        if (volumeElements.length === 0) {
                                                            return <div className="p-4 text-center text-xs text-[var(--text-sub)]">未找到匹配的章节</div>;
                                                        }
                                                        return volumeElements;
                                                    })()}
                                                </div>
                                                {/* 当前选中显示 */}
                                                {selectedNodeId && (
                                                    <div className="p-2 border-t border-[var(--border)] bg-[var(--panel-bg)] text-xs text-[var(--accent)] flex items-center gap-1">
                                                        <CheckCircle2 size={12} />
                                                        已选: {(() => {
                                                            const findTitle = (nodes) => {
                                                                for (const node of nodes) {
                                                                    if (node.id === selectedNodeId) return node.title;
                                                                    if (node.children) {
                                                                        const found = findTitle(node.children);
                                                                        if (found) return found;
                                                                    }
                                                                }
                                                                return null;
                                                            };
                                                            return findTitle(novelData || []) || '未命名';
                                                        })()}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {!selectedNodeId && checkScope === 'current' && (
                                            <span className="text-xs block text-amber-500 mt-1">⚠ 请选择要检查的章节</span>
                                        )}
                                    </div>
                                </div>

                                {/* 检查维度 */}
                                <div className="mb-6">
                                    <h3 className="text-sm font-bold text-[var(--text-sub)] mb-3 flex items-center gap-2">
                                        <Brain size={14} /> 检查维度
                                    </h3>
                                    <div className="space-y-2">
                                        <CheckItem label="逻辑自洽性" desc="因果关系、深坑" checked={checkTypes.logic} onChange={() => toggleType('logic')} />
                                        <CheckItem label="人设一致性" desc="性格违和、OOC" checked={checkTypes.character} onChange={() => toggleType('character')} />
                                        <CheckItem label="剧情节奏" desc="拖沓、流水账" checked={checkTypes.pacing} onChange={() => toggleType('pacing')} />
                                        <CheckItem label="爽点/期待感" desc="枯燥、缺乏压抑释放" checked={checkTypes.expectation} onChange={() => toggleType('expectation')} />
                                        <CheckItem label="战力/设定" desc="体系崩坏" checked={checkTypes.system} onChange={() => toggleType('system')} />
                                    </div>
                                </div>



                                {error && (
                                    <div className="p-3 bg-red-50 text-red-600 rounded-lg flex items-center gap-2 text-sm border border-red-100">
                                        <AlertCircle size={16} />
                                        <span className="flex-1">{error}</span>
                                    </div>
                                )}

                                {results && (
                                    <div className="p-3 rounded-lg border border-green-200 bg-green-50 text-green-800 text-center">
                                        <CheckCircle2 size={20} className="mx-auto mb-1 opacity-70" />
                                        <p className="font-bold text-sm">检查完成</p>
                                        <p className="text-xs opacity-80">发现 {results.length} 个问题</p>
                                        {results.length > 0 && (
                                            <button onClick={() => setIsResultOpen(true)} className="mt-2 px-4 py-1.5 bg-green-600 text-white rounded text-xs font-bold hover:bg-green-700">
                                                查看详情
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer - 开始按钮 */}
                        <div className="p-3 border-t border-[var(--border)]">
                            <button
                                onClick={handleCheck}
                                disabled={isChecking || (checkScope === 'current' && !selectedNodeId)}
                                className="w-full py-2.5 bg-[var(--accent)] text-white rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-[var(--accent)]/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            >
                                {isChecking ? (
                                    <><Loader2 size={16} className="animate-spin" /> 检查中...</>
                                ) : (
                                    <><Search size={16} /> 开始检查</>
                                )}
                            </button>
                        </div>
                    </motion.div>

                    {/* 独立结果弹窗 */}
                    <ToxicResultModal
                        isOpen={isResultOpen}
                        onClose={() => setIsResultOpen(false)}
                        results={results}
                        onJumpToChapter={handleJumpToChapter}
                        onCloseAll={() => { setIsResultOpen(false); onClose(); }}
                    />
                </div>
            )}
        </AnimatePresence>
    );
};

// ------------------------------------------------------------------
// 辅助小组件
// ------------------------------------------------------------------
const CheckItem = ({ label, desc, checked, onChange }) => (
    <label className="flex items-start gap-3 p-2 rounded hover:bg-[var(--hover-bg)] cursor-pointer select-none transition-colors">
        <div className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${checked ? 'bg-[var(--accent)] border-[var(--accent)] text-white' : 'border-[var(--text-sub)]/30 bg-transparent'}`}>
            {checked && <CheckCircle2 size={12} />}
            <input type="checkbox" className="hidden" checked={checked} onChange={onChange} />
        </div>
        <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-[var(--text-main)] leading-none mb-1">{label}</div>
            <div className="text-xs text-[var(--text-sub)] leading-tight">{desc}</div>
        </div>
    </label>
);

AiToxicCheckModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    targetNodeId: PropTypes.string,
    aiConfig: PropTypes.object
};

export default AiToxicCheckModal;
