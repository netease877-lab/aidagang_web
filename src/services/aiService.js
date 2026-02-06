import { fetchAPI } from './api';

/**
 * Generate AI content using the backend API.
 * @param {Object} payload - The request payload (model, messages, apiKey, etc.)
 * @returns {Promise<Object>} - The API response data.
 */
export const generateAiContent = async (payload) => {
    // 确保 payload 包含必要的字段
    // 后端期望: { model, messages, apiKey, baseUrl, ... }

    // 如果没有 messages 但有 prompt (旧代码兼容), 转换一下? 
    // 目前 AiToxicCheckModal 构造的是 messages 数组，所以直接透传即可。

    return fetchAPI('/api/ai/generate', 'POST', payload);
};
