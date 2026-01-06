// ==================================================
// File: frontend/src/utils/crypto.js
// 简单的前端加密工具（用于localStorage敏感数据）
// 注意：前端加密主要防止明文存储，不能防止恶意攻击
// ==================================================

/**
 * 简单的混淆加密（非安全加密，仅用于避免明文存储）
 * @param {string} text - 要加密的文本
 * @param {string} key - 加密密钥（默认使用固定key）
 * @returns {string} 加密后的base64字符串
 */
export function obfuscate(text, key = 'novel-studio-2024') {
    if (!text) return '';

    try {
        // 简单XOR混淆 + base64
        let result = '';
        for (let i = 0; i < text.length; i++) {
            result += String.fromCharCode(
                text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
            );
        }
        return btoa(result);
    } catch (e) {
        return text;
    }
}

/**
 * 解密混淆的文本
 * @param {string} encoded - 加密后的base64字符串
 * @param {string} key - 加密密钥
 * @returns {string} 解密后的原文
 */
export function deobfuscate(encoded, key = 'novel-studio-2024') {
    if (!encoded) return '';

    try {
        const decoded = atob(encoded);
        let result = '';
        for (let i = 0; i < decoded.length; i++) {
            result += String.fromCharCode(
                decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length)
            );
        }
        return result;
    } catch (e) {
        // 可能是未加密的旧数据，直接返回
        return encoded;
    }
}

/**
 * 安全存储敏感配置到localStorage
 * @param {string} key - 存储键名
 * @param {Object} config - 配置对象
 * @param {string[]} sensitiveFields - 需要加密的字段名数组
 */
export function secureStore(key, config, sensitiveFields = ['password', 'apiKey', 'secret']) {
    const safeConfig = { ...config };

    for (const field of sensitiveFields) {
        if (safeConfig[field]) {
            safeConfig[`_${field}`] = obfuscate(safeConfig[field]);
            delete safeConfig[field];
        }
    }

    localStorage.setItem(key, JSON.stringify(safeConfig));
}

/**
 * 从localStorage读取并解密敏感配置
 * @param {string} key - 存储键名
 * @param {Object} defaultValue - 默认值
 * @param {string[]} sensitiveFields - 需要解密的字段名数组
 * @returns {Object} 解密后的配置
 */
export function secureLoad(key, defaultValue = {}, sensitiveFields = ['password', 'apiKey', 'secret']) {
    try {
        const stored = localStorage.getItem(key);
        if (!stored) return defaultValue;

        const config = JSON.parse(stored);

        for (const field of sensitiveFields) {
            if (config[`_${field}`]) {
                config[field] = deobfuscate(config[`_${field}`]);
                delete config[`_${field}`];
            }
        }

        return config;
    } catch (e) {
        return defaultValue;
    }
}

export default {
    obfuscate,
    deobfuscate,
    secureStore,
    secureLoad
};
