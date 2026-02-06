// ==================================================
// File: frontend/src/features/smart/MobileSmartTooltip.jsx
// 使用Floating UI重构的移动端智能气泡提示（简化版）
// [激进重构] 直接从 entityStore 获取所有实体数据
// ==================================================
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { User, MapPin, BookOpen } from 'lucide-react';
import {
    useFloating,
    arrow,
    offset,
    shift,
    flip,
    autoUpdate,
} from '@floating-ui/react';
import { useEntityStore } from '../../stores/entityStore';  // [激进重构] 直接订阅 entityStore

export default function MobileSmartTooltip({
    inputText = '',
    cursorPosition = null,
    // [激进重构] 移除实体相关 props，直接从 Store 获取
    enabled = true,
    smartContextData = {},
    isMarkingMode = false,
    markingModeEntity = null,
    onCloseMarkingTooltip = null,
    uiScale = 100,
}) {
    // [激进重构] 直接从 entityStore 获取所有实体数据
    const {
        characters, scenes, worldSettings,
        charCats, sceneCats, settingCats,
        charFields,
        defaultCharColor, defaultSceneColor, defaultSettingColor,
        relations
    } = useEntityStore();

    const [visible, setVisible] = useState(false);
    const [matchedEntity, setMatchedEntity] = useState(null);
    const hideTimerRef = useRef(null);
    const lastMatchedEntityIdRef = useRef(null);
    const lockedInputTextRef = useRef('');
    const arrowRef = useRef(null);
    const floatingRef = useRef(null); // [新增] 用于检测点击外部

    // 缓存当前锚点的矩形信息
    const anchorRectRef = useRef(null);

    // 缩放因子
    const scale = uiScale / 100;

    // Floating UI配置
    const { refs, floatingStyles, middlewareData, placement } = useFloating({
        placement: 'top',
        middleware: [
            offset(10 * scale), // 偏移量也需要缩放
            flip({
                fallbackPlacements: ['bottom', 'top'],
                padding: 8,
            }),
            shift({ padding: 12 }),
            arrow({
                element: arrowRef,
                padding: 5,
            }),
        ],
    });

    // 创建虚拟元素并设置为 position reference
    const updatePositionReference = useCallback(() => {
        if (!anchorRectRef.current) return;

        const rect = anchorRectRef.current;
        refs.setPositionReference({
            getBoundingClientRect: () => rect,
        });
    }, [refs]);

    // 匹配实体逻辑
    const findMatchedEntity = useMemo(() => {
        if (!inputText || inputText.length < 2) return null;
        const recentText = inputText.slice(-10);

        for (const char of characters) {
            if (recentText.endsWith(char.name)) {
                const cat = charCats.find(c => c.id === char.categoryId);
                return {
                    type: 'character',
                    data: char,
                    color: cat?.color || defaultCharColor,
                    icon: User,
                    entityId: `char_${char.id || char.name}`,
                };
            }
        }

        for (const scene of scenes) {
            if (recentText.endsWith(scene.name)) {
                const cat = sceneCats.find(c => c.id === scene.categoryId);
                return {
                    type: 'scene',
                    data: scene,
                    color: cat?.color || defaultSceneColor,
                    icon: MapPin,
                    entityId: `scene_${scene.id || scene.name}`,
                };
            }
        }

        for (const setting of worldSettings) {
            if (recentText.endsWith(setting.name)) {
                const cat = settingCats.find(c => c.id === setting.categoryId);
                return {
                    type: 'setting',
                    data: setting,
                    color: cat?.color || defaultSettingColor,
                    icon: BookOpen,
                    entityId: `setting_${setting.id || setting.name}`,
                };
            }
        }

        return null;
    }, [inputText, characters, scenes, worldSettings, charCats, sceneCats, settingCats, defaultCharColor, defaultSceneColor, defaultSettingColor]);

    // 计算锚点矩形（使用镜像 div 技术精确测量，与标记模式一致）
    useEffect(() => {
        if (!cursorPosition) return;

        const textareaInfo = cursorPosition.textareaInfo;
        const entityName = findMatchedEntity?.data?.name;

        if (!textareaInfo || !entityName) return;

        const { textareaElement } = textareaInfo;
        if (!textareaElement) return;

        // [修复] 直接使用 inputText，而非缓存的 lockedInputTextRef
        // 因为 entityName 是基于 inputText 匹配的，位置计算必须使用相同的文本
        const targetText = inputText;

        // 获取 textarea 的精确位置和样式
        const textareaRect = textareaElement.getBoundingClientRect();
        const style = window.getComputedStyle(textareaElement);

        // 创建镜像 div，精确复制 textarea 的渲染环境
        const mirror = document.createElement('div');

        // [修复] zoom 缩放问题：
        // - textareaRect 返回的是缩放后的视口坐标
        // - 镜像 div 在 body 上，不受 zoom 影响
        // - 需要对镜像 div 应用相同的 zoom，并将坐标转换为逻辑坐标
        mirror.style.cssText = `
            position: fixed;
            left: ${textareaRect.left / scale}px;
            top: ${textareaRect.top / scale}px;
            width: ${textareaRect.width / scale}px;
            height: auto;
            visibility: hidden;
            white-space: pre-wrap;
            word-wrap: break-word;
            overflow-wrap: break-word;
            box-sizing: border-box;
            padding: ${style.padding};
            border: ${style.border};
            font-family: ${style.fontFamily};
            font-size: ${style.fontSize};
            line-height: ${style.lineHeight};
            letter-spacing: ${style.letterSpacing};
            text-indent: ${style.textIndent};
            pointer-events: none;
            z-index: -9999;
            zoom: ${scale};
        `;

        // 计算实体名称的位置
        const textBeforeMatch = targetText.slice(0, -entityName.length);

        // 构建镜像内容：匹配前的文本 + 带标记的实体名字
        const beforeSpan = document.createTextNode(textBeforeMatch);
        const entitySpan = document.createElement('span');
        entitySpan.textContent = entityName;

        mirror.appendChild(beforeSpan);
        mirror.appendChild(entitySpan);

        document.body.appendChild(mirror);

        // 获取实体 span 的精确位置
        const rect = entitySpan.getBoundingClientRect();

        anchorRectRef.current = {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
            top: rect.top,
            left: rect.left,
            right: rect.right,
            bottom: rect.bottom,
        };

        // 清理镜像 div
        document.body.removeChild(mirror);

        // 触发 Floating UI 重新计算
        updatePositionReference();
    }, [cursorPosition, findMatchedEntity, inputText, updatePositionReference]);

    // 监听匹配结果
    useEffect(() => {
        if (!enabled) {
            setVisible(false);
            return;
        }

        if (findMatchedEntity) {
            if (hideTimerRef.current) {
                clearTimeout(hideTimerRef.current);
                hideTimerRef.current = null;
            }

            const isNewEntity = findMatchedEntity.entityId !== lastMatchedEntityIdRef.current;
            if (isNewEntity) {
                setMatchedEntity(findMatchedEntity);
                lastMatchedEntityIdRef.current = findMatchedEntity.entityId;
            }

            lockedInputTextRef.current = inputText;
            setVisible(true);
        } else if (lockedInputTextRef.current) {
            // [恢复] 原有逻辑：当不再匹配实体时，检查是否需要延迟关闭
            // 如果用户删除了匹配的文本，立即关闭
            if (!inputText.startsWith(lockedInputTextRef.current)) {
                setVisible(false);
                setMatchedEntity(null);
                lastMatchedEntityIdRef.current = null;
                lockedInputTextRef.current = '';
            } else {
                // 用户继续输入，检查是否输入了2个汉字以上
                const addedText = inputText.slice(lockedInputTextRef.current.length);
                let chineseCharCount = 0;
                for (let i = 0; i < addedText.length; i++) {
                    if (/[\u4e00-\u9fa5]/.test(addedText[i])) {
                        chineseCharCount++;
                    }
                }

                // 输入2个汉字后，1秒后自动关闭
                if (chineseCharCount >= 2 && !hideTimerRef.current) {
                    hideTimerRef.current = setTimeout(() => {
                        setVisible(false);
                        setMatchedEntity(null);
                        lastMatchedEntityIdRef.current = null;
                        lockedInputTextRef.current = '';
                        hideTimerRef.current = null;
                    }, 1000);
                }
            }
        }

        return () => {
            if (hideTimerRef.current) {
                clearTimeout(hideTimerRef.current);
            }
        };
    }, [findMatchedEntity, enabled, inputText]); // 不依赖 visible，避免循环

    // 标记模式实体
    const markingEntity = useMemo(() => {
        if (!isMarkingMode || !markingModeEntity) return null;
        const { type, data, rect } = markingModeEntity;
        let color = defaultCharColor;

        if (type === 'character') {
            const cat = charCats.find(c => c.id === data.categoryId);
            color = cat?.color || defaultCharColor;
        } else if (type === 'scene') {
            const cat = sceneCats.find(c => c.id === data.categoryId);
            color = cat?.color || defaultSceneColor;
        } else if (type === 'setting') {
            const cat = settingCats.find(c => c.id === data.categoryId);
            color = cat?.color || defaultSettingColor;
        }

        return { type, data, color, rect };
    }, [isMarkingMode, markingModeEntity, charCats, sceneCats, settingCats, defaultCharColor, defaultSceneColor, defaultSettingColor]);

    // [新增] 点击外部或滚动时关闭气泡
    useEffect(() => {
        const isTooltipVisible = visible || !!markingEntity;
        if (!isTooltipVisible) return;

        const handleClickOutside = (e) => {
            // 如果点击的是气泡内部，不关闭
            if (floatingRef.current && floatingRef.current.contains(e.target)) return;
            // [修复] 如果点击的是另一个可点击的实体（标记模式下），不触发关闭
            // 让 onMarkingEntityClick 处理实体切换，避免闪烁
            if (e.target.classList.contains('cursor-pointer')) return;
            // 关闭气泡
            setVisible(false);
            setMatchedEntity(null);
            lastMatchedEntityIdRef.current = null;
            lockedInputTextRef.current = '';
            if (onCloseMarkingTooltip) onCloseMarkingTooltip();
        };

        const handleScroll = () => {
            // [修复] 滚动时关闭气泡：同时清空 matchedEntity
            setVisible(false);
            setMatchedEntity(null);
            lastMatchedEntityIdRef.current = null;
            lockedInputTextRef.current = '';
            if (onCloseMarkingTooltip) onCloseMarkingTooltip();
        };

        // 延迟添加监听，避免触发立即关闭
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside);
            window.addEventListener('scroll', handleScroll, true); // 使用捕获阶段监听所有滚动
        }, 100);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [visible, markingEntity, onCloseMarkingTooltip]);

    // 标记模式的锚点矩形更新
    useEffect(() => {
        if (!markingEntity?.rect) return;

        const rect = markingEntity.rect;
        anchorRectRef.current = {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
            top: rect.top,
            left: rect.left,
            right: rect.right,
            bottom: rect.bottom,
        };

        // 触发 Floating UI 重新计算
        updatePositionReference();
    }, [markingEntity, updatePositionReference]);

    const displayEntity = markingEntity || (visible && matchedEntity);
    const isMarkingModeTooltip = !!markingEntity;

    if (!displayEntity) return null;

    const entityData = displayEntity.data;
    const entityColor = displayEntity.color;

    // 计算arrow位置
    const { x: arrowX, y: arrowY } = middlewareData.arrow || {};
    const staticSide = {
        top: 'bottom',
        right: 'left',
        bottom: 'top',
        left: 'right'
    }[placement.split('-')[0]];

    return (
        <div
            ref={(node) => {
                refs.setFloating(node);
                floatingRef.current = node;
            }}
            style={{
                ...floatingStyles,
                zIndex: 9999, // [修改] 确保超过顶部菜单（z-50）
            }}
            className={`transition-all duration-300 ${isMarkingModeTooltip ? 'pointer-events-auto' : 'pointer-events-none'}
                ${(visible || isMarkingModeTooltip) ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
        >
            {/* 气泡主体 */}
            <div className="bg-[var(--panel-bg)] border border-[var(--accent)] rounded-xl shadow-xl p-3 max-w-[280px] min-w-[200px]">
                {/* 标题 */}
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[var(--border)] border-dashed">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entityColor, opacity: 0.7 }}></div>
                    <div className="font-bold text-[var(--text-main)] truncate text-sm flex-1">
                        {entityData.name || entityData.title}
                    </div>
                    {isMarkingModeTooltip && onCloseMarkingTooltip && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onCloseMarkingTooltip(); }}
                            className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-[var(--hover-bg)] text-[var(--text-sub)] hover:text-[var(--text-main)] transition-colors flex-shrink-0"
                            title="关闭"
                        >
                            ×
                        </button>
                    )}
                </div>

                {/* 内容 */}
                {displayEntity.type === 'character' ? (
                    <div className="space-y-2">
                        <div className="space-y-1">
                            {(charFields || []).filter(f => f.showInCard !== false).map(field => {
                                const val = entityData.extra_fields?.[field.label];
                                if (!val) return null;
                                return (
                                    <div key={field.label} className="text-xs text-[var(--text-sub)] flex flex-wrap gap-x-1 items-baseline">
                                        <span className="opacity-80 flex-shrink-0 whitespace-nowrap">{field.label}:</span>
                                        <span className="opacity-90 break-all">{val}</span>
                                    </div>
                                );
                            })}

                            {(!entityData.extra_fields || Object.keys(entityData.extra_fields).length === 0) && entityData.desc && (
                                <div className="text-xs text-[var(--text-sub)] line-clamp-3 leading-relaxed">
                                    {entityData.desc}
                                </div>
                            )}
                        </div>

                        {/* 关系展示 */}
                        {(() => {
                            if (!relations || !smartContextData || !smartContextData.chars) return null;
                            const activeCharIds = smartContextData.chars.map(c => c.id);
                            const currentId = entityData.id;
                            const relatedRelations = relations.filter(r =>
                                (r.source_id === currentId && activeCharIds.includes(r.target_id)) ||
                                (r.target_id === currentId && activeCharIds.includes(r.source_id))
                            );

                            if (relatedRelations.length === 0) return null;

                            const RELATION_COLORS = {
                                family: '#F59E0B', love: '#EC4899', friend: '#10B981',
                                hostile: '#6366F1', mentor: '#F97316', util: '#6B7280', custom: '#9CA3AF'
                            };

                            return (
                                <div className="pt-2 border-t border-[var(--border)] border-dashed mt-1">
                                    <div className="flex flex-col gap-1">
                                        {relatedRelations.map((rel, idx) => {
                                            const isSource = rel.source_id === currentId;
                                            const targetId = isSource ? rel.target_id : rel.source_id;
                                            const targetChar = characters.find(c => c.id === targetId);
                                            if (!targetChar) return null;

                                            const relationText = rel.relation_label || rel.relation_type || '关系';
                                            const relColor = RELATION_COLORS[rel.relation_type] || RELATION_COLORS.custom;

                                            return (
                                                <div key={idx} className="flex items-center gap-1 text-xs">
                                                    <span className="px-1 py-0.5 rounded-[3px] text-[10px] font-bold text-white leading-none" style={{ backgroundColor: relColor }}>
                                                        {relationText}
                                                    </span>
                                                    <span className="text-[var(--text-main)] truncate">{targetChar.name}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                ) : (
                    (entityData.desc || entityData.notes || entityData.content) && (
                        <div className="text-xs text-[var(--text-sub)] line-clamp-3 leading-relaxed">
                            {entityData.desc || entityData.notes || entityData.content}
                        </div>
                    )
                )}
            </div>

            {/* Arrow - Floating UI动态定位 */}
            <div
                ref={arrowRef}
                style={{
                    position: 'absolute',
                    left: arrowX != null ? `${arrowX}px` : '',
                    top: arrowY != null ? `${arrowY}px` : '',
                    [staticSide]: '-4px',
                    width: '8px',
                    height: '8px',
                    background: 'var(--accent)',
                    transform: 'rotate(45deg)',
                }}
            />
        </div>
    );
}
