/**
 * AutoResizeTextarea - 自动调整高度的 Textarea 组件
 * 从 OutlinePanel.jsx 提取的通用组件
 * [修复] 兼容 Firefox 和 Chrome 的 scrollHeight 差异
 */
import React, { useRef, useEffect, useLayoutEffect } from 'react';

const AutoResizeTextarea = ({
    value,
    onChange,
    placeholder,
    className = '',
    style = {},
    onBlur,
    onFocus,
    autoFocus = false,
    rows = 1
}) => {
    const textareaRef = useRef(null);

    // [关键修复] 使用 useLayoutEffect 确保在浏览器绘制前完成高度调整
    // 这避免了视觉上的"跳动"
    useLayoutEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        // [业界标准] 保存当前 overflow，临时设为 hidden 避免滚动条影响计算
        const savedOverflow = textarea.style.overflow;
        textarea.style.overflow = 'hidden';

        // [关键] 先设为 auto 让它可以缩小（删除内容时）
        textarea.style.height = 'auto';

        // 读取实际需要的高度
        let scrollHeight = textarea.scrollHeight;

        // [Firefox 修复] 当 value 为空时，Firefox 的 scrollHeight 不考虑 placeholder
        // 需要根据 placeholder 的行数计算最小高度
        let placeholderLineHeight = 0;
        if (!value && placeholder) {
            const lineCount = (placeholder.match(/\n/g) || []).length + 1;
            // 基于 CSS 样式估算：text-sm (14px) * leading-relaxed (1.625) ≈ 23px/行
            // 加上 padding: p-2 = 8px * 2 = 16px
            placeholderLineHeight = lineCount * 23 + 16;
        }

        // 设置最小高度，防止空内容时塌陷
        const minHeight = Math.max(rows * 24, 24, placeholderLineHeight);
        textarea.style.height = Math.max(scrollHeight, minHeight) + 'px';

        // 恢复 overflow
        textarea.style.overflow = savedOverflow;
    }, [value, rows, placeholder]);

    // 自动聚焦
    useEffect(() => {
        if (autoFocus && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [autoFocus]);

    return (
        <textarea
            ref={textareaRef}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            onBlur={onBlur}
            onFocus={onFocus}
            className={`resize-none overflow-hidden block w-full outline-none ${className}`}
            style={{
                fontFamily: 'inherit',
                boxSizing: 'border-box',  // [关键] 确保跨浏览器一致的盒模型
                ...style
            }}
        />
    );
};

export default AutoResizeTextarea;

