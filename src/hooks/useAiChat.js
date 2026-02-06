// ==================================================
// File: frontend/src/hooks/useAiChat.js
// 公共AI聊天Hook - 提取自AI模态框的公共逻辑
// ==================================================
import { useState, useCallback } from 'react';
import { fetchAPI } from '../services/api';

/**
 * 公共AI聊天Hook
 * 封装AI API调用的公共逻辑，减少AI模态框中的重复代码
 * 
 * @param {Object} options - 配置选项
 * @param {Object} options.aiConfig - AI配置（apiKey, baseUrl, models等）
 * @param {Function} options.onSuccess - 成功回调
 * @param {Function} options.onError - 错误回调
 * @returns {Object} - 返回状态和方法
 */
export function useAiChat({ aiConfig, onSuccess, onError } = {}) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);
    const [rawContent, setRawContent] = useState('');

    /**
     * 获取默认模型ID
     * @returns {string} 模型ID
     */
    const getDefaultModel = useCallback(() => {
        if (aiConfig?.models && aiConfig.models.length > 0) {
            return aiConfig.models[0].id;
        }
        return 'gpt-3.5-turbo';
    }, [aiConfig]);

    /**
     * 验证AI配置
     * @returns {boolean} 是否有效
     */
    const validateConfig = useCallback(() => {
        if (!aiConfig?.apiKey) {
            setError('请先在"设置 -> AI设置"中配置 API Key');
            return false;
        }
        return true;
    }, [aiConfig]);

    /**
     * 发送AI请求
     * @param {Array} messages - 消息数组 [{role: 'user', content: '...'}]
     * @param {Object} options - 可选配置
     * @returns {Promise<Object>} 响应结果
     */
    const sendRequest = useCallback(async (messages, options = {}) => {
        if (!validateConfig()) return null;

        setIsLoading(true);
        setError(null);
        setResult(null);
        setRawContent('');

        try {
            const response = await fetchAPI('/api/ai/generate', 'POST', {
                apiKey: aiConfig.apiKey,
                baseUrl: aiConfig.baseUrl,
                model: options.model || getDefaultModel(),
                messages: messages,
                timeout: options.timeout || 60
            });

            // HTTP 200: 成功
            if (response && Array.isArray(response.data)) {
                setResult(response.data);
                onSuccess?.(response.data);
                return { success: true, data: response.data };
            }

            // HTTP 206: 部分成功（JSON解析失败）
            if (response?.message === 'json_parse_error') {
                const raw = response.data?.[0]?.content || JSON.stringify(response);
                setRawContent(raw);
                return { success: false, raw };
            }

            throw new Error('Invalid response format');
        } catch (err) {
            const errorMsg = err.message || '请求失败';
            setError(errorMsg);
            setRawContent(`[请求错误]: ${errorMsg}`);
            onError?.(err);
            return { success: false, error: errorMsg };
        } finally {
            setIsLoading(false);
        }
    }, [aiConfig, getDefaultModel, validateConfig, onSuccess, onError]);

    /**
     * 重置状态
     */
    const reset = useCallback(() => {
        setIsLoading(false);
        setError(null);
        setResult(null);
        setRawContent('');
    }, []);

    return {
        // 状态
        isLoading,
        error,
        result,
        rawContent,

        // 方法
        sendRequest,
        reset,
        getDefaultModel,
        validateConfig,

        // Setters
        setResult,
        setRawContent
    };
}

export default useAiChat;
