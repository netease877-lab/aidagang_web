// ==================================================
// File: frontend/src/config/relationConfig.js
// 角色关系预设配置
// ==================================================

// 关系类型定义（用于连线颜色和样式）
export const RELATION_TYPES = {
    family: { color: '#F59E0B', label: '亲属' },
    love: { color: '#EC4899', label: '情感' },
    friend: { color: '#10B981', label: '友谊' },
    hostile: { color: '#6366F1', label: '敌对' },
    mentor: { color: '#F97316', label: '师徒' },
    util: { color: '#6B7280', label: '利用' },
    custom: { color: '#9CA3AF', label: '其他' },
};

// 预设关系标签（用于快速选择）
export const PRESET_RELATIONS = [
    // 亲属
    { label: '父亲', type: 'family', distance: 1 },
    { label: '母亲', type: 'family', distance: 1 },
    { label: '子女', type: 'family', distance: 1 },
    { label: '兄弟', type: 'family', distance: 1 },
    { label: '姐妹', type: 'family', distance: 1 },
    { label: '配偶', type: 'family', distance: 1 },
    // 情感
    { label: '恋人', type: 'love', distance: 1 },
    { label: '暧昧', type: 'love', distance: 2 },
    { label: '爱慕', type: 'love', distance: 2 },
    { label: '前任', type: 'love', distance: 3 },
    // 友谊
    { label: '挚友', type: 'friend', distance: 1 },
    { label: '朋友', type: 'friend', distance: 2 },
    { label: '伙伴', type: 'friend', distance: 1 },
    { label: '同盟', type: 'friend', distance: 2 },
    // 敌对
    { label: '仇敌', type: 'hostile', distance: 1 },
    { label: '宿敌', type: 'hostile', distance: 1 },
    { label: '对手', type: 'hostile', distance: 2 },
    { label: '觊觎', type: 'hostile', distance: 2 },
    // 师徒
    { label: '师父', type: 'mentor', distance: 1 },
    { label: '徒弟', type: 'mentor', distance: 1 },
    { label: '恩师', type: 'mentor', distance: 1 },
    // 利用
    { label: '上级', type: 'util', distance: 2 },
    { label: '下属', type: 'util', distance: 2 },
    { label: '利用', type: 'util', distance: 2 },
    { label: '主仆', type: 'util', distance: 1 },
];

// 反向关系映射表（A对B的关系 -> B对A的关系）
export const INVERSE_RELATIONS = {
    // 亲属
    '父亲': '子女',
    '母亲': '子女',
    '子女': '父母',
    // 师徒
    '师父': '徒弟',
    '徒弟': '师父',
    '恩师': '弟子',
    '弟子': '恩师',
    // 上下级
    '上级': '下属',
    '下属': '上级',
    '主仆': '仆从',
    '仆从': '主人',
    // 对称关系
    '恋人': '恋人',
    '挚友': '挚友',
    '朋友': '朋友',
    '伙伴': '伙伴',
    '同盟': '同盟',
    '仇敌': '仇敌',
    '宿敌': '宿敌',
    '对手': '对手',
    '兄弟': '兄弟',
    '姐妹': '姐妹',
    '配偶': '配偶',
    '前任': '前任',
    // 非对称
    '暧昧': '暧昧',
    '爱慕': '被爱慕',
    '被爱慕': '爱慕',
    '觊觎': '被觊觎',
    '被觊觎': '觊觎',
    '利用': '被利用',
    '被利用': '利用',
};

// 获取反向关系标签
export const getInverseLabel = (label) => {
    return INVERSE_RELATIONS[label] || label;
};

// 获取关系类型颜色
export const getRelationColor = (type) => {
    return RELATION_TYPES[type]?.color || RELATION_TYPES.custom.color;
};

// 根据标签获取关系类型
export const getRelationTypeByLabel = (label) => {
    const preset = PRESET_RELATIONS.find(r => r.label === label);
    return preset?.type || 'custom';
};

// 根据标签获取默认距离
export const getRelationDistanceByLabel = (label) => {
    const preset = PRESET_RELATIONS.find(r => r.label === label);
    return preset?.distance || 2;
};

// 获取默认的关系分类数据结构
export const getDefaultRelTypes = () => {
    return Object.entries(RELATION_TYPES).map(([type, config]) => ({
        type,
        label: config.label,
        color: config.color,
        items: PRESET_RELATIONS.filter(r => r.type === type),
        isDefault: true
    }));
};
