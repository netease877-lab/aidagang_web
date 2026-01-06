// ==================================================
// File: frontend/src/constants.js
// ==================================================
export const DATA_VERSION = 'v8.0_scene_manager';
export const STORAGE_PREFIX = 'novel_studio_';

export const DEFAULT_CHAPTER_TEMPLATES = [
  { title: '本章细纲', placeholder: '时间：\n地点：\n人物：\n起因-经过-结果：' },
  { title: '剧情高潮', placeholder: '本章最冲突激烈的片段...' },
  { title: '关键伏笔', placeholder: '此处埋下的线索，将在第X章回收...' }
];

export const DEFAULT_CHAR_FIELDS = [
  { label: '外貌描写', placeholder: '五官、身材、衣着特点...', showInCard: true },
  { label: '性格特征', placeholder: '核心性格、行事风格、口头禅...', showInCard: true },
  { label: '背景故事', placeholder: '身世、过往经历、动机...', showInCard: false }
];

// 角色分类 - [修复] 改为工厂函数，每次生成唯一 ID，添加 version
export const INITIAL_CHAR_CATS = () => [
  { id: generateId(), name: '核心主角', color: '#22c55e', isExpanded: true, version: 1, isNew: true },
  { id: generateId(), name: '重要配角', color: '#3b82f6', isExpanded: true, version: 1, isNew: true }
];

// 场景分类 - [修复] 改为工厂函数
export const INITIAL_SCENE_CATS = () => [
  { id: generateId(), name: '主要地图', color: '#0ea5e9', isExpanded: true, version: 1, isNew: true },
  { id: generateId(), name: '副本/特殊', color: '#f59e0b', isExpanded: true, version: 1, isNew: true }
];

// 设定分类 - [修复] 改为工厂函数
export const INITIAL_SETTING_CATS = () => [
  { id: generateId(), name: '世界背景', color: '#a855f7', isExpanded: true, version: 1, isNew: true },
  { id: generateId(), name: '力量体系', color: '#ef4444', isExpanded: true, version: 1, isNew: true }
];

// --- AI 配置 ---
export const DEFAULT_AI_CONFIG = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  timeout: 60,
  // 新增：默认模型列表
  models: [
    { name: 'GPT-3.5 Turbo', id: 'gpt-3.5-turbo' },
    { name: 'GPT-4', id: 'gpt-4' },
    { name: 'GPT-4o', id: 'gpt-4o' }
  ]
};

export const DEFAULT_OUTLINE_AI_CONFIG = {
  model: 'gpt-3.5-turbo',
  promptTemplate: `你是一位金牌网文策划。作者需要你对【全书/卷级大纲】提供 {{count}} 个创意方案。

【输入信息】
1. **核心脑洞**：{{outline}}
2. **核心爽点**：{{goal}}
3. **预期结局**：{{outcome}}
4. **避雷禁忌**：{{avoid}}

【要求】
请生成 {{count}} 个差异化的剧情走向方案。
返回 JSON 格式：
{
    "ideas": [
        { "type": "方案类型", "content": "详细的剧情推演..." },
        ...
    ]
}`
};

export const DEFAULT_CHAPTER_AI_CONFIG = {
  model: 'gpt-3.5-turbo',
  promptTemplate: `你是一位网文细纲助手。请基于上下文为第 {{chapter_num}} 章生成 {{count}} 个具体的【场景细纲】。

【全局信息】
世界观：{{global_context}}
本卷目标：{{volume_context}}

【上下文】
上章剧情：{{prev_context}}

【本章构思】
灵感/粗纲：{{inspiration}}
目的(爽点)：{{goal}}
结局要求：{{outcome}}
避雷：{{taboos}}
基调风格：{{style}}

【登场人物】
{{characters}}

【发生场景】
{{scenes}}

【输出要求】
必须返回 JSON 格式，严格包含 ideas 数组。
content 字段内使用 "1-地点-人物-事件" 的格式分行描述场景。
{
    "ideas": [
        { "type": "方案类型", "content": "1-...\n2-...\n..." },
        ...
    ]
}`
};

export const DEFAULT_TOXIC_AI_CONFIG = {
  model: '', // [修复] 默认为空，以便自动使用全局首个可用模型
  promptTemplate: `你是一位专业的网文编辑。请逐章检查以下大纲内容，找出每一章中可能存在的**毒点**或**违和**之处。

检查维度：
1. 逻辑自洽性 (是否有前后矛盾、深坑未填)
2. 人设一致性 (角色是否OOC、行为是否符合逻辑)
3. 剧情节奏 (是否拖沓、注水)
4. 爽点/期待感 (是否压抑太久、缺乏释放)
5. 战力/设定 (是否战力崩坏)

【输入内容】
标题：{{title}}
大纲/正文片段：
{{content}}

【相关人物】
{{characters}}

【重要要求】
1. 你必须精确标注每个问题所在的**具体章节标题**，不能只说"整体问题"。
2. 请按问题严重程度排序（高 > 中 > 低）。
3. 如果没有发现问题，返回空数组 []。

返回严格的 JSON 格式：
{
    "issues": [
        {
            "chapterTitle": "问题所在的章节标题 (必填，如'第52章 决战前夕')",
            "type": "问题类型 (逻辑/人设/节奏/爽点/设定)",
            "severity": "high/medium/low",
            "description": "详细问题描述",
            "suggestion": "具体修改建议"
        }
    ]
}`
};

export const DEFAULT_CHAT_AI_CONFIG = {
  model: '', // 空字符串表示跟随全局默认
};

export const DEFAULT_WEBDAV_CONFIG = {
  enabled: false,
  url: '',
  username: '',
  password: '',
  autoBackupInterval: 120  // 自动备份间隔（秒），默认2分钟
};

export const ZEN_CARD_STYLES = {
  glass: { name: '磨砂玻璃 (默认)', container: 'bg-[var(--panel-bg)]/95 backdrop-blur-xl border-[var(--border)] rounded-xl shadow-2xl', card: 'bg-[var(--app-bg)]/60 border-l-4 rounded-lg shadow-sm' },
  bookmark: { name: '书签样式', container: 'bg-[var(--app-bg)] border border-[var(--border)] rounded-lg shadow-xl', card: 'bg-[var(--panel-bg)] border-t-4 border-x border-b border-[var(--border)] rounded-b-md shadow-sm mb-3 mx-1' },
  bamboo: { name: '竹叶样式', container: 'bg-[var(--panel-bg)] border border-emerald-100/30 rounded-lg shadow-lg', card: 'bg-[var(--panel-bg)] border-l-2 border-dashed border-emerald-400 hover:bg-emerald-500/10 pl-4 py-2 mb-2 transition-colors' },
  rounded: { name: '大圆角', container: 'bg-[var(--panel-bg)]/95 backdrop-blur p-4 rounded-[28px] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] border border-[var(--border)]', card: 'bg-[var(--app-bg)] rounded-2xl border-r-4 shadow-none mb-3 p-3 hover:bg-[var(--hover-bg)] transition-colors' },
  bubble: { name: '悬浮气泡', container: 'bg-transparent border-none shadow-none', card: 'bg-[var(--panel-bg)] rounded-xl border border-[var(--border)] shadow-[0_4px_12px_-2px_rgba(0,0,0,0.08)] mb-3 hover:-translate-y-0.5 transition-transform duration-200' }
};

// [核心修复]：确保导出 DEFAULT_STYLES，防止前端组件引用 undefined 导致崩溃
export const DEFAULT_STYLES = [
  { icon: '🎲', label: '随机' },
  { icon: '🔥', label: '冲突/打脸' },
  { icon: '🧩', label: '铺垫/解谜' },
  { icon: '💬', label: '日常/感情' },
  { icon: '⚔️', label: '战斗/副本' },
  { icon: '😱', label: '悬疑/惊悚' },
  { icon: '😂', label: '搞笑/轻松' },
  { icon: '😭', label: '虐心/悲剧' }
];

// --- Mock Data 虚拟数据 [核心修改：清空] ---
export const MOCK_CHARACTERS = [];

export const MOCK_SCENES = [];

export const MOCK_SETTINGS = [];

export const DEMO_DATA_TEMPLATE = [];

export const CLEAN_DATA_TEMPLATE = (novelId) => [
  {
    // [修复] 使用与后端一致的 ID 生成策略，防止默认卷重复
    id: (novelId && novelId.length >= 8) ? `root-${novelId.substring(0, 8)}` : generateId(),
    title: '开始写作吧',
    content: '',
    isExpanded: true,
    isContentExpanded: true,
    type: 'volume',
    children: [],
    version: 1,
    isNew: true
  }
];

export const DEMO_CHARACTERS = MOCK_CHARACTERS;
export const DEMO_SCENES = MOCK_SCENES;
export const DEMO_SETTINGS = MOCK_SETTINGS;

export const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Polyfill: 手动生成 UUID v4 格式
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const toChineseNum = (num) => {
  const chnNumChar = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  const chnUnitSection = ["", "万", "亿", "万亿", "亿亿"];
  const chnUnitChar = ["", "十", "百", "千"];

  const sectionToChinese = (section) => {
    let strIns = '', chnStr = '';
    let unitPos = 0;
    let zero = true;
    while (section > 0) {
      let v = section % 10;
      if (v === 0) {
        if (!zero) {
          zero = true;
          chnStr = chnNumChar[v] + chnStr;
        }
      } else {
        zero = false;
        strIns = chnNumChar[v];
        strIns += chnUnitChar[unitPos];
        chnStr = strIns + chnStr;
      }
      unitPos++;
      section = Math.floor(section / 10);
    }
    return chnStr;
  }

  let unitPos = 0;
  let strIns = '', chnStr = '';
  let needZero = false;

  if (num === 0) return chnNumChar[0];

  while (num > 0) {
    let section = num % 10000;
    if (needZero) {
      chnStr = chnNumChar[0] + chnStr;
    }
    strIns = sectionToChinese(section);
    strIns += (section !== 0) ? chnUnitSection[unitPos] : chnUnitSection[0];
    chnStr = strIns + chnStr;
    needZero = (section < 1000) && (section > 0);
    num = Math.floor(num / 10000);
    unitPos++;
  }
  if (chnStr.startsWith('一十')) chnStr = chnStr.substring(1);
  return chnStr;
}

export const THEMES = {
  default: {
    id: 'default',
    name: '默认简约',
    type: 'light',
    colors: {
      '--app-bg': '#f3f4f6',
      '--panel-bg': '#ffffff',
      '--text-main': '#1f2937',
      '--text-sub': '#6b7280',
      '--border': '#e5e7eb',
      '--accent': '#3b82f6',
      '--accent-bg': '#eff6ff',
      '--hover-bg': '#f9fafb',
      '--shadow': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)'
    }
  },
  dark: {
    id: 'dark',
    name: '深色护眼',
    type: 'dark',
    colors: {
      '--app-bg': '#0f172a',
      '--panel-bg': '#1e293b',
      '--text-main': '#f1f5f9',
      '--text-sub': '#94a3b8',
      '--border': '#334155',
      '--accent': '#60a5fa',
      '--accent-bg': '#1e3a8a',
      '--hover-bg': '#334155',
      '--shadow': '0 4px 6px -1px rgb(0 0 0 / 0.5)'
    }
  },
  parchment: {
    id: 'parchment',
    name: '复古羊皮',
    type: 'light',
    colors: {
      '--app-bg': '#efe6d5',
      '--panel-bg': '#fdf6e3',
      '--text-main': '#433422',
      '--text-sub': '#8b7e66',
      '--border': '#d4c5b0',
      '--accent': '#d97706',
      '--accent-bg': '#fef3c7',
      '--hover-bg': '#eaddcf',
      '--shadow': '0 4px 6px -1px rgba(67, 52, 34, 0.1)'
    }
  },
  letter: {
    id: 'letter',
    name: '雅致书信',
    type: 'light',
    colors: {
      '--app-bg': '#f3f4f6',
      '--panel-bg': '#fafaf9',
      '--text-main': '#292524',
      '--text-sub': '#78716c',
      '--border': '#e7e5e4',
      '--accent': '#be123c',
      '--accent-bg': '#ffe4e6',
      '--hover-bg': '#f5f5f4',
      '--shadow': '0 10px 15px -3px rgba(0, 0, 0, 0.05)'
    }
  },
  magic: {
    id: 'magic',
    name: '秘法典籍',
    type: 'dark',
    colors: {
      '--app-bg': '#2e1065',
      '--panel-bg': '#170b2e',
      '--text-main': '#e9d5ff',
      '--text-sub': '#a78bfa',
      '--border': '#5b21b6',
      '--accent': '#fcd34d',
      '--accent-bg': '#4c1d95',
      '--hover-bg': '#3b0764',
      '--shadow': '0 0 15px rgba(139, 92, 246, 0.3)'
    }
  },
  tech: {
    id: 'tech',
    name: '赛博科技',
    type: 'dark',
    colors: {
      '--app-bg': '#020617',
      '--panel-bg': '#0f172a',
      '--text-main': '#0ea5e9',
      '--text-sub': '#0369a1',
      '--border': '#1e293b',
      '--accent': '#22d3ee',
      '--accent-bg': '#0c4a6e',
      '--hover-bg': '#1e293b',
      '--shadow': '0 0 10px rgba(14, 165, 233, 0.2)'
    }
  }
};