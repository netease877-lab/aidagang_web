// ==================================================
// File: frontend/src/features/settings/SettingsTheme.jsx
// [激进重构] 直接从 settingsStore 获取数据
// ==================================================
import React from 'react';
import { Monitor, Expand, Palette, Hash } from 'lucide-react';
import { THEMES, ZEN_CARD_STYLES } from '../../constants.js';
import { useSettingsStore } from '../../stores';
import { useEntityStore } from '../../stores/entityStore'; // [修复] 同步颜色到 entityStore
import { useUser } from '../../contexts'; // [新增]

// 设置区块组件
const SettingSection = ({ title, children }) => (
    <div className="mb-6 animate-in fade-in slide-in-from-left-2 duration-300">
        <h4 className="font-bold text-sm text-[var(--text-main)] mb-3 flex items-center gap-2 border-b border-[var(--border)] pb-2">
            {title}
        </h4>
        <div className="space-y-4">{children}</div>
    </div>
);

/**
 * [激进重构] 直接从 settingsStore 获取数据，删除 props
 */
export default function SettingsTheme({ isMobile = false }) {
    // [Fix] 移除 UserContext，无需主动保存，依赖 EditorPage 自动同步
    // const { updateConfig } = useUser();

    // 直接从 Store 获取
    const {
        currentThemeId, setCurrentThemeId,
        uiScale, setUiScale,
        isSeamlessBg, setIsSeamlessBg,
        workspaceBgColor, setWorkspaceBgColor,
        defaultCharColor, setDefaultCharColor,
        defaultSceneColor, setDefaultSceneColor,
        defaultSettingColor, setDefaultSettingColor,
        zenAutoPopup, setZenAutoPopup,
        zenCardStyle, setZenCardStyle,
    } = useSettingsStore();

    // [New] 主题切换处理：仅更新 Store，自动保存由 EditorPage 接管
    const handleThemeChange = (themeId) => {
        setCurrentThemeId(themeId);
    };

    return (
        <>
            {/* 全局主题 */}
            <SettingSection title={<><Monitor size={16} /> 全局主题</>}>
                <div className="grid grid-cols-2 gap-3">
                    {Object.values(THEMES).map(theme => (
                        <button
                            key={theme.id}
                            onClick={() => handleThemeChange(theme.id)}
                            className={`relative p-2 rounded-lg border-2 text-left transition-all overflow-hidden ${currentThemeId === theme.id ? 'border-[var(--accent)] ring-2 ring-[var(--accent-bg)]' : 'border-[var(--border)] hover:border-[var(--text-sub)]'}`}
                            style={{ background: theme.colors['--panel-bg'] }}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-4 h-4 rounded-full shadow-sm" style={{ background: theme.colors['--accent'] }} />
                                <span className="text-xs font-bold" style={{ color: theme.colors['--text-main'] }}>{theme.name}</span>
                            </div>
                            <div className="text-[10px] opacity-70" style={{ color: theme.colors['--text-sub'] }}>
                                {theme.type === 'dark' ? '深色' : '浅色'}风格
                            </div>
                            {currentThemeId === theme.id && (
                                <div className="absolute top-0 right-0 p-1 bg-[var(--accent)] text-white rounded-bl-lg"><Hash size={10} /></div>
                            )}
                        </button>
                    ))}
                </div>
            </SettingSection>

            {/* 界面缩放 */}
            <SettingSection title={<><Expand size={16} /> 界面缩放</>}>
                <div className="bg-[var(--panel-bg)] p-3 rounded-lg border border-[var(--border)]">
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-xs text-[var(--text-sub)] font-bold">整体大小</label>
                        <span className="text-xs text-[var(--text-sub)] font-mono">{uiScale}%</span>
                    </div>
                    <input type="range" min="80" max="130" step="5" value={uiScale || 100}
                        onChange={(e) => setUiScale(parseInt(e.target.value))}
                        // onMouseUp/onTouchEnd removed: auto-save dependency
                        className="w-full h-1.5 bg-[var(--border)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]" />
                </div>
            </SettingSection>

            {/* 背景与色彩 */}
            <SettingSection title={<><Palette size={16} /> 背景与色彩</>}>
                <div className="bg-[var(--panel-bg)] p-3 rounded-lg border border-[var(--border)] space-y-4">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <input type="checkbox" id="seamlessBg" checked={isSeamlessBg}
                                onChange={(e) => { setIsSeamlessBg(e.target.checked); updateConfig && updateConfig({ isSeamlessBg: e.target.checked }); }}
                                className="w-3.5 h-3.5 rounded cursor-pointer" />
                            <label htmlFor="seamlessBg" className="text-xs text-[var(--text-main)] cursor-pointer font-bold">融合背景 (沉浸式)</label>
                        </div>
                        {!isSeamlessBg && (
                            <div className="flex items-center justify-between p-2 bg-[var(--app-bg)] rounded border border-[var(--border)]">
                                <span className="text-xs text-[var(--text-sub)]">工作区背景色</span>
                                <input type="color" value={workspaceBgColor || '#eff6ff'}
                                    onChange={(e) => setWorkspaceBgColor(e.target.value)}
                                    // onBlur removed
                                    className="w-5 h-5 border-0 rounded p-0 cursor-pointer" />
                            </div>
                        )}
                    </div>
                    <div className="h-px bg-[var(--border)]" />
                    <div className="flex justify-between items-center">
                        <label className="text-xs text-[var(--text-sub)]">角色默认色</label>
                        <input type="color" value={defaultCharColor || '#22c55e'}
                            onChange={(e) => { setDefaultCharColor(e.target.value); useEntityStore.getState().setDefaultCharColor(e.target.value); }}
                            // onBlur removed
                            className="w-5 h-5 border-0 rounded p-0 cursor-pointer" />
                    </div>
                    <div className="flex justify-between items-center">
                        <label className="text-xs text-[var(--text-sub)]">场景默认色</label>
                        <input type="color" value={defaultSceneColor || '#0ea5e9'}
                            onChange={(e) => { setDefaultSceneColor(e.target.value); useEntityStore.getState().setDefaultSceneColor(e.target.value); }}
                            // onBlur removed
                            className="w-5 h-5 border-0 rounded p-0 cursor-pointer" />
                    </div>
                    <div className="flex justify-between items-center">
                        <label className="text-xs text-[var(--text-sub)]">设定默认色</label>
                        <input type="color" value={defaultSettingColor || '#48bb78'}
                            onChange={(e) => { setDefaultSettingColor(e.target.value); useEntityStore.getState().setDefaultSettingColor(e.target.value); }}
                            // onBlur removed
                            className="w-5 h-5 border-0 rounded p-0 cursor-pointer" />
                    </div>
                </div>
            </SettingSection>

            {/* 专注模式设置 (手机端隐藏) */}
            {!isMobile && (
                <SettingSection title={<><Expand size={16} /> 专注模式设置</>}>
                    <div className="bg-[var(--panel-bg)] p-3 rounded-lg border border-[var(--border)] space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="text-xs text-[var(--text-sub)] font-bold">关联内容自动弹出</label>
                            <button onClick={() => { const newVal = !zenAutoPopup; setZenAutoPopup(newVal); }} className={`w-8 h-4 rounded-full relative ${zenAutoPopup ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}>
                                <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 left-0.5 transition-transform ${zenAutoPopup ? 'translate-x-4' : ''}`} />
                            </button>
                        </div>
                        <div className="flex justify-between items-center">
                            <label className="text-xs text-[var(--text-sub)] font-bold">悬浮卡片样式</label>
                            <select value={zenCardStyle} onChange={(e) => { setZenCardStyle(e.target.value); }} className="text-xs border border-[var(--border)] rounded px-1 py-0.5 bg-[var(--app-bg)] text-[var(--text-main)] outline-none">
                                {ZEN_CARD_STYLES && Object.entries(ZEN_CARD_STYLES).map(([key, style]) => (
                                    <option key={key} value={key}>{style.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </SettingSection>
            )}
        </>
    );
}
