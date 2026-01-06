// ==================================================
// File: frontend/src/components/common/ResizableTextarea.jsx
// 可拖拽底部边框调整高度的Textarea组件
// ==================================================
import React, { useState, useRef, useCallback, useEffect } from 'react';

export default function ResizableTextarea({
    value,
    onChange,
    className = '',
    storageKey,
    minHeight = 120,
    placeholder,
    ...props
}) {
    const containerRef = useRef(null);
    const [height, setHeight] = useState(() => {
        if (storageKey) {
            const saved = localStorage.getItem(storageKey);
            return saved ? parseInt(saved, 10) : minHeight;
        }
        return minHeight;
    });

    // 拖拽状态
    const isDragging = useRef(false);
    const startY = useRef(0);
    const startHeight = useRef(0);

    const handleMouseDown = useCallback((e) => {
        e.preventDefault();
        isDragging.current = true;
        startY.current = e.clientY;
        startHeight.current = height;
        document.body.style.cursor = 'ns-resize';
        document.body.style.userSelect = 'none';
    }, [height]);

    const handleMouseMove = useCallback((e) => {
        if (!isDragging.current) return;
        const delta = e.clientY - startY.current;
        const newHeight = Math.max(minHeight, startHeight.current + delta);
        setHeight(newHeight);
    }, [minHeight]);

    const handleMouseUp = useCallback(() => {
        if (!isDragging.current) return;
        isDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        if (storageKey) {
            localStorage.setItem(storageKey, String(height));
        }
    }, [storageKey, height]);

    // [新增] Touch 事件支持（手机端拖拽）
    const handleTouchStart = useCallback((e) => {
        if (e.touches.length !== 1) return;
        isDragging.current = true;
        startY.current = e.touches[0].clientY;
        startHeight.current = height;
    }, [height]);

    const handleTouchMove = useCallback((e) => {
        if (!isDragging.current || e.touches.length !== 1) return;
        e.preventDefault(); // 防止页面滚动
        const delta = e.touches[0].clientY - startY.current;
        const newHeight = Math.max(minHeight, startHeight.current + delta);
        setHeight(newHeight);
    }, [minHeight]);

    const handleTouchEnd = useCallback(() => {
        if (!isDragging.current) return;
        isDragging.current = false;
        if (storageKey) {
            localStorage.setItem(storageKey, String(height));
        }
    }, [storageKey, height]);

    useEffect(() => {
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchend', handleTouchEnd);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
        };
    }, [handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

    return (
        <div ref={containerRef} className="relative">
            <textarea
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className={`w-full resize-none overflow-y-auto ${className}`}
                style={{ height: `${height}px` }}
                {...props}
            />
            {/* 底部拖拽条 */}
            <div
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                className="absolute bottom-0 left-0 right-0 h-4 cursor-ns-resize group flex items-center justify-center touch-none"
            >
                <div className="w-12 h-1 rounded-full bg-[var(--border)] group-hover:bg-[var(--accent)] transition-colors" />
            </div>
        </div>
    );
}
