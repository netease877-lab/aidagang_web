import React, { useState, useEffect } from 'react';
import { Sparkles, Users, BookOpen, Map } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ZEN_CARD_STYLES, DEFAULT_CHAR_FIELDS } from '../../../constants';
import { useEntityStore } from '../../../stores/entityStore';  // [激进重构] 直接订阅 entityStore

export const HighlightText = ({ text, keyword }) => {
  if (!keyword || !text) return <>{text}</>;
  const safeKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${safeKeyword})`, 'gi'));
  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === keyword.toLowerCase() ?
          <span key={i} className="bg-[var(--accent)]/20 text-[var(--accent)] font-bold px-0.5 rounded mx-0.5 border border-[var(--accent)]/30">{part}</span> :
          part
      )}
    </span>
  );
};

// [激进重构] 移除 charCats/sceneCats/settingCats/defaultColors/charFields props，改为从 Store 获取
export const ZenSmartWidget = ({ smartContextData, autoPopup, cardStyleKey, showAllFields = false }) => {
  // [激进重构] 直接从 entityStore 获取实体分类和配置
  const { charCats, sceneCats, settingCats, defaultCharColor, defaultSceneColor, defaultSettingColor, charFields } = useEntityStore();
  const [isOpen, setIsOpen] = useState(false);
  const hasContent = smartContextData.chars.length > 0 || smartContextData.scenes.length > 0 || smartContextData.settings.length > 0;

  useEffect(() => {
    if (hasContent) {
      if (autoPopup) {
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    }
  }, [smartContextData.nodeId, smartContextData.timestamp, autoPopup, hasContent]);

  if (!hasContent) return null;

  const currentStyle = ZEN_CARD_STYLES[cardStyleKey] || ZEN_CARD_STYLES.glass;

  return (
    <div className="absolute top-32 right-6 z-50 group flex flex-col items-end" onMouseEnter={() => setIsOpen(true)} onMouseLeave={() => setIsOpen(false)}>
      <div className={`flex items-center gap-2 px-3 py-2 rounded-full shadow-md cursor-pointer transition-all duration-300 ${isOpen ? 'bg-[var(--panel-bg)] text-[var(--accent)] ring-2 ring-[var(--accent-bg)]' : 'bg-[var(--panel-bg)]/80 hover:bg-[var(--panel-bg)] text-[var(--text-sub)] backdrop-blur-sm'}`}>
        <Sparkles size={16} className={isOpen ? 'text-[var(--accent)] animate-pulse' : ''} />
        <span className="text-xs font-bold text-[var(--text-main)]">{smartContextData.chars.length + smartContextData.scenes.length + smartContextData.settings.length}</span>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.2 }}
            className={`mt-2 w-80 overflow-hidden origin-top-right ${currentStyle.container}`}
            style={{ maxHeight: 'calc(100vh - 160px)' }}
          >
            <div className="p-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {/* 角色列表 */}
              {charCats.map(cat => {
                const matchedChars = smartContextData.chars.filter(c => c.categoryId === cat.id);
                if (matchedChars.length === 0) return null;
                const borderColor = cat.color || defaultCharColor;
                return (
                  <div key={cat.id} className="mb-4">
                    <h5 className="font-bold text-sm mb-2 flex items-center gap-1.5 opacity-60" style={{ color: borderColor }}>{cat.name}</h5>
                    {matchedChars.map(c => (
                      <div key={c.id} className={`p-3 transition-colors opacity-90 ${currentStyle.card}`} style={{ borderColor: borderColor }}>
                        <div className="font-bold text-base flex items-center text-[var(--text-main)] mb-2 border-b border-[var(--border)] pb-1"><HighlightText text={c.name} keyword={c.name} /></div>
                        {((charFields?.length > 0) ? charFields : DEFAULT_CHAR_FIELDS).map(field => {
                          // [新增] showAllFields 时忽略 showInCard 设置
                          if (!showAllFields && field.showInCard === false) return null;
                          const val = c.extra_fields?.[field.label];
                          if (!val) return null;
                          return (<div key={field.label} className="text-sm leading-relaxed text-[var(--text-main)] mt-1 flex flex-wrap gap-x-1 items-baseline"><span className="text-[10px] font-bold text-[var(--text-sub)] opacity-80 flex-shrink-0 whitespace-nowrap">{field.label}:</span><span className="opacity-90 break-all">{val}</span></div>);
                        })}
                      </div>
                    ))}
                  </div>
                );
              })}
              {/* 场景列表 */}
              {sceneCats.map(cat => {
                const matchedScenes = smartContextData.scenes.filter(s => s.categoryId === cat.id);
                if (matchedScenes.length === 0) return null;
                const borderColor = cat.color || defaultSceneColor;
                return (
                  <div key={cat.id} className="mb-4">
                    <h5 className="font-bold text-sm mb-2 flex items-center gap-1.5 opacity-90" style={{ color: borderColor }}>{cat.name}</h5>
                    {matchedScenes.map(s => (
                      <div key={s.id} className={`p-3 transition-colors ${currentStyle.card}`} style={{ borderColor: borderColor }}>
                        <div className="font-bold text-base flex items-center text-[var(--text-main)] mb-1"><HighlightText text={s.name} keyword={s.name} /></div>
                        <div className="text-sm opacity-80 leading-relaxed text-[var(--text-sub)] whitespace-pre-wrap">{s.desc}</div>
                      </div>
                    ))}
                  </div>
                );
              })}
              {/* 设定列表 */}
              {settingCats.map(cat => {
                const matchedSettings = smartContextData.settings.filter(s => s.categoryId === cat.id);
                if (matchedSettings.length === 0) return null;
                const borderColor = cat.color || defaultSettingColor;
                return (
                  <div key={cat.id} className="mb-4">
                    <h5 className="font-bold text-sm mb-2 flex items-center gap-1.5 opacity-90" style={{ color: borderColor }}>{cat.name}</h5>
                    {matchedSettings.map(s => (
                      <div key={s.id} className={`p-3 transition-colors ${currentStyle.card}`} style={{ borderColor: borderColor }}>
                        <div className="font-bold text-base flex items-center text-[var(--text-main)] mb-1"><HighlightText text={s.name} keyword={s.name} /></div>
                        <div className="text-sm opacity-80 leading-relaxed text-[var(--text-sub)] whitespace-pre-wrap">{s.desc}</div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
