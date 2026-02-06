// ==================================================
// File: frontend/src/features/settings/SettingsEditor.jsx
// [激进重构] 直接从 settingsStore 获取数据
// ==================================================
import React from 'react';
import { LayoutTemplate, Hash, MousePointerClick, Mouse, Orbit } from 'lucide-react';
import { useSettingsStore } from '../../stores';
import { useUser } from '../../contexts'; // [新增] 用于保存配置

// 设置区块组件
const SettingSection = ({ title, children }) => (
    <div className="mb-6 animate-in fade-in slide-in-from-left-2 duration-300">
        <h4 className="font-bold text-sm text-[var(--text-main)] mb-3 flex items-center gap-2 border-b border-[var(--border)] pb-2">{title}</h4>
        <div className="space-y-4">{children}</div>
    </div>
);

/**
 * [激进重构] 直接从 settingsStore 获取数据，删除 20+ props
 */
export default function SettingsEditor({ isMobile = false }) {
    // [新增] 用于保存配置到后端 (已移除: 自动保存由 EditorPage 接管)
    // const { updateConfig } = useUser();

    // 直接从 Store 获取
    const {
        editorMaxWidth, setEditorMaxWidth,
        chapterNumStyle, setChapterNumStyle,
        chapterNumberingMode, setChapterNumberingMode,
        collapseTrigger, setCollapseTrigger,
        singleExpand, setSingleExpand,
        mindMapWheelBehavior, setMindMapWheelBehavior,
        mobileSmartTooltip, setMobileSmartTooltip,
        graphRotationSpeed, setGraphRotationSpeed,
        isGraphRotationEnabled, setIsGraphRotationEnabled,
        isGraphEnabled, setIsGraphEnabled,
        isGraphShowInZen, setIsGraphShowInZen,
    } = useSettingsStore();

    return (
        <>
            {/* 排版与交互 (手机端隐藏) */}
            {!isMobile && (
                <SettingSection title={<><LayoutTemplate size={16} /> 排版与交互</>}>
                    <div className="bg-[var(--panel-bg)] p-3 rounded-lg border border-[var(--border)] space-y-3">
                        <div>
                            <label className="text-xs text-[var(--text-sub)] block mb-1">编辑器最大宽度</label>
                            <input type="range" min="500" max="2100" step="50" value={editorMaxWidth || 900}
                                onChange={(e) => setEditorMaxWidth(parseInt(e.target.value))}
                                // onMouseUp/onTouchEnd removed
                                className="w-full h-1.5 bg-[var(--border)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]" />
                            <div className="flex justify-between text-[10px] text-[var(--text-sub)] mt-1">
                                <span>{editorMaxWidth}px</span>
                                <span>无限制</span>
                            </div>
                        </div>
                    </div>
                </SettingSection>
            )}

            {/* 章节编号 */}
            <SettingSection title={<><Hash size={16} /> 章节编号</>}>
                <div className="flex flex-col gap-2">
                    <div className="flex bg-[var(--panel-bg)] rounded border border-[var(--border)] p-1 text-xs">
                        {[['chinese', '第一章'], ['number', '第1章'], ['none', '隐藏']].map(([val, label]) => (
                            <button key={val} onClick={() => { setChapterNumStyle(val); }} className={`flex-1 py-1 rounded ${chapterNumStyle === val ? 'bg-[var(--accent)] text-white font-bold' : 'text-[var(--text-sub)]'}`}>{label}</button>
                        ))}
                    </div>
                    <div className="flex bg-[var(--panel-bg)] rounded border border-[var(--border)] p-1 text-xs">
                        {[['reset', '每卷重置'], ['continuous', '连贯编号']].map(([val, label]) => (
                            <button key={val} onClick={() => { setChapterNumberingMode(val); }} className={`flex-1 py-1 rounded ${chapterNumberingMode === val ? 'bg-[var(--accent)] text-white font-bold' : 'text-[var(--text-sub)]'}`}>{label}</button>
                        ))}
                    </div>
                </div>
            </SettingSection>

            {/* 激活强制折叠 */}
            <SettingSection title={<><MousePointerClick size={16} /> 激活强制折叠</>}>
                <div className="flex bg-[var(--panel-bg)] rounded border border-[var(--border)] p-1 text-xs">
                    {[['click', '单击'], ['double', '双击'], ['triple', '三击']].map(([val, label]) => (
                        <button key={val} onClick={() => { setCollapseTrigger(val); }} className={`flex-1 py-1 rounded ${collapseTrigger === val ? 'bg-[var(--accent)] text-white font-bold' : 'text-[var(--text-sub)]'}`}>{label}</button>
                    ))}
                </div>
                <div className="bg-[var(--panel-bg)] p-3 rounded-lg border border-[var(--border)] mt-2">
                    <div className="flex items-center justify-between">
                        <label className="text-xs text-[var(--text-main)] font-bold">唯一展开模式</label>
                        <button onClick={() => { const newVal = !singleExpand; setSingleExpand(newVal); }} className={`w-10 h-5 rounded-full relative ${singleExpand ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}>
                            <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 left-0.5 transition-transform ${singleExpand ? 'translate-x-5' : ''}`} />
                        </button>
                    </div>
                    <span className="text-[10px] text-[var(--text-sub)] block mt-1">展开一个卷/章节时，自动折叠其他同级节点</span>
                </div>
            </SettingSection>

            {/* 导图缩放行为 (手机端隐藏) */}
            {!isMobile && (
                <SettingSection title={<><Mouse size={16} /> 导图缩放行为</>}>
                    <div className="flex bg-[var(--panel-bg)] rounded border border-[var(--border)] p-1 text-xs">
                        {[['ctrl', 'Ctrl+滚轮'], ['direct', '直接滚轮']].map(([val, label]) => (
                            <button key={val} onClick={() => { setMindMapWheelBehavior(val); }} className={`flex-1 py-1 rounded ${mindMapWheelBehavior === val ? 'bg-[var(--accent)] text-white font-bold' : 'text-[var(--text-sub)]'}`}>{label}</button>
                        ))}
                    </div>
                </SettingSection>
            )}

            {/* 性能模式 (仅手机端) */}
            {isMobile && (
                <SettingSection title={<><LayoutTemplate size={16} /> 性能模式</>}>
                    <div className="bg-[var(--panel-bg)] p-3 rounded-lg border border-[var(--border)] space-y-3">
                        <div className="flex justify-between items-center">
                            <div>
                                <label className="text-xs text-[var(--text-main)] font-bold block">性能优先</label>
                                <span className="text-[10px] text-[var(--text-sub)]">关闭模糊、动画等效果</span>
                            </div>
                            <button onClick={() => { const current = localStorage.getItem('mobile_perf_mode') === 'true'; localStorage.setItem('mobile_perf_mode', (!current).toString()); window.location.reload(); }}
                                className={`w-10 h-5 rounded-full relative ${localStorage.getItem('mobile_perf_mode') === 'true' ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}>
                                <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 left-0.5 transition-transform ${localStorage.getItem('mobile_perf_mode') === 'true' ? 'translate-x-5' : ''}`} />
                            </button>
                        </div>
                    </div>
                </SettingSection>
            )}

            {/* 智能气泡提示 (仅手机端) */}
            {isMobile && (
                <SettingSection title={<><MousePointerClick size={16} /> 智能气泡提示</>}>
                    <div className="bg-[var(--panel-bg)] p-3 rounded-lg border border-[var(--border)] space-y-3">
                        <div className="flex justify-between items-center">
                            <div>
                                <label className="text-xs text-[var(--text-main)] font-bold block">输入匹配提示</label>
                                <span className="text-[10px] text-[var(--text-sub)]">自动弹出信息卡片</span>
                            </div>
                            <button onClick={() => { const newVal = !mobileSmartTooltip; setMobileSmartTooltip(newVal); }}
                                className={`w-10 h-5 rounded-full relative ${mobileSmartTooltip ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}>
                                <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 left-0.5 transition-transform ${mobileSmartTooltip ? 'translate-x-5' : ''}`} />
                            </button>
                        </div>
                    </div>
                </SettingSection>
            )}

            {/* 角色关系图设置 */}
            <SettingSection title={<><Orbit size={16} /> 角色关系图设置</>}>
                <div className="bg-[var(--panel-bg)] p-3 rounded-lg border border-[var(--border)] space-y-4">
                    <div className="flex items-center gap-2">
                        <input type="checkbox" id="enableGraph" checked={isGraphEnabled} onChange={(e) => { setIsGraphEnabled(e.target.checked); }} className="w-3.5 h-3.5 rounded cursor-pointer" />
                        <label htmlFor="enableGraph" className="text-xs text-[var(--text-main)] cursor-pointer font-bold">显示角色关系图</label>
                    </div>
                    <div className="flex items-center gap-2">
                        <input type="checkbox" id="graphShowInZen" checked={isGraphShowInZen} onChange={(e) => { setIsGraphShowInZen(e.target.checked); }} className="w-3.5 h-3.5 rounded cursor-pointer" />
                        <label htmlFor="graphShowInZen" className="text-xs text-[var(--text-main)] cursor-pointer font-bold">在专注模式下显示</label>
                    </div>
                    <div className="flex items-center gap-2">
                        <input type="checkbox" id="enableRotation" checked={isGraphRotationEnabled} onChange={(e) => { setIsGraphRotationEnabled(e.target.checked); }} className="w-3.5 h-3.5 rounded cursor-pointer" />
                        <label htmlFor="enableRotation" className="text-xs text-[var(--text-main)] cursor-pointer font-bold">开启自动旋转</label>
                    </div>
                    <div className={`space-y-1 ${isGraphRotationEnabled ? '' : 'opacity-50 pointer-events-none'}`}>
                        <div className="flex justify-between items-center">
                            <label className="text-xs text-[var(--text-sub)]">旋转速度</label>
                            <span className="text-xs text-[var(--text-sub)] font-mono">{Math.round(graphRotationSpeed * 1000)}</span>
                        </div>
                        <input type="range" min="1" max="10" step="1" value={graphRotationSpeed * 1000}
                            onChange={(e) => setGraphRotationSpeed(e.target.value / 1000)}
                            // onMouseUp/onTouchEnd removed
                            className="w-full h-1.5 bg-[var(--border)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]" disabled={!isGraphRotationEnabled} />
                    </div>
                </div>
            </SettingSection>
        </>
    );
}
