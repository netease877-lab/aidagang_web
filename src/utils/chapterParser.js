/**
 * 章节解析工具函数
 * 从 AiToxicCheckModal.jsx 抽离，提供章节编号解析能力
 */

// 汉字数字映射
const CHINESE_NUMS = {
    '零': 0, '一': 1, '二': 2, '三': 3, '四': 4,
    '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
    '十': 10, '百': 100, '千': 1000
};

/**
 * 解析汉字数字为阿拉伯数字
 * @param {string} str - 汉字数字字符串，如 "三十二"
 * @returns {number} - 对应的阿拉伯数字
 */
export function parseChineseNumber(str) {
    if (!str) return 0;
    let result = 0;
    let temp = 0;
    for (const char of str) {
        const num = CHINESE_NUMS[char];
        if (num === undefined) continue;
        if (num === 10 || num === 100 || num === 1000) {
            if (temp === 0) temp = 1; // "十二" -> 12
            result += temp * num;
            temp = 0;
        } else {
            temp = num;
        }
    }
    return result + temp;
}

/**
 * 从文本中提取章节编号
 * 支持阿拉伯数字、汉字数字、范围格式
 * @param {string} text - 包含章节信息的文本
 * @returns {number|null} - 章节编号，无法解析则返回 null
 */
export function extractChapterNumber(text) {
    if (!text) return null;

    // 1. 匹配 "第X章" 或 "第X-Y章" 格式（阿拉伯数字）
    const arabicMatch = text.match(/第\s*(\d+)(?:\s*[-~—至到]\s*\d+)?\s*章/);
    if (arabicMatch) {
        return parseInt(arabicMatch[1], 10);
    }

    // 2. 匹配 "第X章" 格式（汉字数字）
    const chineseMatch = text.match(/第\s*([零一二三四五六七八九十百千]+)\s*章/);
    if (chineseMatch) {
        return parseChineseNumber(chineseMatch[1]);
    }

    // 3. 匹配纯数字
    const pureNum = text.match(/(\d+)/);
    if (pureNum) {
        return parseInt(pureNum[1], 10);
    }

    return null;
}

/**
 * 从文本中提取章节信息（完整的章节标题）
 * @param {string} text - 包含章节信息的文本
 * @returns {string|null} - 完整的章节标题，如 "第三章"
 */
export function extractChapterInfo(text) {
    if (!text) return null;
    // 匹配格式：第X章、第X-Y章、第三章 等
    const patterns = [
        /第\s*(\d+)(?:\s*[-~—至到]\s*\d+)?\s*章/,  // 第3章、第3-4章
        /第\s*([零一二三四五六七八九十百千]+)\s*章/, // 第三章
    ];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            return match[0]; // 返回完整匹配的章节文本
        }
    }
    return null;
}
