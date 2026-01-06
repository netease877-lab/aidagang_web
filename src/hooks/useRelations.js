// src/hooks/useRelations.js
import { useState, useEffect, useCallback } from 'react';
import { fetchAPI } from '../services/api';

/**
 * 管理角色关系数据的 Hook
 * @param {string} novelId 当前小说ID
 * @returns {Object} { relations, fetchRelations, isLoading }
 */
export function useRelations(novelId) {
    const [relations, setRelations] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchRelations = useCallback(async () => {
        if (!novelId) {
            setRelations([]);
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetchAPI(`/api/relation/${novelId}`);
            if (res && Array.isArray(res)) {
                setRelations(res);
            } else if (res && res.data && Array.isArray(res.data)) {
                // 兼容可能的不同返回结构
                setRelations(res.data);
            } else {
                setRelations([]);
            }
        } catch (e) {
            console.error('[Relations] Fetch failed:', e);
        } finally {
            setIsLoading(false);
        }
    }, [novelId]);

    // 初始加载 & ID 变化时加载
    useEffect(() => {
        fetchRelations();
    }, [fetchRelations]);

    return {
        relations,
        fetchRelations,
        isLoading,
        setRelations // 暴露 setter 以便进行乐观更新（如果需要）
    };
}
