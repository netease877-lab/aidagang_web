/**
 * 树形数据工具函数
 * 从 EditorPage.jsx 抽取的纯函数，用于处理大纲树结构
 */

/**
 * 构建节点索引映射表
 * @param {Array} nodes - 大纲节点数组
 * @param {Object} options - 配置项
 * @param {string} options.chapterNumberingMode - 章节编号模式 ('continuous' | 'reset')
 * @returns {Object} 节点ID到索引信息的映射 { [nodeId]: { volIndex, chIndex } }
 */
export function buildNodeIndexMap(nodes, options = {}) {
    const { chapterNumberingMode = 'reset' } = options;
    const indexMap = {};
    let vIndex = 0;
    let cIndex = 0;

    const traverse = (nodeList) => {
        nodeList.forEach(node => {
            if (node.type === 'volume') {
                vIndex++;
                if (chapterNumberingMode !== 'continuous') {
                    cIndex = 0;
                }
                indexMap[node.id] = { volIndex: vIndex, chIndex: 0 };
                if (node.children) traverse(node.children);
            } else if (node.type === 'chapter') {
                cIndex++;
                indexMap[node.id] = { volIndex: vIndex, chIndex: cIndex };
                if (node.children) traverse(node.children);
            } else {
                // 普通节点
                if (node.children) traverse(node.children);
            }
        });
    };

    traverse(nodes || []);
    return indexMap;
}

/**
 * 构建智能上下文数据（用于匹配相关实体）
 * @param {Array} nodes - 大纲节点数组
 * @param {string} activeNodeId - 当前激活的节点ID
 * @param {Object} entities - 实体数据 { characters, scenes, worldSettings }
 * @param {Object} options - 配置项
 * @returns {Object} 智能上下文数据
 */
export function buildSmartContextData(nodes, activeNodeId, entities, options = {}) {
    const { chapterNumberingMode = 'reset' } = options;
    const { characters = [], scenes = [], worldSettings = [] } = entities;

    const smartContext = {
        volume: null,
        chapter: null,
        nodeTitle: '',
        content: '',
        chars: [],
        scenes: [],
        settings: [],
        wordCount: 0
    };

    if (!activeNodeId) return smartContext;

    let vIndex = 0;
    let cIndex = 0;

    const traverse = (nodeList) => {
        nodeList.forEach(node => {
            if (node.type === 'volume') {
                vIndex++;
                if (chapterNumberingMode !== 'continuous') {
                    cIndex = 0;
                }

                if (activeNodeId === node.id) {
                    smartContext.volume = node;
                    smartContext.nodeTitle = node.title;
                    const matchText = (node.title || '') + (node.content || '');
                    smartContext.content = matchText;
                    smartContext.wordCount = (node.content || '').length;
                    smartContext.chars = characters.filter(c => matchText.includes(c.name));
                    smartContext.scenes = scenes.filter(s => matchText.includes(s.name));
                    smartContext.settings = worldSettings.filter(s => matchText.includes(s.name));
                }

                if (node.children) traverse(node.children);
            } else if (node.type === 'chapter') {
                cIndex++;

                if (activeNodeId === node.id) {
                    smartContext.chapter = node;
                    smartContext.nodeTitle = node.title;
                    const matchText = (node.title || '') + (node.content || '');
                    smartContext.content = matchText;
                    smartContext.wordCount = (node.content || '').length;
                    smartContext.chars = characters.filter(c => matchText.includes(c.name));
                    smartContext.scenes = scenes.filter(s => matchText.includes(s.name));
                    smartContext.settings = worldSettings.filter(s => matchText.includes(s.name));
                }

                if (node.children) traverse(node.children);
            } else {
                // 普通节点（子项/细纲）
                if (activeNodeId === node.id) {
                    smartContext.nodeTitle = node.title;
                    const matchText = (node.title || '') + (node.content || '');
                    smartContext.content = matchText;
                    smartContext.wordCount = (node.content || '').length;
                    smartContext.chars = characters.filter(c => matchText.includes(c.name));
                    smartContext.scenes = scenes.filter(s => matchText.includes(s.name));
                    smartContext.settings = worldSettings.filter(s => matchText.includes(s.name));
                }
                if (node.children) traverse(node.children);
            }
        });
    };

    traverse(nodes || []);
    return smartContext;
}

/**
 * 递归查找节点
 * @param {Array} nodes - 节点数组
 * @param {string} targetId - 目标节点ID
 * @returns {Object|null} 找到的节点或null
 */
export function findNodeById(nodes, targetId) {
    if (!nodes || !targetId) return null;

    for (const node of nodes) {
        if (node.id === targetId) return node;
        if (node.children) {
            const found = findNodeById(node.children, targetId);
            if (found) return found;
        }
    }
    return null;
}

/**
 * 查找章节的细纲子节点
 * @param {Array} nodes - 大纲节点数组
 * @param {string} chapterId - 章节ID
 * @param {Array} outlineKeywords - 细纲关键词数组
 * @returns {Object|null} 找到的细纲节点或null
 */
export function findOutlineChildNode(nodes, chapterId, outlineKeywords = ['细纲', '大纲', '梗概', '提纲', 'outline']) {
    // 递归查找章节节点
    const findChapter = (nodeList) => {
        for (const node of nodeList) {
            if (node.id === chapterId && node.type === 'chapter') {
                return node;
            }
            if (node.children) {
                const found = findChapter(node.children);
                if (found) return found;
            }
        }
        return null;
    };

    const chapter = findChapter(nodes || []);
    if (!chapter || !chapter.children || chapter.children.length === 0) {
        return null;
    }

    // 优先: 找标题含配置关键词的子节点
    const xigang = chapter.children.find(child =>
        outlineKeywords.some(kw => child.title?.includes(kw))
    );
    if (xigang) {
        return xigang;
    }

    // 次之: 第一个子节点
    return chapter.children[0];
}

/**
 * 收集所有章节（扁平化）
 * @param {Array} nodes - 大纲节点数组
 * @param {Object} nodeIndexMap - 节点索引映射表
 * @returns {Array} 扁平化的章节列表
 */
export function collectChapters(nodes, nodeIndexMap = {}) {
    const chapters = [];

    const traverse = (nodeList, volumeTitle = '') => {
        for (const node of nodeList) {
            if (node.type === 'volume') {
                // 递归处理卷的子节点，传递卷标题
                traverse(node.children || [], node.title);
            } else if (node.type === 'chapter') {
                const indexData = nodeIndexMap[node.id] || { volIndex: 0, chIndex: 0 };
                chapters.push({
                    id: node.id,
                    title: node.title,
                    content: node.content,
                    children: node.children,
                    volumeTitle,
                    volumeIndex: indexData.volIndex,
                    chapterIndex: indexData.chIndex
                });
            }
        }
    };

    traverse(nodes || []);
    return chapters;
}

/**
 * 获取上下文章节内容（用于AI）
 * @param {Array} nodes - 大纲节点数组
 * @param {string} nodeId - 当前节点ID
 * @param {string} mode - 模式 ('full' | 'prev_1' | 'prev_10')
 * @param {Object} options - 配置项
 * @returns {string} 格式化的上下文内容
 */
export function fetchContextForAi(nodes, nodeId, mode, options = {}) {
    const {
        nodeIndexMap = {},
        outlineKeywords = ['细纲', '大纲', '梗概', '提纲', 'outline'],
        chapterNumberingMode = 'reset'
    } = options;

    const chapters = collectChapters(nodes, nodeIndexMap);
    let contextChapters = [];

    if (mode === 'full') {
        contextChapters = chapters;
    } else {
        const currentIndex = chapters.findIndex(c => c.id === nodeId);
        // [修复] 如果 nodeId 无效且不是 range 模式，才返回空
        if (currentIndex === -1 && mode !== 'custom_range') return '';

        if (mode === 'prev_1' || mode === 'prev_chapter') {
            if (currentIndex > 0) contextChapters = [chapters[currentIndex - 1]];
        } else if (mode === 'prev_10' || mode === 'prev_10_chapters') {
            const start = Math.max(0, currentIndex - 10);
            contextChapters = chapters.slice(start, currentIndex);
        } else if (mode === 'custom_range') {
            // [新增] 自定义范围模式 (1-based index)
            const start = Math.max(0, (options.start || 1) - 1);
            const end = Math.min(chapters.length, (options.end || chapters.length));
            contextChapters = chapters.slice(start, end);
        }
    }

    // 判断是否需要显示卷信息
    let needsVolumeInfo = false;
    if (chapterNumberingMode === 'reset' && contextChapters.length > 1) {
        for (let i = 1; i < contextChapters.length; i++) {
            const prevNum = Number(contextChapters[i - 1].chapterIndex);
            const currNum = Number(contextChapters[i].chapterIndex);
            if (currNum !== prevNum + 1) {
                needsVolumeInfo = true;
                break;
            }
        }
    }

    // 提取内容 (优先细纲关键词)
    return contextChapters.map(c => {
        let content = '';
        if (c.children && c.children.length > 0) {
            const xigang = c.children.find(child =>
                outlineKeywords.some(kw => child.title?.includes(kw))
            );
            if (xigang && xigang.content) {
                content = xigang.content;
            } else {
                content = c.children[0]?.content || '';
            }
        }
        if (!content) content = c.content || '';

        const chapterNum = c.chapterIndex;
        if (needsVolumeInfo && c.volumeIndex > 0) {
            const volumeTitle = c.volumeTitle ? ' ' + c.volumeTitle : '';
            return '[第' + c.volumeIndex + '卷' + volumeTitle + ' 第' + chapterNum + '章 ' + c.title + ']\n' + content;
        } else {
            return '[第' + chapterNum + '章 ' + c.title + ']\n' + content;
        }
    }).join('\n\n');
}

/**
 * 检查节点是否有匹配的实体
 * @param {Object} node - 节点对象
 * @param {Object} entities - 实体数据 { characters, scenes, worldSettings }
 * @returns {boolean} 是否有匹配
 */
export function hasMatchingEntities(node, entities) {
    if (!node) return false;
    const { characters = [], scenes = [], worldSettings = [] } = entities;
    const matchText = (node.title || '') + (node.content || '');

    return characters.some(c => matchText.includes(c.name)) ||
        scenes.some(s => matchText.includes(s.name)) ||
        worldSettings.some(s => matchText.includes(s.name));
}
