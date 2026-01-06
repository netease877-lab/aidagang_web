/**
 * AI 响应清洗工具 (v3 - 智能版)
 * 
 * 核心策略：
 * 1. 优先直接解析 → 规范则直接返回
 * 2. 检测问题类型 → 只执行必要的清洗
 * 3. 兜底清洗 → 每步清洗后都验证规范，一旦规范立即返回
 * 
 * 不同 AI 工具规范：
 * - ideas: { ideas: [{ type, content }] } 或 [{ type, content }]
 * - issues: { issues: [{ type, description, severity }] } 或 []
 */

/**
 * 主清洗函数
 * @param {string} rawText - AI 返回的原始文本
 * @param {string} expectedType - 期望的数据类型: 'ideas' | 'issues' | 'auto'
 * @returns {{ success: boolean, data: any, error?: string, raw?: string, wasClean?: boolean, cleanSteps?: string[] }}
 */
export function cleanAiResponse(rawText, expectedType = 'auto') {
    if (!rawText || typeof rawText !== 'string') {
        return { success: false, data: null, error: '输入为空', raw: rawText };
    }

    let text = rawText.trim();
    const cleanSteps = []; // 记录执行的清洗步骤

    // ========== Phase 1: 直接解析（规范的 JSON 无需清洗）==========
    const directResult = tryParseAndValidate(text, expectedType);
    if (directResult.success) {
        return { ...directResult, wasClean: true, cleanSteps: [] };
    }

    // ========== Phase 2: 检测问题类型 ==========
    const problems = detectProblems(text);

    // ========== Phase 3: 针对性清洗（只执行检测到的问题）==========
    if (problems.hasBOM) {
        text = removeBOM(text);
        cleanSteps.push('removeBOM');
        const result = tryParseAndValidate(text, expectedType);
        if (result.success) return { ...result, wasClean: false, cleanSteps };
    }

    if (problems.hasMarkdown) {
        text = removeMarkdownCodeBlock(text);
        cleanSteps.push('removeMarkdown');
        const result = tryParseAndValidate(text, expectedType);
        if (result.success) return { ...result, wasClean: false, cleanSteps };
    }

    if (problems.hasGarbage) {
        text = extractJsonSubstring(text);
        cleanSteps.push('extractJson');
        const result = tryParseAndValidate(text, expectedType);
        if (result.success) return { ...result, wasClean: false, cleanSteps };
    }

    if (problems.hasChineseQuotes) {
        text = fixChineseQuotes(text);
        cleanSteps.push('fixChineseQuotes');
        const result = tryParseAndValidate(text, expectedType);
        if (result.success) return { ...result, wasClean: false, cleanSteps };
    }

    if (problems.hasTrailingComma) {
        text = fixTrailingCommas(text);
        cleanSteps.push('fixTrailingCommas');
        const result = tryParseAndValidate(text, expectedType);
        if (result.success) return { ...result, wasClean: false, cleanSteps };
    }

    // ========== Phase 4: 兜底全量清洗（每步后都验证）==========
    // 移除 JS 注释
    const textNoComments = removeJsComments(text);
    if (textNoComments !== text) {
        text = textNoComments;
        cleanSteps.push('removeJsComments');
        const result = tryParseAndValidate(text, expectedType);
        if (result.success) return { ...result, wasClean: false, cleanSteps };
    }

    // 单引号 → 双引号
    const textDoubleQuotes = convertSingleQuotesToDouble(text);
    if (textDoubleQuotes !== text) {
        text = textDoubleQuotes;
        cleanSteps.push('convertSingleQuotes');
        const result = tryParseAndValidate(text, expectedType);
        if (result.success) return { ...result, wasClean: false, cleanSteps };
    }

    // 未引用属性名 → 引用
    const textQuotedKeys = quoteUnquotedKeys(text);
    if (textQuotedKeys !== text) {
        text = textQuotedKeys;
        cleanSteps.push('quoteUnquotedKeys');
        const result = tryParseAndValidate(text, expectedType);
        if (result.success) return { ...result, wasClean: false, cleanSteps };
    }

    // 移除非法控制字符
    const textNoControl = removeControlChars(text);
    if (textNoControl !== text) {
        text = textNoControl;
        cleanSteps.push('removeControlChars');
        const result = tryParseAndValidate(text, expectedType);
        if (result.success) return { ...result, wasClean: false, cleanSteps };
    }

    // 最后手段：尝试补全不完整括号
    if (problems.hasUnclosedBrackets) {
        const repaired = tryRepairIncompleteJson(text);
        if (repaired) {
            text = repaired;
            cleanSteps.push('repairBrackets');
            const result = tryParseAndValidate(text, expectedType);
            if (result.success) return { ...result, wasClean: false, cleanSteps };
        }
    }

    // ========== 所有方法都失败 ==========
    return {
        success: false,
        data: null,
        error: 'JSON 解析失败',
        raw: rawText,
        cleanSteps
    };
}

/**
 * 尝试解析并验证是否符合规范
 */
function tryParseAndValidate(text, expectedType) {
    try {
        const parsed = JSON.parse(text);
        const extracted = extractTargetData(parsed, expectedType);
        if (extracted !== null) {
            return { success: true, data: extracted };
        }
        // 结构不匹配期望类型
        return { success: false };
    } catch (e) {
        return { success: false };
    }
}

/**
 * 检测问题类型
 */
function detectProblems(text) {
    const trimmed = text.trim();
    return {
        hasBOM: text.charCodeAt(0) === 0xFEFF,
        hasMarkdown: /```/.test(text),
        hasGarbage: !/^\s*[\[{]/.test(trimmed),  // 不以 [ 或 { 开头
        hasChineseQuotes: /[""'']/.test(text),
        hasTrailingComma: /,\s*[}\]]/.test(text),
        hasUnclosedBrackets: checkUnclosedBrackets(text)
    };
}

/**
 * 检查是否有未闭合括号
 */
function checkUnclosedBrackets(text) {
    let braceCount = 0;
    let bracketCount = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (escapeNext) { escapeNext = false; continue; }
        if (char === '\\') { escapeNext = true; continue; }
        if (char === '"') { inString = !inString; continue; }
        if (!inString) {
            if (char === '{') braceCount++;
            else if (char === '}') braceCount--;
            else if (char === '[') bracketCount++;
            else if (char === ']') bracketCount--;
        }
    }
    return braceCount !== 0 || bracketCount !== 0;
}

// ==================== 清洗函数 ====================

function removeBOM(text) {
    return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
}

function removeMarkdownCodeBlock(text) {
    const match = text.match(/```(?:json|javascript|js)?\s*([\s\S]*?)\s*```/i);
    return match && match[1] ? match[1].trim() : text;
}

function extractJsonSubstring(text) {
    const firstBrace = text.indexOf('{');
    const firstBracket = text.indexOf('[');

    let startIdx = -1;
    let endChar = '}';

    if (firstBrace >= 0 && (firstBracket < 0 || firstBrace < firstBracket)) {
        startIdx = firstBrace;
        endChar = '}';
    } else if (firstBracket >= 0) {
        startIdx = firstBracket;
        endChar = ']';
    }

    if (startIdx < 0) return text;

    const lastEnd = text.lastIndexOf(endChar);
    if (lastEnd > startIdx) {
        return text.substring(startIdx, lastEnd + 1);
    }
    return text.substring(startIdx);
}

function fixChineseQuotes(text) {
    return text.replace(/[""]/g, '"').replace(/['']/g, "'");
}

function fixTrailingCommas(text) {
    return text.replace(/,(\s*[}\]])/g, '$1');
}

function removeJsComments(text) {
    let result = '';
    let inString = false;
    let escapeNext = false;
    let i = 0;

    while (i < text.length) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (escapeNext) { result += char; escapeNext = false; i++; continue; }
        if (char === '\\') { result += char; escapeNext = true; i++; continue; }
        if (char === '"') { inString = !inString; result += char; i++; continue; }

        if (!inString) {
            if (char === '/' && nextChar === '/') {
                while (i < text.length && text[i] !== '\n') i++;
                continue;
            }
            if (char === '/' && nextChar === '*') {
                i += 2;
                while (i < text.length - 1 && !(text[i] === '*' && text[i + 1] === '/')) i++;
                i += 2;
                continue;
            }
        }
        result += char;
        i++;
    }
    return result;
}

function convertSingleQuotesToDouble(text) {
    let result = '';
    let inDoubleQuote = false;
    let inSingleQuote = false;
    let escapeNext = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (escapeNext) { result += char; escapeNext = false; continue; }
        if (char === '\\') { result += char; escapeNext = true; continue; }
        if (char === '"' && !inSingleQuote) { inDoubleQuote = !inDoubleQuote; result += char; continue; }
        if (char === "'" && !inDoubleQuote) { inSingleQuote = !inSingleQuote; result += '"'; continue; }
        result += char;
    }
    return result;
}

function quoteUnquotedKeys(text) {
    return text.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');
}

function removeControlChars(text) {
    return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

function tryRepairIncompleteJson(text) {
    let braceCount = 0;
    let bracketCount = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (escapeNext) { escapeNext = false; continue; }
        if (char === '\\') { escapeNext = true; continue; }
        if (char === '"') { inString = !inString; continue; }
        if (!inString) {
            if (char === '{') braceCount++;
            else if (char === '}') braceCount--;
            else if (char === '[') bracketCount++;
            else if (char === ']') bracketCount--;
        }
    }

    if (braceCount < 0 || bracketCount < 0) return null;

    let repaired = text;
    for (let i = 0; i < bracketCount; i++) repaired += ']';
    for (let i = 0; i < braceCount; i++) repaired += '}';

    return repaired !== text ? repaired : null;
}

// ==================== 数据提取与验证 ====================

function extractTargetData(parsed, expectedType) {
    if (expectedType === 'auto') {
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        const fields = ['ideas', 'issues', 'data', 'result', 'results', 'output', 'items', 'list'];
        for (const field of fields) {
            if (parsed[field] && Array.isArray(parsed[field])) return parsed[field];
        }
        return parsed;
    }

    if (expectedType === 'ideas') {
        // 规范：数组元素需有 type 或 content 字段
        let candidates = findArray(parsed, ['ideas', 'data', 'result', 'results']);
        if (candidates.length > 0) {
            const isValid = candidates.some(item =>
                item && (typeof item.content === 'string' || typeof item.type === 'string')
            );
            if (isValid) return candidates;
        }
        return null;
    }

    if (expectedType === 'issues') {
        // 规范：数组元素需有 type 或 description 字段，空数组也合法
        let candidates = findArray(parsed, ['issues', 'data', 'result']);
        if (candidates.length === 0 && Array.isArray(parsed) && parsed.length === 0) {
            return []; // 空数组表示没有问题，合法
        }
        if (candidates.length > 0) {
            const isValid = candidates.some(item =>
                item && (typeof item.description === 'string' || typeof item.type === 'string')
            );
            if (isValid) return candidates;
        }
        // 检查 parsed 本身是否是空数组
        if (Array.isArray(parsed) && parsed.length === 0) return [];
        return null;
    }

    return parsed;
}

function findArray(parsed, fields) {
    if (Array.isArray(parsed)) return parsed;
    for (const field of fields) {
        if (parsed[field] && Array.isArray(parsed[field])) return parsed[field];
    }
    return [];
}

// ==================== 导出 ====================

export function cleanAiIdeasResponse(rawText) {
    return cleanAiResponse(rawText, 'ideas');
}

export function cleanAiIssuesResponse(rawText) {
    return cleanAiResponse(rawText, 'issues');
}

export default cleanAiResponse;
