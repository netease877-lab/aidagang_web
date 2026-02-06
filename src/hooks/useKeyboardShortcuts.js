// src/hooks/useKeyboardShortcuts.js
import { useEffect } from 'react';

/**
 * Hook to register keyboard shortcuts.
 * @param {Object} shortcuts - map of key to handler function.
 * 快捷键需要配合 Ctrl (Windows) 或 Cmd (Mac) 使用
 */
export function useKeyboardShortcuts(shortcuts) {
    useEffect(() => {
        const handler = (e) => {
            // [修复] 必须按下 Ctrl 或 Cmd 键才触发快捷键
            if (!e.ctrlKey && !e.metaKey) return;

            const fn = shortcuts[e.key.toLowerCase()];
            if (fn) {
                e.preventDefault();
                fn(e);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [shortcuts]);
}
