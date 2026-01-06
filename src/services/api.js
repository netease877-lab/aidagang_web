// ==================================================
// File: frontend/src/services/api.js
// 统一 API 请求层
// ==================================================

/**
 * API 客户端类
 * 封装所有 HTTP 请求逻辑
 */
class ApiClient {
    constructor() {
        // 从环境变量读取 API 地址，默认为空（相同域名）
        this.baseUrl = import.meta.env.VITE_API_URL || '';
        this.onUnauthorized = null;
    }

    /**
     * 设置未认证回调
     * @param {Function} callback - 401 错误时的回调
     */
    setUnauthorizedCallback(callback) {
        this.onUnauthorized = callback;
    }

    /**
     * 获取认证头
     * @returns {Object} 请求头对象
     */
    getHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        const token = localStorage.getItem('novel_token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    }

    /**
     * 通用请求方法
     * @param {string} url - 请求 URL
     * @param {string} method - HTTP 方法
     * @param {Object} body - 请求体
     * @returns {Promise<Object>} 响应数据
     */
    async request(url, method = 'GET', body = null, options = {}) {
        const opts = {
            method,
            headers: this.getHeaders(),
            credentials: 'include',
            ...options
        };

        if (body) {
            opts.body = JSON.stringify(body);
        }

        const res = await fetch(this.baseUrl + url, opts);

        if (res.status === 401) {
            localStorage.removeItem('novel_token');
            if (this.onUnauthorized) {
                this.onUnauthorized();
            }
            throw new Error("Unauthorized");
        }

        return res.json();
    }

    /**
     * GET 请求
     * @param {string} url - 请求 URL
     * @returns {Promise<Object>} 响应数据
     */
    async get(url) {
        return this.request(url, 'GET');
    }

    /**
     * POST 请求
     * @param {string} url - 请求 URL
     * @param {Object} data - 请求数据
     * @returns {Promise<Object>} 响应数据
     */
    async post(url, data) {
        return this.request(url, 'POST', data);
    }

    /**
     * PUT 请求
     * @param {string} url - 请求 URL
     * @param {Object} data - 请求数据
     * @returns {Promise<Object>} 响应数据
     */
    async put(url, data) {
        return this.request(url, 'PUT', data);
    }

    /**
     * DELETE 请求
     * @param {string} url - 请求 URL
     * @returns {Promise<Object>} 响应数据
     */
    async delete(url) {
        return this.request(url, 'DELETE');
    }
}

// 导出单例实例
export const apiClient = new ApiClient();

// 兼容原有 fetchAPI 函数签名
export const fetchAPI = async (url, method = 'GET', body = null, options = {}) => {
    return apiClient.request(url, method, body, options);
};

/**
 * 增量拉取小说数据
 * @param {string} novelId - 小说 ID
 * @param {number} baseVersion - 客户端当前版本号，0 表示全量拉取
 * @returns {Promise<Object>} { code, data: { latest_version, is_snapshot, updated, deleted } }
 */
export const syncPullNovel = async (novelId, baseVersion = 0) => {
    return apiClient.get(`/api/novel/${novelId}/sync-pull?base_version=${baseVersion}`);
};

export default apiClient;
