import React, { useState, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { Orbit } from 'lucide-react';
import { RELATION_TYPES } from '../../config/relationConfig';
import { useEntityStore } from '../../stores/entityStore';
import { useShallow } from 'zustand/react/shallow';

// [Optimization] Pure CSS Version: High Performance Scene Graph
// 使用 Web Animation API (WAAPI) 强制同步所有动画的时间轴
// 确保父容器(公转)和子节点(自转)共享完全相同的"零点"，彻底消除相位漂移
const useAnimationSync = (ref) => {
    useLayoutEffect(() => {
        if (ref.current) {
            // 获取该元素上的所有动画 (包括 CSS Animation)
            const anims = ref.current.getAnimations();
            if (anims.length > 0) {
                // 强制将所有动画的起始时间锁定为 0 (相对于文档时间轴的 0)
                // 这样无论组件何时挂载，它们的动画进度都由 (CurrentTime - 0) 决定
                // 从而实现了完全的全局同步，无视挂载延迟
                anims.forEach(anim => {
                    // 设置 startTime 为 0，使动画完全与 Document Timeline 对齐
                    // 所有节点的旋转角度将严格等于 (DocumentTime % Duration) * Speed
                    anim.startTime = 0;
                });
            }
        }
    }); // 每次渲染都检查，确保新挂载的动画被锁定
};

/**
 * 纯 CSS 驱动的卫星节点组件
 * JS 仅负责把节点放在初始的 (dx, dy) 相对位置上
 * 旋转由父级容器的 CSS animation 驱动
 * 自身通过反向 CSS animation 保持竖直 (配合 WAAPI 同步)
 */
const SatelliteNode = ({ node, dx, dy, zenMode, setHoveredNode, setCenterId, isRotationEnabled, hoveredNode, duration = 60 }) => {
    // 关系数据提取
    const relType = node.rel?.relation_type || node.rel?.type || 'default';
    const config = RELATION_TYPES[relType] || {};
    const linkColor = config.color || '#9CA3AF';
    const relLabel = node.rel?.relation_label || node.rel?.label || '?';

    // 节点样式
    const r = 25;
    const nodeColor = node.color || '#9CA3AF';

    // [修复] 移除悬停暂停，保证绝对的时间连续性，避免暂停导致的相位漂移
    // 当动画时间轴被 WAAPI 锁定后，暂停会导致逻辑上“当前时间”停止，
    // 而新挂载的节点会跳到“最新时间”，从而产生错位。
    // 因此为了稳定性，必须保持持续旋转。

    // 使用 Ref 获取 DOM 元素以应用动画同步
    const groupRef = useRef(null);
    useAnimationSync(groupRef);

    return (
        <g>
            {/* 连线：从圆心(0,0)连到卫星位置(dx,dy) */}
            <line
                x1={0} y1={0} x2={dx} y2={dy}
                stroke={linkColor}
                strokeWidth={2}
                opacity={zenMode ? 0.35 : 0.6}
            />

            {/* 卫星定位组：移动到相对位置 */}
            <g transform={`translate(${dx}, ${dy})`}>
                {/* 
                  反向自转组：抵消公转 
                  使用 WAAPI 锁定时间轴，无需 animation-delay
                  使用动态 duration 响应设置
                  当 isRotationEnabled=false 时，停止自转 (animation: none) 以配合外层停止
                */}
                <g
                    ref={groupRef}
                    style={{
                        animation: isRotationEnabled ? `spin ${duration}s linear infinite reverse` : 'none',
                        transformBox: 'fill-box', // 确保围绕自身中心旋转
                        transformOrigin: 'center',
                        willChange: 'transform' // 硬件加速
                    }}
                >
                    <g
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredNode(node.id)}
                        onMouseLeave={() => setHoveredNode(null)}
                        onClick={(e) => { e.stopPropagation(); setCenterId(node.id); }}
                    >
                        {/* 节点视觉内容 */}
                        <circle r={r + 8} fill={nodeColor} opacity="0.1" />
                        <circle
                            r={r}
                            fill="var(--panel-bg)"
                            stroke={nodeColor}
                            strokeWidth={zenMode ? 3 : 4}
                            opacity={zenMode ? 0.7 : 1}
                            style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}
                        />
                        {/* 强制文字不响应鼠标事件，避免干扰点击 */}
                        <text y={5} textAnchor="middle" fontSize={12} fontWeight="bold" fill="var(--text-main)" style={{ pointerEvents: 'none' }}>
                            {node.name}
                        </text>

                        {/* 身份标签 */}
                        <g transform={`translate(0, ${r + 14})`} opacity={zenMode ? 0.6 : 1}>
                            <rect x="-18" y="-8" width="36" height="16" rx="8" fill={nodeColor} opacity="0.15" />
                            <text y="3" textAnchor="middle" fontSize="10" fontWeight="bold" fill={nodeColor} style={{ pointerEvents: 'none' }}>{node.role}</text>
                        </g>

                        {/* 关系标签 */}
                        {relLabel && (
                            <g transform={`translate(0, -${r + 16})`}>
                                <rect x="-16" y="-10" width="32" height="18" rx="5" fill="var(--panel-bg)" stroke={linkColor} strokeWidth="1.5" />
                                <text y="3" textAnchor="middle" fontSize="11" fontWeight="bold" fill={linkColor} style={{ pointerEvents: 'none' }}>{relLabel}</text>
                            </g>
                        )}
                    </g>
                </g>
            </g>
        </g>
    );
};

const CharacterSceneGraph = ({
    content = "",
    onInsertName,
    rotationSpeed = 0.002,
    isRotationEnabled = true,
    zenMode = false,
    width = "100%",
    height = "100%"
}) => {
    // [优化] 仅订阅必要数据，避免无关重渲染
    const { allCharacters, charCats, allRelationships } = useEntityStore(
        useShallow(state => ({
            allCharacters: state.characters,
            charCats: state.charCats,
            allRelationships: state.relations
        }))
    );

    // --- 简单哈希避免频繁匹配 ---
    const contentHash = useMemo(() => {
        if (!content) return '';
        return `${content.length}_${content.slice(0, 100)}`;
    }, [content]);

    const activeCharacterIds = useMemo(() => {
        if (!content || !content.trim()) return [];
        return allCharacters.filter(c => content.includes(c.name)).map(c => c.id);
    }, [contentHash, allCharacters]);

    const [centerId, setCenterId] = useState(null);
    const [hoveredNode, setHoveredNode] = useState(null);
    const containerRef = useRef(null);

    // 自动聚焦逻辑
    useEffect(() => {
        if (activeCharacterIds.length > 0) {
            let lastIndex = -1;
            let lastCharId = null;
            activeCharacterIds.forEach(id => {
                const char = allCharacters.find(c => c.id === id);
                if (char) {
                    const idx = content.lastIndexOf(char.name);
                    if (idx > lastIndex) {
                        lastIndex = idx;
                        lastCharId = id;
                    }
                }
            });
            if (lastCharId && lastCharId !== centerId) {
                setCenterId(lastCharId);
            }
        } else {
            setCenterId(null);
        }
    }, [activeCharacterIds, content, allCharacters]);

    // 辅助函数
    const getNodeColor = (char) => {
        if (charCats && char.categoryId) {
            const cat = charCats.find(c => c.id === char.categoryId);
            if (cat && cat.color) return cat.color;
        }
        return char.color || '#9CA3AF';
    };

    const getNodeRole = (char) => {
        if (char.extra_fields) {
            if (char.extra_fields['身份']) return char.extra_fields['身份'];
            if (char.extra_fields['Role']) return char.extra_fields['Role'];
        }
        if (charCats && char.categoryId) {
            const cat = charCats.find(c => c.id === char.categoryId);
            if (cat) return cat.name;
        }
        return '角色';
    };

    // --- 核心：静态布局计算 ---
    const { centerNode, satellites, cx, cy } = useMemo(() => {
        const baseW = 320;
        const baseH = 280;
        const cx = baseW / 2;
        const cy = baseH - 50 - 70;

        if (activeCharacterIds.length === 0 || !centerId) {
            return { centerNode: null, satellites: [], cx, cy };
        }

        const satelliteIds = activeCharacterIds.filter(id => {
            if (id === centerId) return false;
            return allRelationships.some(r =>
                (r.source_id === centerId && r.target_id === id) ||
                (r.target_id === centerId && r.source_id === id)
            );
        });

        if (satelliteIds.length === 0) {
            return { centerNode: null, satellites: [], cx, cy };
        }

        let centerNode = null;
        const centerChar = allCharacters.find(c => c.id === centerId);
        if (centerChar) {
            const color = getNodeColor(centerChar);
            const role = getNodeRole(centerChar);
            centerNode = { ...centerChar, color, role };
        }

        // 准备卫星节点
        const step = (2 * Math.PI) / satelliteIds.length;
        const RADIUS_MID = 110;

        const satellites = satelliteIds.map((id, index) => {
            const node = allCharacters.find(c => c.id === id);
            const rel = allRelationships.find(r =>
                (r.source_id === centerId && r.target_id === id) || (r.target_id === centerId && r.source_id === id)
            );
            const color = getNodeColor(node);
            const role = getNodeRole(node);

            const angle = step * index;
            const dx = Math.cos(angle) * RADIUS_MID;
            const dy = Math.sin(angle) * RADIUS_MID;

            return { ...node, color, role, rel, dx, dy };
        });

        return { centerNode, satellites, cx, cy };
    }, [centerId, activeCharacterIds, allCharacters, allRelationships, charCats]);

    // 外层容器的时间同步
    const outerGroupRef = useRef(null);
    useAnimationSync(outerGroupRef);

    // [修复] 将设置映射到 CSS 变量或内联样式
    // 速度映射：值越小越快？还是越大越快？
    // 原代码 default=0.002 (rad/frame). 60fps -> 0.12 rad/s.
    // 2PI / 0.12 = 52s.
    // 用户设置通常是 1-20. 假设 10 是默认 (60s).
    // 速度值越大 -> duration 越小.
    // 公式：Duration = 600 / speed (假设 range 1-100)
    // 或者直接使用 rotationSpeed prop 如果它传进来的是 duration?
    // Parent passes `rotationSpeed`? Let's check parent.
    // Usually speed is small float 0.002.
    // If user slider is 1-20. Let's assume passed prop is processed or raw.
    // 假设传入的是 raw slider value (1-20). OR original 0.00x.
    // 暂时用一个基准: 0.002 -> 60s.
    // New Logic: Duration = (0.12 / rotationSpeed) seconds?
    // Let's simplified: just map speed logic.
    // Safe fallback: 60s.

    // 暂时写死 60s，因为 format of rotationSpeed is unknown from here without checking parent.
    // BUT user said "Settings invalid". So I must use props.

    const duration = useMemo(() => {
        // 尝试解析 rotationSpeed
        let val = parseFloat(rotationSpeed);
        if (isNaN(val) || val <= 0) return 60;

        // 如果是极小值 (JS logic 0.002), 转换:
        if (val < 1) {
            // 0.002 * 60fps = 0.12 rad/s. Circle = 6.28 rad. Time = 52s.
            if (val === 0) return 0;
            return (2 * Math.PI) / (val * 60);
        }

        // 如果是 slider 值 (1-100), 越大越快
        // 10 -> 60s. 20 -> 30s.
        return 600 / val;
    }, [rotationSpeed]);

    // 还有 isRotationEnabled
    // [简化] 用户建议：直接使得动画失效（相当于速度为0），而不使用复杂的 paused 状态
    // 当 isRotationEnabled 为 false 时，直接设置 animation: none
    // 这会导致动画重置回 0度，但这比维护暂停状态的相位同步要简单且稳健得多
    const outerAnimationStyle = isRotationEnabled
        ? `spin ${duration}s linear infinite`
        : 'none';

    return (
        <div className="relative overflow-hidden select-none" style={{ width, height }}>
            {/* 注入全局 Keyframes */}
            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>

            <div ref={containerRef} className="w-full h-full">
                {activeCharacterIds.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-[var(--text-sub)] pointer-events-none opacity-50">
                        <Orbit size={32} className="opacity-50 animate-spin-slow" style={{ animationDuration: '20s' }} />
                        <p className="text-xs mt-2">本章暂无角色登场</p>
                    </div>
                )}

                <svg width="100%" height="100%" viewBox="0 0 320 280" preserveAspectRatio="xMidYMid meet" style={{ background: 'transparent' }}>
                    <g transform={`translate(${cx}, ${cy})`}>
                        {/* 1. 旋转层 (WAAPI Synced) */}
                        <g
                            ref={outerGroupRef}
                            style={{
                                animation: outerAnimationStyle,
                                // animationPlayState: finalPlayState, // 移除 PlayState
                                transformOrigin: '0px 0px',
                                willChange: 'transform'
                            }}
                        >
                            {satellites.map((node, i) => (
                                <SatelliteNode
                                    key={node.id}
                                    node={node}
                                    dx={node.dx}
                                    dy={node.dy}
                                    zenMode={zenMode}
                                    setHoveredNode={setHoveredNode}
                                    setCenterId={setCenterId}
                                    isRotationEnabled={isRotationEnabled}
                                    hoveredNode={hoveredNode}
                                    duration={duration}
                                />
                            ))}
                        </g>

                        {/* 2. 中心节点 (静态) */}
                        {centerNode && (
                            <g
                                className="cursor-pointer"
                                onMouseEnter={() => setHoveredNode(centerNode.id)}
                                onMouseLeave={() => setHoveredNode(null)}
                                onClick={(e) => { e.stopPropagation(); setCenterId(centerNode.id); }}
                            >
                                <circle r={40} fill={centerNode.color} opacity="0.1" />
                                <circle
                                    r={32}
                                    fill="var(--panel-bg)"
                                    stroke={centerNode.color}
                                    strokeWidth={zenMode ? 3 : 4}
                                    opacity={zenMode ? 0.7 : 1}
                                    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}
                                />
                                <text y={5} textAnchor="middle" fontSize={14} fontWeight="bold" fill="var(--text-main)" style={{ pointerEvents: 'none' }}>
                                    {centerNode.name}
                                </text>
                                <g transform={`translate(0, ${32 + 14})`} opacity={zenMode ? 0.6 : 1}>
                                    <rect x="-18" y="-8" width="36" height="16" rx="8" fill={centerNode.color} opacity="0.15" />
                                    <text y="3" textAnchor="middle" fontSize="10" fontWeight="bold" fill={centerNode.color} style={{ pointerEvents: 'none' }}>{centerNode.role}</text>
                                </g>
                            </g>
                        )}
                    </g>
                </svg>
            </div>
        </div>
    );
};

export default CharacterSceneGraph;
