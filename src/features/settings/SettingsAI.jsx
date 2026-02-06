import React, { useState, useEffect } from 'react';
import {
  Brain, Clock, Box, PenSquare, Trash2, Key, Server, Zap, X, Save, Plus,
  Book, ChevronDown, RotateCcw, Lightbulb, Sliders, Smile, MessageCircle
} from 'lucide-react';
import { DEFAULT_AI_CONFIG, DEFAULT_OUTLINE_AI_CONFIG, DEFAULT_CHAPTER_AI_CONFIG, DEFAULT_TOXIC_AI_CONFIG, DEFAULT_CHAT_AI_CONFIG, DEFAULT_STYLES } from '../../constants.js';
import { getWebDAVProxyUrl } from '../../hooks/useWebDAV';
import ResizableTextarea from '../../components/common/ResizableTextarea';

// 兼容性别名
const getSafeProxyUrl = getWebDAVProxyUrl;

// 预设的图标列表
const EMOJI_PRESETS = [
  "✨", "🌟", "🔥", "💧", "⚡", "❄️", "⚔️", "🛡️",
  "🏹", "🔫", "💣", "💀", "☠️", "❤️", "💔", "💍",
  "💋", "🤝", "🗣️", "💭", "🎭", "🕵️", "🧩", "🔒",
  "🔓", "👣", "🕯️", "🗝️", "🏰", "🏚️", "🌲", "🌊",
  "⛰️", "🌌", "🌍", "📦", "💎", "💰", "⚖️", "🔮",
  "🐉", "👻", "👽", "🤖", "🧠", "👀", "✍️", "📜"
];

// 子菜单项组件 (复用)
// 子菜单项组件 (复用) - [修改] 支持折叠
const SettingSection = ({ title, children, isExpanded, onToggle, id }) => (
  <div className="mb-4 bg-[var(--panel-bg)] rounded-lg border border-[var(--border)] overflow-hidden animate-in fade-in slide-in-from-left-2 duration-300">
    <div
      className="flex items-center justify-between p-3 cursor-pointer hover:bg-[var(--hover-bg)] transition-colors"
      onClick={() => onToggle && onToggle(id)}
    >
      <h4 className="font-bold text-sm text-[var(--text-main)] flex items-center gap-2">
        {title}
      </h4>
      <ChevronDown size={16} className={`text-[var(--text-sub)] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
    </div>

    {isExpanded && (
      <div className="p-3 border-t border-[var(--border)] animate-in slide-in-from-top-2 duration-200">
        <div className="space-y-4">{children}</div>
      </div>
    )}
  </div>
);

export default function SettingsAI({
  activeTab,
  permissions = {},
  getStorageKey,
  addToast = () => { },
  setConfirmDialog,

  // [新增] 受控 Props
  aiConfig, setAiConfig,
  outlineAiConfig, setOutlineAiConfig,
  chapterAiConfig, setChapterAiConfig,
  toxicAiConfig, setToxicAiConfig,
  chatAiConfig, setChatAiConfig, // [新增]
  customStyles, setCustomStyles
}) {
  // [移除] 内部 State，改为使用 Props (aiConfig, outlineAiConfig, chapterAiConfig, customStyles)

  const [aiTestStatus, setAiTestStatus] = useState('idle'); // idle, testing, success, error

  // 新增：模型管理状态
  const [newModelName, setNewModelName] = useState('');
  const [newModelId, setNewModelId] = useState('');
  const [newModelKey, setNewModelKey] = useState(''); // 独立API Key
  const [newModelUrl, setNewModelUrl] = useState(''); // 新增：独立API URL
  const [isEditingModel, setIsEditingModel] = useState(false); // 是否处于编辑模式
  const [newStyleIcon, setNewStyleIcon] = useState('✨');
  const [newStyleLabel, setNewStyleLabel] = useState('');

  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false); // 控制图标选择器显示

  // [新增] 折叠状态管理
  const [expandedSections, setExpandedSections] = useState({
    outline: false,
    chapter: false,
    toxic: false,
    chat: false // [新增]
  });


  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // [移除] useEffect 加载逻辑 (由 useEditorState 接管)

  // --- 使用函数式更新 + 受控组件 (不再直接写 Storage) ---
  const updateAiConfig = (key, value) => {
    setAiConfig(prev => {
      const newConfig = { ...prev, [key]: value };
      // [移除] localStorage.setItem (useEditorState 会处理)
      return newConfig;
    });
    if (key === 'baseUrl' || key === 'apiKey') setAiTestStatus('idle');
  };

  const updateOutlineAiConfig = (key, value) => {
    setOutlineAiConfig(prev => ({ ...prev, [key]: value }));
  };

  const updateChapterAiConfig = (key, value) => {
    setChapterAiConfig(prev => ({ ...prev, [key]: value }));
  };

  const updateToxicAiConfig = (key, value) => { // [新增]
    setToxicAiConfig(prev => ({ ...prev, [key]: value }));
  };

  const updateChatAiConfig = (key, value) => { // [新增]
    setChatAiConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleAddOrUpdateModel = () => {
    if (!newModelName.trim() || !newModelId.trim()) return;
    const currentModels = aiConfig.models || [];

    // 如果是编辑模式，或者ID已存在，则替换
    const filteredModels = currentModels.filter(m => m.id !== newModelId);
    // 保存时带上 apiKey 和 baseUrl (如果有值)
    const newModels = [...filteredModels, {
      name: newModelName,
      id: newModelId,
      apiKey: newModelKey.trim(),
      baseUrl: newModelUrl.trim() // 保存独立 URL
    }];

    updateAiConfig('models', newModels);
    setNewModelName('');
    setNewModelId('');
    setNewModelKey('');
    setNewModelUrl(''); // 重置
    setIsEditingModel(false);
    addToast('模型保存成功', 'success');
  };

  const handleEditModel = (model) => {
    // Toggle logic
    if (isEditingModel && newModelId === model.id) {
      handleCancelEdit();
    } else {
      setNewModelName(model.name);
      setNewModelId(model.id);
      setNewModelKey(model.apiKey || ''); // 回显 Key
      setNewModelUrl(model.baseUrl || ''); // 回显 URL
      setIsEditingModel(true);
    }
  };

  const handleCancelEdit = () => {
    setNewModelName('');
    setNewModelId('');
    setNewModelKey('');
    setNewModelUrl('');
    setIsEditingModel(false);
  };

  const handleDeleteModel = (id) => {
    setConfirmDialog({
      visible: true,
      message: '确定删除此模型？',
      onConfirm: () => {
        const newModels = (aiConfig.models || []).filter(m => m.id !== id);
        updateAiConfig('models', newModels);
        if (newModelId === id) {
          handleCancelEdit();
        }
        addToast('模型已删除', 'success');
      }
    });
  };



  // [核心]: 风格管理逻辑 (受控)
  const handleAddStyle = () => {
    if (!newStyleLabel.trim()) return;
    const newStyles = [...customStyles, { icon: newStyleIcon, label: newStyleLabel.trim() }];
    setCustomStyles(newStyles);
    setNewStyleLabel('');
    addToast('风格已添加', 'success');
  };

  const handleDeleteStyle = (idx) => {
    const newStyles = customStyles.filter((_, i) => i !== idx);
    setCustomStyles(newStyles);
  };

  const handleRestoreDefaultStyles = () => {
    if (confirm('确定要恢复默认风格吗？自定义的风格将被清除。')) {
      setCustomStyles(DEFAULT_STYLES || []);
      addToast('已恢复默认风格', 'success');
    }
  };

  const testAiConnection = async () => {
    const effectiveKey = newModelKey.trim() || aiConfig.apiKey;
    const effectiveUrl = newModelUrl.trim() || aiConfig.baseUrl;

    if (!effectiveKey) { addToast('请输入 API Key (全局默认或模型独立)', 'warning'); return; }
    if (!effectiveUrl) { addToast('请输入 API 地址 (全局默认或模型独立)', 'warning'); return; }

    let testModel = newModelId.trim();
    if (!testModel && aiConfig.models && aiConfig.models.length > 0) {
      testModel = aiConfig.models[0].id;
    }
    if (!testModel) testModel = 'gpt-3.5-turbo';

    setAiTestStatus('testing');

    let baseUrl = effectiveUrl.replace(/\/+$/, '');
    let testUrl = baseUrl;

    if (!baseUrl.endsWith('/chat/completions')) {
      testUrl = `${baseUrl}/chat/completions`;
    }

    // [修复] 使用专用的 AI 代理，避免与 WebDAV 代理混淆
    // const proxyUrl = getSafeProxyUrl(testUrl); // 旧逻辑
    const safeBtoa = (str) => btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => String.fromCharCode('0x' + p1)));
    const proxyUrl = `/api/ai_proxy/${safeBtoa(testUrl)}`;

    try {
      // [修复] 需要同时发送用户 Token 和 AI API Key
      const token = localStorage.getItem('novel_token');
      const headers = {
        'Content-Type': 'application/json',
        'X-AI-Authorization': `Bearer ${effectiveKey}` // AI Key 通过专用头传递
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`; // 用户认证 Token
      }

      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          model: testModel,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 1
        })
      });

      if (response.ok) {
        setAiTestStatus('success');
      } else {
        const errText = await response.text();
        console.error('AI Test Error:', errText);
        setAiTestStatus('error');
        alert(`连接失败 (HTTP ${response.status}): ${errText.slice(0, 100)}`);
      }
    } catch (error) {
      console.error('AI Network Error:', error);
      setAiTestStatus('error');
      setAiTestStatus('error');
      addToast('连接失败，可能是网络问题或需要配置跨域代理。', 'error');
    }
  };

  // 根据 activeTab 渲染不同内容
  if (activeTab === 'ai_management') {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
        {/* 基础配置 (默认展开，或者也可以做成折叠) */}
        <SettingSection
          title={<><Brain size={16} /> 基础 AI 连接与模型</>}
          isExpanded={true} // 基础配置保持展开，方便查看
        // onToggle={() => {}} 
        >
          <div className="space-y-4"> {/* Removed inner bg/border/padding as SettingSection now handles it */}
            {/* 全局默认配置 */}
            <div>
              <div className="text-[10px] font-bold text-[var(--text-sub)] uppercase tracking-wider mb-2">默认配置 (Defaults)</div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-[var(--text-sub)] block mb-1">默认 API 地址 (Base URL)</label>
                  <input className="w-full text-xs p-2 rounded border border-[var(--border)] bg-[var(--app-bg)] text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
                    placeholder="https://api.openai.com/v1"
                    value={aiConfig?.baseUrl || ''}
                    onChange={(e) => updateAiConfig('baseUrl', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-sub)] block mb-1">默认 API Key</label>
                  <input type="password" className="w-full text-xs p-2 rounded border border-[var(--border)] bg-[var(--app-bg)] text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
                    placeholder="sk-..."
                    value={aiConfig?.apiKey || ''}
                    onChange={(e) => updateAiConfig('apiKey', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-sub)] block mb-1 flex items-center gap-1"><Clock size={12} /> 全局超时时间 (秒)</label>
                  <input type="number" className="w-full text-xs p-2 rounded border border-[var(--border)] bg-[var(--app-bg)] text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
                    value={aiConfig?.timeout || 60}
                    onChange={(e) => updateAiConfig('timeout', parseInt(e.target.value))}
                  />
                </div>
              </div>
            </div>

            <div className="h-px bg-[var(--border)] my-2"></div>

            {/* 模型管理区域 */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs text-[var(--text-sub)] font-bold flex items-center gap-1"><Box size={12} /> 模型管理列表</label>
              </div>

              {/* 现有模型列表 */}
              <div className="space-y-2 mb-3 max-h-40 overflow-y-auto custom-scrollbar bg-[var(--app-bg)]/50 p-2 rounded border border-[var(--border)]">
                {aiConfig?.models && aiConfig.models.map((m, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs bg-[var(--panel-bg)] p-2 rounded border border-[var(--border)]">
                    <div className="flex flex-col min-w-0 flex-1 mr-2">
                      <span className="font-bold text-[var(--text-main)] truncate">{m.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[var(--text-sub)] text-[10px] font-mono opacity-80 truncate">{m.id}</span>
                        {/* 显示是否有独立 Key */}
                        {m.apiKey && (
                          <span className="flex items-center gap-0.5 text-[10px] text-green-600 bg-green-50 px-1 rounded border border-green-100 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400 shrink-0" title="该模型使用了独立 API Key">
                            <Key size={8} /> 独立Key
                          </span>
                        )}
                        {/* 显示是否有独立 URL */}
                        {m.baseUrl && (
                          <span className="flex items-center gap-0.5 text-[10px] text-blue-600 bg-blue-50 px-1 rounded border border-blue-100 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400 shrink-0" title="该模型使用了独立 Base URL">
                            <Server size={8} /> 独立地址
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => handleEditModel(m)} className="p-1 hover:text-[var(--accent)] text-[var(--text-sub)] transition-colors"><PenSquare size={12} /></button>
                      <button onClick={() => handleDeleteModel(m.id)} className="p-1 hover:text-red-500 text-[var(--text-sub)] transition-colors"><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))}
                {(!aiConfig?.models || aiConfig.models.length === 0) && <div className="text-center text-[10px] text-[var(--text-sub)] py-2">暂无模型，请添加</div>}
              </div>

              {/* 添加/测试区域 */}
              <div className="bg-[var(--app-bg)] p-2 rounded border border-[var(--border)]">
                <div className="flex flex-col gap-2 mb-2">
                  <input className="w-full text-xs p-2 rounded border border-[var(--border)] bg-[var(--panel-bg)] text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
                    placeholder="显示名称 (如: GPT-4)"
                    value={newModelName}
                    onChange={(e) => setNewModelName(e.target.value)}
                  />
                  <input className="w-full text-xs p-2 rounded border border-[var(--border)] bg-[var(--panel-bg)] text-[var(--text-main)] outline-none focus:border-[var(--accent)] font-mono"
                    placeholder="模型 ID (如: gpt-4-1106-preview)"
                    value={newModelId}
                    onChange={(e) => setNewModelId(e.target.value)}
                  />
                  {/* 独立 URL 输入框 */}
                  <div className="relative">
                    <input className="w-full text-xs p-2 pl-7 rounded border border-[var(--border)] bg-[var(--panel-bg)] text-[var(--text-main)] outline-none focus:border-[var(--accent)] placeholder:text-[var(--text-sub)]/50"
                      placeholder="独立 API 地址 (Base URL) - 选填，留空则使用全局默认"
                      value={newModelUrl}
                      onChange={(e) => setNewModelUrl(e.target.value)}
                    />
                    <Server size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-sub)]" />
                  </div>
                  {/* 独立 Key 输入框 */}
                  <div className="relative">
                    <input type="password" className="w-full text-xs p-2 pl-7 rounded border border-[var(--border)] bg-[var(--panel-bg)] text-[var(--text-main)] outline-none focus:border-[var(--accent)] font-mono placeholder:text-[var(--text-sub)]/50"
                      placeholder="独立 API Key - 选填，留空则使用全局默认"
                      value={newModelKey}
                      onChange={(e) => setNewModelKey(e.target.value)}
                    />
                    <Key size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-sub)]" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex gap-1">
                    {isEditingModel && (
                      <button onClick={handleCancelEdit} className="px-2 py-1.5 rounded text-xs font-bold bg-red-50 text-red-500 hover:bg-red-100 transition-all border border-red-200">
                        <X size={12} />
                      </button>
                    )}
                    <button onClick={handleAddOrUpdateModel} disabled={!newModelName || !newModelId} className={`flex-1 py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1 transition-all ${newModelName && newModelId ? 'bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90' : 'bg-[var(--border)] text-[var(--text-sub)] cursor-not-allowed'}`}>
                      {isEditingModel ? <><Save size={12} /> 更新</> : <><Plus size={12} /> 添加</>}
                    </button>
                  </div>
                  <button
                    onClick={testAiConnection}
                    disabled={(!aiConfig?.apiKey && !newModelKey) || aiTestStatus === 'testing'}
                    className={`py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1 transition-all border
                                    ${aiTestStatus === 'success' ? 'bg-green-50 border-green-200 text-green-600' :
                        aiTestStatus === 'error' ? 'bg-red-50 border-red-200 text-red-600' :
                          'bg-[var(--panel-bg)] border-[var(--border)] text-[var(--text-main)] hover:border-[var(--accent)]'}
                                `}
                  >
                    {aiTestStatus === 'testing' ? <Zap className="animate-spin" size={12} /> : <Zap size={12} />}
                    {aiTestStatus === 'testing' ? '测试中...' : '测试连接 (优先当前配置)'}
                  </button>
                </div>
              </div>
            </div>
          </div> {/* End of inner div */}
        </SettingSection>
      </div>
    );
  }

  if (activeTab === 'ai_config') {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">

        {/* [1] 大纲灵感配置 */}
        {permissions.ai_outline && (
          <SettingSection
            title={<><Book size={16} /> 大纲灵感配置</>}
            id="outline"
            isExpanded={expandedSections.outline}
            onToggle={toggleSection}
          >
            <div className="space-y-4">
              <div>
                <label className="text-xs text-[var(--text-sub)] block mb-1">大纲生成模型 (Model)</label>
                <div className="relative">
                  <select
                    className="w-full text-xs p-2 pr-8 rounded border border-[var(--border)] bg-[var(--app-bg)] text-[var(--text-main)] outline-none focus:border-[var(--accent)] appearance-none cursor-pointer"
                    value={outlineAiConfig?.model || ''}
                    onChange={(e) => updateOutlineAiConfig('model', e.target.value)}
                  >
                    {aiConfig?.models && aiConfig.models.map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.id})</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-sub)] pointer-events-none" />
                </div>
              </div>
              {permissions.ai_prompt && (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs text-[var(--text-sub)] block">大纲提示词模版 (Prompt)</label>
                    <button
                      onClick={() => {
                        if (confirm('恢复默认?')) updateOutlineAiConfig('promptTemplate', DEFAULT_OUTLINE_AI_CONFIG.promptTemplate);
                      }}
                      className="text-[10px] flex items-center gap-1 text-[var(--accent)] hover:underline opacity-80 hover:opacity-100 transition-opacity"
                    >
                      <RotateCcw size={10} /> 恢复默认
                    </button>
                  </div>
                  <div className="text-[10px] text-[var(--text-sub)] opacity-70 mb-2">
                    变量: {'{{outline}}, {{goal}}, {{outcome}}, {{avoid}}, {{count}}'}
                  </div>
                  <ResizableTextarea
                    className="text-xs p-2 rounded border border-[var(--border)] bg-[var(--app-bg)] text-[var(--text-main)] outline-none focus:border-[var(--accent)] font-mono leading-relaxed custom-scrollbar"
                    value={outlineAiConfig?.promptTemplate || ''}
                    onChange={(e) => updateOutlineAiConfig('promptTemplate', e.target.value)}
                    storageKey={getStorageKey('setting_outline_h')}
                    minHeight={160}
                  />
                </div>
              )}
            </div>
          </SettingSection>
        )}

        {/* [2] 细纲灵感配置 */}
        {permissions.ai_chapter && (
          <SettingSection
            title={<><Lightbulb size={16} /> 细纲灵感配置</>}
            id="chapter"
            isExpanded={expandedSections.chapter}
            onToggle={toggleSection}
          >
            <div className="space-y-4">
              <div>
                <label className="text-xs text-[var(--text-sub)] block mb-1">细纲生成模型 (Model)</label>
                <div className="relative">
                  <select
                    className="w-full text-xs p-2 pr-8 rounded border border-[var(--border)] bg-[var(--app-bg)] text-[var(--text-main)] outline-none focus:border-[var(--accent)] appearance-none cursor-pointer"
                    value={chapterAiConfig?.model || ''}
                    onChange={(e) => updateChapterAiConfig('model', e.target.value)}
                  >
                    {aiConfig?.models && aiConfig.models.map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.id})</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-sub)] pointer-events-none" />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs text-[var(--text-sub)] font-bold flex items-center gap-1"><Sliders size={12} /> 风格基调管理</label>
                  <button onClick={handleRestoreDefaultStyles} className="text-[10px] text-[var(--accent)] hover:underline opacity-80 hover:opacity-100 transition-opacity flex items-center gap-1">
                    <RotateCcw size={10} /> 恢复默认
                  </button>
                </div>
                <div className="bg-[var(--app-bg)]/50 p-2 rounded border border-[var(--border)] max-h-40 overflow-y-auto custom-scrollbar mb-2">
                  {(customStyles || []).map((style, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1 border-b border-[var(--border)] last:border-0 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-4 text-center text-sm">{style.icon}</span>
                        <span className="text-[var(--text-main)]">{style.label}</span>
                      </div>
                      <button onClick={() => handleDeleteStyle(idx)} className="text-[var(--text-sub)] hover:text-red-500 p-1"><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2 relative">
                    <div className="relative">
                      <button
                        onClick={() => setIsIconPickerOpen(!isIconPickerOpen)}
                        className="w-12 h-8 flex items-center justify-center text-lg border border-[var(--border)] bg-[var(--app-bg)] rounded hover:bg-[var(--hover-bg)] transition-colors"
                        title="选择图标"
                      >
                        {newStyleIcon || <Smile size={16} className="text-[var(--text-sub)]" />}
                      </button>

                      {isIconPickerOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setIsIconPickerOpen(false)}></div>
                          <div className="absolute top-full left-0 mt-2 z-50 bg-[var(--panel-bg)] border border-[var(--border)] shadow-xl rounded-lg p-2 w-64 grid grid-cols-6 gap-2 animate-in fade-in zoom-in-95 duration-200">
                            {EMOJI_PRESETS.map(emoji => (
                              <button
                                key={emoji}
                                onClick={() => { setNewStyleIcon(emoji); setIsIconPickerOpen(false); }}
                                className="w-8 h-8 flex items-center justify-center rounded hover:bg-[var(--hover-bg)] text-lg transition-colors"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>

                    <input className="flex-1 text-xs p-1.5 rounded border border-[var(--border)] bg-[var(--app-bg)] text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
                      placeholder="风格名称 (如: 悬疑/惊悚)"
                      value={newStyleLabel}
                      onChange={e => setNewStyleLabel(e.target.value)}
                    />
                  </div>
                  <button onClick={handleAddStyle} disabled={!newStyleLabel.trim()} className={`w-full py-1.5 rounded text-xs font-bold transition-all flex items-center justify-center gap-1 ${newStyleLabel.trim() ? 'bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90' : 'bg-[var(--border)] text-[var(--text-sub)] cursor-not-allowed'}`}>
                    <Plus size={14} /> 添加风格
                  </button>
                </div>
              </div>

              {permissions.ai_prompt && (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs text-[var(--text-sub)] block">细纲提示词模版 (Prompt)</label>
                    <button
                      onClick={() => {
                        if (confirm('恢复默认?')) updateChapterAiConfig('promptTemplate', DEFAULT_CHAPTER_AI_CONFIG.promptTemplate);
                      }}
                      className="text-[10px] flex items-center gap-1 text-[var(--accent)] hover:underline opacity-80 hover:opacity-100 transition-opacity"
                    >
                      <RotateCcw size={10} /> 恢复默认
                    </button>
                  </div>
                  <div className="text-[10px] text-[var(--text-sub)] opacity-70 mb-2">
                    变量: {'{{prev_context}}, {{inspiration}}, {{characters}}, {{scenes}}, {{style}}, {{start}}, {{outcome}} ...'}
                  </div>
                  <ResizableTextarea
                    className="text-xs p-2 rounded border border-[var(--border)] bg-[var(--app-bg)] text-[var(--text-main)] outline-none focus:border-[var(--accent)] font-mono leading-relaxed custom-scrollbar"
                    value={chapterAiConfig?.promptTemplate || ''}
                    onChange={(e) => updateChapterAiConfig('promptTemplate', e.target.value)}
                    storageKey={getStorageKey('setting_chapter_h')}
                    minHeight={240}
                  />
                </div>
              )}
            </div>
          </SettingSection>
        )}

        {/* [3] 毒点检查配置 (新增) */}
        {permissions.ai_toxic && (
          <SettingSection
            title={<><div className="flex items-center gap-2">⚠️ 毒点检查配置</div></>}
            id="toxic"
            isExpanded={expandedSections.toxic}
            onToggle={toggleSection}
          >
            <div className="space-y-4">
              <div>
                <label className="text-xs text-[var(--text-sub)] block mb-1">检查模型 (Model)</label>
                <div className="relative">
                  <select
                    className="w-full text-xs p-2 pr-8 rounded border border-[var(--border)] bg-[var(--app-bg)] text-[var(--text-main)] outline-none focus:border-[var(--accent)] appearance-none cursor-pointer"
                    value={toxicAiConfig?.model || ''}
                    onChange={(e) => updateToxicAiConfig('model', e.target.value)}
                  >
                    {aiConfig?.models && aiConfig.models.map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.id})</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-sub)] pointer-events-none" />
                </div>
              </div>
              {permissions.ai_prompt && (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs text-[var(--text-sub)] block">检查提示词模版 (Prompt)</label>
                    <button
                      onClick={() => {
                        if (confirm('恢复默认?')) {
                          updateToxicAiConfig('promptTemplate', DEFAULT_TOXIC_AI_CONFIG.promptTemplate);
                          addToast('已恢复默认提示词', 'success');
                        }
                      }}
                      className="text-[10px] flex items-center gap-1 text-[var(--accent)] hover:underline opacity-80 hover:opacity-100 transition-opacity"
                    >
                      <RotateCcw size={10} /> 恢复默认
                    </button>
                  </div>
                  <div className="text-[10px] text-[var(--text-sub)] opacity-70 mb-2">
                    变量: {'{{title}}, {{content}}, {{characters}}'}
                  </div>
                  <ResizableTextarea
                    className="text-xs p-2 rounded border border-[var(--border)] bg-[var(--app-bg)] text-[var(--text-main)] outline-none focus:border-[var(--accent)] font-mono leading-relaxed custom-scrollbar"
                    value={toxicAiConfig?.promptTemplate || ''}
                    onChange={(e) => updateToxicAiConfig('promptTemplate', e.target.value)}
                    storageKey={getStorageKey('setting_toxic_h')}
                    minHeight={160}
                  />
                </div>
              )}
            </div>
          </SettingSection>
        )}

        {/* [4] 对话配置 (新增) */}
        {permissions.ai_chat && (
          <SettingSection
            title={<><div className="flex items-center gap-2"><MessageCircle size={16} /> 对话配置 (Chat)</div></>}
            id="chat"
            isExpanded={expandedSections.chat}
            onToggle={toggleSection}
          >
            <div className="space-y-4">
              <div>
                <label className="text-xs text-[var(--text-sub)] block mb-1">对话生成模型 (Model)</label>
                <div className="relative">
                  <select
                    className="w-full text-xs p-2 pr-8 rounded border border-[var(--border)] bg-[var(--app-bg)] text-[var(--text-main)] outline-none focus:border-[var(--accent)] appearance-none cursor-pointer"
                    value={chatAiConfig?.model || ''}
                    onChange={(e) => updateChatAiConfig('model', e.target.value)}
                  >
                    {aiConfig?.models && aiConfig.models.map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.id})</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-sub)] pointer-events-none" />
                </div>
              </div>
            </div>
          </SettingSection>
        )}

      </div>
    );
  }

  return null;
}
