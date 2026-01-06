// ==================================================
// File: frontend/src/utils/novelUtils.js
// 小说大纲节点操作工具函数
// ==================================================
import { generateId, DEFAULT_CHAPTER_TEMPLATES } from '../constants';

/**
 * 更新节点
 * @param {Array} nodes - 节点树
 * @param {string} id - 目标节点 ID
 * @param {Object} updates - 更新内容
 *   - _isUiState: {boolean} 如果为 true，表示仅更新 UI 状态（如 isExpanded），不标记为脏数据
 * @returns {Array} 更新后的节点树
 */
export const updateNode = (nodes, id, updates) => {
    return nodes.map(node => {
        if (node.id === id) {
            // [安全修复] 不再前端自增版本号，避免与后端版本冲突导致 409 伪冲突
            // UI 状态（isExpanded/isContentExpanded）不标记为脏数据
            const { _isUiState, ...realUpdates } = updates;

            // [重构] 使用 _localUpdatedAt 标记本地变更时间，供 Diff 算法判断
            // version 字段保持不变，由后端同步响应时更新
            const updatedNode = {
                ...node,
                ...realUpdates,
                isNew: false,
            };

            // 非 UI 状态更新时，标记本地更新时间
            if (!_isUiState) {
                updatedNode._localUpdatedAt = Date.now();
            }

            return updatedNode;
        }
        if (node.children) {
            return { ...node, children: updateNode(node.children, id, updates) };
        }
        return node;
    });
};

/**
 * 删除节点
 * @param {Array} nodes - 节点树
 * @param {string} id - 目标节点 ID
 * @returns {Array} 删除后的节点树
 */
export const deleteNode = (nodes, id) => {
    return nodes
        .filter(n => n.id !== id)
        .map(n => {
            if (n.children) {
                return { ...n, children: deleteNode(n.children, id) };
            }
            return n;
        });
};

/**
 * [新增] 获取节点完整路径信息（带层级编号）
 * @param {Array} nodes - 节点树
 * @param {string} id - 目标节点 ID
 * @param {string} parentVolumeNum - 父卷编号（如"第2卷"）
 * @param {string} parentChapterNum - 父章节编号（如"第1章"）
 * @returns {Object|null} { node, path: "第2卷 第1章 下的 节点名", type, label }
 */
export const getNodeInfo = (nodes, id, parentVolumeNum = null, parentChapterNum = null) => {
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const type = node.type || 'node';

        // 构建当前节点的显示名
        let displayName;
        if (type === 'volume') {
            // 卷：显示"第x卷 卷名"
            displayName = `第${i + 1}卷 ${node.title || '未命名'}`;
        } else if (type === 'chapter') {
            // 章节：显示"第x卷 第y章 章名"
            const volumePrefix = parentVolumeNum ? `${parentVolumeNum} ` : '';
            displayName = `${volumePrefix}第${i + 1}章 ${node.title || '未命名'}`;
        } else {
            // 子节点：显示"第x卷 第y章 下的 节点名"
            const volumePrefix = parentVolumeNum ? `${parentVolumeNum} ` : '';
            const chapterPrefix = parentChapterNum ? `${parentChapterNum} 下的 ` : '';
            displayName = `${volumePrefix}${chapterPrefix}${node.title || '未命名'}`;
        }

        if (node.id === id) {
            const label = type === 'volume' ? '卷' : type === 'chapter' ? '章节' : '节点';
            return { node, path: displayName, type, label, index: i };
        }
        if (node.children) {
            // 递归时传递卷编号和章节编号
            const volumeNum = type === 'volume' ? `第${i + 1}卷` : parentVolumeNum;
            const chapterNum = type === 'chapter' ? `第${i + 1}章` : parentChapterNum;
            const result = getNodeInfo(node.children, id, volumeNum, chapterNum);
            if (result) return result;
        }
    }
    return null;
};

/**
 * 创建模板子节点
 * @param {Array} chapterTemplates - 章节模板
 * @returns {Array} 模板子节点
 */
export const createTemplateChildren = (chapterTemplates) => {
    return chapterTemplates.map(t => ({
        id: generateId(),
        title: t.title,
        content: '',
        placeholder: t.placeholder,
        isLocked: true,
        children: [],
        isContentExpanded: true,
        type: 'node'
    }));
};

/**
 * 添加兄弟节点
 * @param {Array} nodes - 节点树
 * @param {string} targetId - 目标节点 ID
 * @param {number} level - 层级
 * @param {Array} chapterTemplates - 章节模板
 * @returns {Array} 添加后的节点树
 */
export const addSibling = (nodes, targetId, level, chapterTemplates = []) => {
    const templates = (chapterTemplates?.length > 0) ? chapterTemplates : DEFAULT_CHAPTER_TEMPLATES;
    const rootIndex = nodes.findIndex(n => n.id === targetId);

    if (rootIndex !== -1) {
        const newNodes = [...nodes];
        const newNode = {
            id: generateId(),
            title: '',
            content: '',
            isExpanded: true,
            isContentExpanded: true,
            isNew: true,
            version: 1, // [修复] 初始版本号
            type: 'volume',
            children: []
        };
        newNodes.splice(rootIndex + 1, 0, newNode);
        return newNodes;
    }

    return nodes.map(node => {
        if (node.children) {
            const childIndex = node.children.findIndex(c => c.id === targetId);
            if (childIndex !== -1) {
                const newChildren = [...node.children];
                const isChapterLevel = level === 1;
                const newNode = {
                    id: generateId(),
                    title: '',
                    content: '',
                    isExpanded: true,
                    isContentExpanded: true,
                    isNew: true,
                    version: 1, // [修复] 初始版本号
                    type: isChapterLevel ? 'chapter' : 'node',
                    children: isChapterLevel ? createTemplateChildren(templates) : []
                };
                newChildren.splice(childIndex + 1, 0, newNode);
                return { ...node, children: newChildren };
            }
            return { ...node, children: addSibling(node.children, targetId, level, chapterTemplates) };
        }
        return node;
    });
};

/**
 * 添加子节点
 * @param {Array} nodes - 节点树
 * @param {string} parentId - 父节点 ID
 * @param {Array} chapterTemplates - 章节模板
 * @returns {Array} 添加后的节点树
 */
export const addChild = (nodes, parentId, chapterTemplates = []) => {
    const templates = (chapterTemplates?.length > 0) ? chapterTemplates : DEFAULT_CHAPTER_TEMPLATES;
    return nodes.map(node => {
        if (node.id === parentId) {
            const isParentVolume = node.type === 'volume';
            const newType = isParentVolume ? 'chapter' : 'node';
            const newChildren = isParentVolume ? createTemplateChildren(templates) : [];
            return {
                ...node,
                isExpanded: true,
                children: [
                    ...node.children,
                    {
                        id: generateId(),
                        title: '',
                        content: '',
                        isExpanded: true,
                        isContentExpanded: true,
                        children: newChildren,
                        isNew: true,
                        version: 1, // [修复] 初始版本号
                        type: newType
                    }
                ]
            };
        }
        if (node.children) {
            return { ...node, children: addChild(node.children, parentId, chapterTemplates) };
        }
        return node;
    });
};

/**
 * 检查节点是否包含目标
 * @param {Object} node - 节点
 * @param {string} targetId - 目标 ID
 * @returns {boolean}
 */
const containsTarget = (node, targetId) => {
    if (!targetId) return false;
    if (node.id === targetId) return true;
    if (node.children) {
        return node.children.some(child => containsTarget(child, targetId));
    }
    return false;
};

/**
 * 节点展开/折叠逻辑
 * [优化] 清理旧注释，简化逻辑说明
 * 
 * 规则：
 * 1. 容器节点(volume/chapter) → 切换 isExpanded 状态
 * 2. 内容节点(node) → 切换 isContentExpanded 状态
 * 3. 无手风琴效果，不影响其他节点
 * 
 * @param {Array} nodes - 节点树
 * @param {string} targetId - 被点击的节点 ID
 * @returns {Array} 处理后的节点树
 */
export const toggleNodeExpand = (nodes, targetId) => {
    return nodes.map(node => {
        const isTarget = node.id === targetId;

        let newIsExpanded = node.isExpanded;
        let newIsContentExpanded = node.isContentExpanded;

        if (isTarget) {
            if (node.type === 'volume' || node.type === 'chapter') {
                newIsExpanded = !node.isExpanded;
            } else {
                newIsContentExpanded = !node.isContentExpanded;
            }
        }

        return {
            ...node,
            isExpanded: newIsExpanded,
            isContentExpanded: newIsContentExpanded,
            children: node.children ? toggleNodeExpand(node.children, targetId) : []
        };
    });
};

// [兼容] 保留旧名称作为别名，避免破坏现有引用
export const toggleAccordion = toggleNodeExpand;

/**
 * 折叠所有节点
 * @param {Array} nodes - 节点树
 * @returns {Array} 折叠后的节点树
 */
export const collapseAllNodes = (nodes) => {
    return nodes.map(node => ({
        ...node,
        isExpanded: false,
        isContentExpanded: false,
        children: node.children ? collapseAllNodes(node.children) : []
    }));
};

/**
 * 重置脑图状态
 * @param {Array} nodes - 节点树
 * @returns {Array} 重置后的节点树
 */
export const resetMindMapState = (nodes) => {
    return nodes.map(node => ({
        ...node,
        isExpanded: node.type === 'volume' ? node.isExpanded : false,
        children: node.children ? resetMindMapState(node.children) : []
    }));
};

/**
 * 提取章节内容列表
 * @param {Array} nodes - 节点树
 * @param {Array} result - 结果数组
 * @returns {Array} 章节内容列表
 */
/**
 * 提取章节内容列表
 * @param {Array} nodes - 节点树
 * @param {Array} result - 结果数组
 * @returns {Array} 章节内容列表
 */
export const extractChapters = (nodes, result = []) => {
    nodes.forEach(node => {
        // [修复] 提取所有有内容的节点类型 (chapter, node, volume)
        // 这样细纲、卷首语等子项内容也会被保存到 Chapter 表中
        if (node.type === 'chapter' || node.type === 'node' || node.type === 'volume') {
            result.push({ id: node.id, content: node.content || '' });
        }
        if (node.children) {
            extractChapters(node.children, result);
        }
    });
    return result;
};

/**
 * 移除章节内容的大纲结构
 * @param {Array} nodes - 节点树
 * @returns {Array} 剥离内容后的节点树
 */
export const stripChapterContent = (nodes) => {
    return nodes.map(node => {
        const stripped = { ...node };
        // [修复] 同样移除这些类型的 content，减小 JSON 体积
        if (stripped.type === 'chapter' || stripped.type === 'node' || stripped.type === 'volume') {
            delete stripped.content;
        }
        if (stripped.children) {
            stripped.children = stripChapterContent(stripped.children);
        }
        return stripped;
    });
};

/**
 * [高效] 合并列表数据 (保留本地新建)
 * 策略：服务器数据 + 本地新增的(服务器没有的)
 * 以解决 refresh 时覆盖本地新建项的问题
 */
export const mergeList = (localList, serverList) => {
    if (!serverList) return localList || [];
    if (!localList) return serverList;

    const serverIds = new Set(serverList.map(i => i.id));
    // 找出本地有但服务器没有的（即新建未同步的）
    const localNewItems = localList.filter(item => !serverIds.has(item.id));

    // 返回：服务器数据 + 本地新增
    return [...serverList, ...localNewItems];
};

/**
 * [新增] 将树形大纲扁平化为节点数组
 * 用于同步时只发送变化的节点（基于版本号比较）
 * @param {Array} nodes - 树形节点
 * @param {string|null} parentId - 父节点ID
 * @param {number} sortStart - 排序起始值
 * @returns {Array} 扁平化的节点数组 [{id, type, title, summary, version, parent_id, sort_order}]
 */
export const flattenNodes = (nodes, parentId = null, sortStart = 0) => {
    const result = [];
    if (!nodes || !Array.isArray(nodes)) return result;

    nodes.forEach((node, index) => {
        // 构建扁平节点
        // [修复] summary 使用 node.content（前端细纲内容存储在 content 字段）
        result.push({
            id: node.id,
            type: node.type,           // volume/chapter/node
            title: node.title || '',
            summary: node.content || '', // [修复] 细纲内容对应后端 summary 字段
            content: node.content || '', // 章节内容（向后兼容）
            version: node.version || 1,
            parent_id: parentId,
            sort_order: sortStart + index
        });

        // 递归处理子节点
        if (node.children && node.children.length > 0) {
            result.push(...flattenNodes(node.children, node.id, 0));
        }
    });

    return result;
};

/**
 * [新增] 比较两个扁平列表，找出变化的项（新增/修改/删除）
 * @param {Array} oldList - 旧列表
 * @param {Array} newList - 新列表
 * @returns {Object} { changed: [], deleted: [] }
 */
export const diffByVersion = (oldList, newList) => {
    const oldMap = new Map((oldList || []).map(item => [item.id, item]));
    const newMap = new Map((newList || []).map(item => [item.id, item]));

    const changed = [];
    const deleted = [];

    // 找出新增/修改的项
    // [修复] 增加内容对比，检测本地修改（版本号由后端控制，前端不自增）
    for (const item of newList || []) {
        const oldItem = oldMap.get(item.id);
        // 条件1：Snapshot 中不存在 → 新增的项
        // 条件2：版本号比 Snapshot 中的更高 → 服务器更新的项
        // 条件3：内容不一致（序列化对比）→ 本地修改的项
        if (!oldItem) {
            changed.push(item);
            continue;
        }

        // [关键修复] 排除元数据干扰（版本号、时间戳），只比较业务内容
        // 使用解构剔除无关字段，避免因服务器更新元数据而触发本地保存
        // [修复] 增加 isExpanded 和 isContentExpanded（UI 状态），避免折叠操作触发同步
        const { version: v1, updated_at: u1, created_at: c1, isExpanded: e1, isContentExpanded: ice1, ...cleanNew } = item;
        const { version: v2, updated_at: u2, created_at: c2, isExpanded: e2, isContentExpanded: ice2, ...cleanOld } = oldItem;

        if (JSON.stringify(cleanNew) !== JSON.stringify(cleanOld)) {
            changed.push(item);
        }
    }

    // 找出删除的项
    for (const id of oldMap.keys()) {
        if (!newMap.has(id)) {
            deleted.push(id);
        }
    }

    return { changed, deleted };
};

/**
 * [新增] 移动节点位置（支持跨层级拖拽）
 * @param {Array} nodes - 节点树
 * @param {string} nodeId - 被移动节点 ID
 * @param {string} newParentId - 新父节点 ID (null 表示根节点)
 * @param {number} newIndex - 新位置索引
 * @returns {Array} 移动后的节点树
 */
export const moveNode = (nodes, nodeId, newParentId, newIndex) => {
    // 1. 递归查找并移除目标节点（返回移除后的树）
    let movingNode = null;
    const removeNode = (list) => {
        return list.reduce((acc, node) => {
            if (node.id === nodeId) {
                movingNode = { ...node }; // 复制节点
                return acc; // 移除
            }
            if (node.children) {
                return [...acc, { ...node, children: removeNode(node.children) }];
            }
            return [...acc, node];
        }, []);
    };

    // 获取移除目标后的临时树
    const nodesWithoutTarget = removeNode(nodes);

    if (!movingNode) {
        return nodes;
    }

    // 2. [安全修复] 标记本地变更时间，版本号由后端统一仲裁
    movingNode._localUpdatedAt = Date.now();

    // 3. 插入到新位置
    const insertNode = (list, parentId) => {
        // 如果是插入到根层级
        if (!parentId) {
            const newList = [...list];
            // 边界检查
            const safeIndex = Math.max(0, Math.min(newIndex, newList.length));
            newList.splice(safeIndex, 0, movingNode);
            return newList;
        }

        return list.map(node => {
            if (node.id === parentId) {
                const newChildren = [...(node.children || [])];
                const safeIndex = Math.max(0, Math.min(newIndex, newChildren.length));
                newChildren.splice(safeIndex, 0, movingNode);
                // [安全修复] 父节点结构变化，标记本地更新时间
                return { ...node, children: newChildren, _localUpdatedAt: Date.now() };
            }
            if (node.children) {
                return { ...node, children: insertNode(node.children, parentId) };
            }
            return node;
        });
    };

    return insertNode(nodesWithoutTarget, newParentId);
};
