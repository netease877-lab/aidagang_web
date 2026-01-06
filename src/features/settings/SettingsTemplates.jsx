import React, { useState } from 'react';
import { useDeleteConfirm } from '../../hooks/useDeleteConfirm';
import {
  Lock, RotateCcw, Edit3, X, Save, Plus, Eye, EyeOff, FileText, Trash2
} from 'lucide-react';
import { DEFAULT_CHAPTER_TEMPLATES, DEFAULT_CHAR_FIELDS } from '../../constants.js';
import { fetchAPI } from '../../services/api'; // [新增] 引入 API 服务

import { useSettingsStore } from '../../stores/settingsStore'; // [修复] 从 settingsStore 读取用户模板配置
import { useEntityStore } from '../../stores/entityStore'; // [修复] 同步到 entityStore 以供 handleAddChildNode 使用

// 子菜单项组件 (复用)
const SettingSection = ({ title, children }) => (
  <div className="mb-6 animate-in fade-in slide-in-from-left-2 duration-300">
    <h4 className="font-bold text-sm text-[var(--text-main)] mb-3 flex items-center gap-2 border-b border-[var(--border)] pb-2">
      {title}
    </h4>
    <div className="space-y-4">{children}</div>
  </div>
);

// [优化] 模版项组件 - 支持内联删除确认
const TemplateItem = ({ t, idx, isEditing, editBuffer, setEditBuffer, onStartEdit, onSave, onDelete, onCancelEdit, isMobile }) => {
  const [deleteConfirming, requestConfirm] = useDeleteConfirm();

  if (isEditing) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2"><input className="flex-1 font-bold text-[var(--text-main)] bg-[var(--app-bg)] border border-[var(--border)] rounded px-2 py-1 outline-none focus:border-[var(--accent)]" value={editBuffer.title} onChange={(e) => setEditBuffer({ ...editBuffer, title: e.target.value })} placeholder="模版标题" /></div>
        <textarea className="w-full h-20 bg-[var(--app-bg)] text-[var(--text-main)] border border-[var(--border)] rounded p-2 outline-none resize-none focus:border-[var(--accent)] custom-scrollbar" value={editBuffer.placeholder} onChange={(e) => setEditBuffer({ ...editBuffer, placeholder: e.target.value })} placeholder="预设内容..." />
        <div className="flex justify-end gap-2 mt-1"><button onClick={onCancelEdit} className="px-2 py-1 rounded border border-[var(--border)] text-[var(--text-sub)] hover:bg-[var(--hover-bg)] flex items-center gap-1"><RotateCcw size={12} /> 取消</button><button onClick={() => onSave(idx)} className="px-2 py-1 rounded bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 flex items-center gap-1"><Save size={12} /> 保存</button></div>
      </div>
    );
  }

  return (
    <div className="group relative">
      <div className="flex justify-between items-start mb-1">
        <span className="font-bold text-[var(--text-main)]">{t.title}</span>
        <div className={`flex items-center gap-1 transition-opacity ${isMobile ? 'opacity-100' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100'}`}>
          <button onClick={() => onStartEdit(idx, t)} className="p-1 text-[var(--text-sub)] hover:text-[var(--accent)] hover:bg-[var(--hover-bg)] rounded" title="编辑"><Edit3 size={14} /></button>
          <button
            onClick={() => deleteConfirming ? onDelete(idx) : requestConfirm()}
            className={`p-1 rounded transition-all flex items-center justify-center min-w-[24px] ${deleteConfirming ? 'bg-red-500 text-white hover:bg-red-600 px-1.5' : 'text-[var(--text-sub)] hover:text-red-500 hover:bg-[var(--hover-bg)]'}`}
            title="删除"
          >
            {deleteConfirming ? <span className="text-[10px] font-bold whitespace-nowrap">确定?</span> : <X size={14} />}
          </button>
        </div>
      </div>
      <div className="text-[var(--text-sub)] opacity-70 truncate text-[10px] leading-relaxed pr-8">{t.placeholder || "(无预设内容)"}</div>
    </div>
  );
};

// [优化] 字段项组件 - 支持内联删除确认
const FieldItem = ({ f, idx, isEditing, editBuffer, setEditBuffer, onStartEdit, onSave, onDelete, onCancelEdit, onToggleVisibility }) => {
  const [deleteConfirming, requestConfirm] = useDeleteConfirm();

  if (isEditing) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex gap-2"><input className="w-24 font-bold text-[var(--text-main)] bg-[var(--app-bg)] border border-[var(--border)] rounded px-2 py-1 outline-none focus:border-[var(--accent)]" value={editBuffer.label} onChange={(e) => setEditBuffer({ ...editBuffer, label: e.target.value })} placeholder="字段名" /><input className="flex-1 text-[var(--text-main)] bg-[var(--app-bg)] border border-[var(--border)] rounded px-2 py-1 outline-none focus:border-[var(--accent)]" value={editBuffer.placeholder} onChange={(e) => setEditBuffer({ ...editBuffer, placeholder: e.target.value })} placeholder="提示语" /></div>
        <div className="flex justify-end gap-2"><button onClick={onCancelEdit} className="p-1 rounded hover:bg-[var(--hover-bg)] text-[var(--text-sub)]"><RotateCcw size={14} /></button><button onClick={() => onSave(idx)} className="p-1 rounded bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90"><Save size={14} /></button></div>
      </div>
    );
  }

  return (
    <div className="flex justify-between items-center group">
      <div className="flex-1 flex items-center gap-2 overflow-hidden"><span className="font-bold text-[var(--text-main)] shrink-0">{f.label}</span><span className="text-[var(--border)]">|</span><span className="text-[var(--text-sub)] opacity-70 truncate flex-1">{f.placeholder || "..."}</span></div>
      <div className="flex items-center gap-1">
        <button onClick={() => onToggleVisibility(idx)} className={`p-1 rounded transition-colors ${f.showInCard !== false ? 'text-[var(--accent)] bg-[var(--accent-bg)]' : 'text-[var(--text-sub)] hover:bg-[var(--hover-bg)]'}`} title={f.showInCard !== false ? "在悬浮卡片中显示" : "在悬浮卡片中隐藏"}>{f.showInCard !== false ? <Eye size={14} /> : <EyeOff size={14} />}</button>
        <div className="w-px h-3 bg-[var(--border)] mx-1"></div>
        <button onClick={() => onStartEdit(idx, f)} className="p-1 text-[var(--text-sub)] hover:text-[var(--accent)] hover:bg-[var(--hover-bg)] rounded" title="编辑"><Edit3 size={14} /></button>
        <button
          onClick={() => deleteConfirming ? onDelete(idx) : requestConfirm()}
          className={`p-1 rounded transition-all flex items-center justify-center min-w-[24px] ${deleteConfirming ? 'bg-red-500 text-white hover:bg-red-600 px-1.5' : 'text-[var(--text-sub)] hover:text-red-500 hover:bg-[var(--hover-bg)]'}`}
          title="删除"
        >
          {deleteConfirming ? <span className="text-[10px] font-bold whitespace-nowrap">确定?</span> : <X size={14} />}
        </button>
      </div>
    </div>
  );
};

export default function SettingsTemplates({
  isMobile,
  setConfirmDialog
}) {
  // [修复] 从 settingsStore 读取用户模板配置（而非小说数据存储entityStore）
  const chapterTemplates = useSettingsStore(state => state.chapterTemplates);
  const setChapterTemplatesStore = useSettingsStore(state => state.setChapterTemplates);
  const charFields = useSettingsStore(state => state.charFields);
  const setCharFieldsStore = useSettingsStore(state => state.setCharFields);

  // [Refactor] No longer using NovelContext setters. AutoSave subscribes to EntityStore.
  // const { setChapterTemplates: setNovelContextTemplates, setCharFields: setNovelContextCharFields } = useNovel();

  // [修复] 在渲染层做 fallback：数据为空时使用默认模版
  const safeTemplates = (Array.isArray(chapterTemplates) && chapterTemplates.length > 0)
    ? chapterTemplates
    : DEFAULT_CHAPTER_TEMPLATES;
  const safeFields = (Array.isArray(charFields) && charFields.length > 0)
    ? charFields
    : DEFAULT_CHAR_FIELDS;

  const [newTemplate, setNewTemplate] = useState({ title: '', placeholder: '' });
  const [editingTemplateIdx, setEditingTemplateIdx] = useState(null);
  const [editTemplateBuffer, setEditTemplateBuffer] = useState({ title: '', placeholder: '' });

  const [newField, setNewField] = useState({ label: '', placeholder: '', showInCard: true });
  const [editingFieldIdx, setEditingFieldIdx] = useState(null);
  const [editFieldBuffer, setEditFieldBuffer] = useState({ label: '', placeholder: '', showInCard: true });

  // [重构] 统一保存模板到用户配置（主数据），再同步到 entityStore
  const saveTemplates = async (newTemplates) => {
    try {
      await fetchAPI('/api/users/me', 'PATCH', { config: { chapterTemplates: newTemplates } });
      // [修复] 同时更新 settingsStore 和 entityStore
      setChapterTemplatesStore(newTemplates);
      useEntityStore.getState().setChapterTemplates(newTemplates);
    } catch (e) {
      console.error('[Template] 保存失败:', e);
    }
  };

  // [重构] 统一保存字段到用户配置（主数据），再同步到 entityStore
  const saveFields = async (newFields) => {
    try {
      await fetchAPI('/api/users/me', 'PATCH', { config: { charFields: newFields } });
      // [修复] 同时更新 settingsStore 和 entityStore
      setCharFieldsStore(newFields);
      useEntityStore.getState().setCharFields(newFields);
    } catch (e) {
      console.error('[Field] 保存失败:', e);
    }
  };

  const handleAddTemplate = () => {
    if (!newTemplate.title.trim()) return;
    saveTemplates([...safeTemplates, { ...newTemplate }]);
    setNewTemplate({ title: '', placeholder: '' });
  };
  const startEditTemplate = (idx, t) => { setEditingTemplateIdx(idx); setEditTemplateBuffer({ ...t }); };
  const saveEditTemplate = (idx) => {
    const newTemplates = [...safeTemplates];
    newTemplates[idx] = editTemplateBuffer;
    saveTemplates(newTemplates);
    setEditingTemplateIdx(null);
  };
  const deleteTemplate = (idx) => {
    saveTemplates(safeTemplates.filter((_, i) => i !== idx));
    if (editingTemplateIdx === idx) setEditingTemplateIdx(null);
  };

  const handleAddField = () => {
    if (!newField.label.trim()) return;
    saveFields([...safeFields, { ...newField }]);
    setNewField({ label: '', placeholder: '', showInCard: true });
  };
  const startEditField = (idx, f) => { setEditingFieldIdx(idx); setEditFieldBuffer({ ...f }); };
  const saveEditField = (idx) => {
    const newFields = [...safeFields];
    newFields[idx] = editFieldBuffer;
    saveFields(newFields);
    setEditingFieldIdx(null);
  };
  const deleteField = (idx) => {
    saveFields(safeFields.filter((_, i) => i !== idx));
    if (editingFieldIdx === idx) setEditingFieldIdx(null);
  };
  const toggleFieldVisibility = (idx) => {
    const newFields = safeFields.map((field, i) => {
      if (i === idx) {
        return { ...field, showInCard: field.showInCard === false ? true : false };
      }
      return field;
    });
    saveFields(newFields);
  };


  return (
    <SettingSection title={<><Lock size={16} /> 模版与字段管理</>}>
      <div className="space-y-6">
        <div>
          <div className="flex justify-between items-center mb-3"><span className="text-xs font-bold text-[var(--text-main)] border-l-2 border-[var(--accent)] pl-2">章节预设模版</span><button onClick={() => setConfirmDialog({ visible: true, message: '确定要恢复章节预设模版为默认值吗？', onConfirm: () => setChapterTemplatesStore(DEFAULT_CHAPTER_TEMPLATES) })} className="text-[var(--text-sub)] hover:text-[var(--accent)] transition-colors" title="恢复默认"><RotateCcw size={14} /></button></div>
          <div className="space-y-3">
            {safeTemplates.map((t, idx) => (
              <div key={idx} className={`bg-[var(--panel-bg)] border rounded-lg p-3 text-xs shadow-sm transition-all ${editingTemplateIdx === idx ? 'ring-2 ring-[var(--accent)] border-transparent' : 'border-[var(--border)]'}`}>
                <TemplateItem
                  t={t}
                  idx={idx}
                  isEditing={editingTemplateIdx === idx}
                  editBuffer={editTemplateBuffer}
                  setEditBuffer={setEditTemplateBuffer}
                  onStartEdit={startEditTemplate}
                  onSave={saveEditTemplate}
                  onDelete={deleteTemplate}
                  onCancelEdit={() => setEditingTemplateIdx(null)}
                  isMobile={isMobile}
                />
              </div>
            ))}

            <div className="mt-4 p-3 border-2 border-dashed border-[var(--border)]/50 rounded-lg bg-[var(--app-bg)]/30 hover:bg-[var(--app-bg)] transition-colors">
              <input className="w-full text-xs font-bold text-[var(--text-main)] bg-transparent border-b border-[var(--border)] focus:border-[var(--accent)] outline-none py-1 mb-2 px-1" value={newTemplate.title} onChange={(e) => setNewTemplate({ ...newTemplate, title: e.target.value })} placeholder="输入新模版标题..." />
              <textarea className="w-full text-xs text-[var(--text-sub)] bg-[var(--panel-bg)] border border-[var(--border)] rounded p-2 outline-none resize-none focus:border-[var(--accent)] h-16 mb-2 custom-scrollbar" value={newTemplate.placeholder} onChange={(e) => setNewTemplate({ ...newTemplate, placeholder: e.target.value })} placeholder="输入预设内容..." />
              <button onClick={handleAddTemplate} disabled={!newTemplate.title.trim()} className={`w-full py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1 transition-all ${newTemplate.title.trim() ? 'bg-[var(--accent)] text-white hover:shadow-md' : 'bg-[var(--border)] text-[var(--text-sub)] cursor-not-allowed'}`}><Plus size={14} /> 添加模版</button>
            </div>
          </div>
        </div>
        <div className="border-t border-[var(--border)]"></div>
        <div>
          <div className="flex justify-between items-center mb-3"><span className="text-xs font-bold text-[var(--text-main)] border-l-2 border-[var(--accent)] pl-2">角色属性字段</span><button onClick={() => setConfirmDialog({ visible: true, message: '确定要恢复角色属性字段为默认值吗？', onConfirm: () => setCharFieldsStore(DEFAULT_CHAR_FIELDS) })} className="text-[var(--text-sub)] hover:text-[var(--accent)] transition-colors" title="恢复默认"><RotateCcw size={14} /></button></div>
          <div className="space-y-2">
            {safeFields.map((f, idx) => (
              <div key={idx} className={`bg-[var(--panel-bg)] border rounded-lg p-2.5 text-xs shadow-sm transition-all ${editingFieldIdx === idx ? 'ring-2 ring-[var(--accent)] border-transparent' : 'border-[var(--border)]'}`}>
                <FieldItem
                  f={f}
                  idx={idx}
                  isEditing={editingFieldIdx === idx}
                  editBuffer={editFieldBuffer}
                  setEditBuffer={setEditFieldBuffer}
                  onStartEdit={startEditField}
                  onSave={saveEditField}
                  onDelete={deleteField}
                  onCancelEdit={() => setEditingFieldIdx(null)}
                  onToggleVisibility={toggleFieldVisibility}
                />
              </div>
            ))}

            <div className="mt-3 p-2 border-2 border-dashed border-[var(--border)]/50 rounded-lg bg-[var(--app-bg)]/30 hover:bg-[var(--app-bg)] transition-colors flex flex-col gap-2 overflow-hidden">
              <div className="flex gap-2 min-w-0"><input className="w-24 shrink-0 text-xs font-bold text-[var(--text-main)] bg-[var(--panel-bg)] border border-[var(--border)] rounded px-2 py-1 outline-none focus:border-[var(--accent)]" value={newField.label} onChange={(e) => setNewField({ ...newField, label: e.target.value })} placeholder="新字段名" /><input className="flex-1 min-w-0 text-xs text-[var(--text-sub)] bg-[var(--panel-bg)] border border-[var(--border)] rounded px-2 py-1 outline-none focus:border-[var(--accent)]" value={newField.placeholder} onChange={(e) => setNewField({ ...newField, placeholder: e.target.value })} placeholder="提示内容..." /></div>
              <button onClick={handleAddField} disabled={!newField.label.trim()} className={`w-full py-1 rounded text-xs font-bold flex items-center justify-center gap-1 transition-all ${newField.label.trim() ? 'bg-[var(--accent)] text-white hover:shadow-md' : 'bg-[var(--border)] text-[var(--text-sub)] cursor-not-allowed'}`}><Plus size={14} /> 添加字段</button>
            </div>
          </div>
        </div>
      </div>
    </SettingSection>
  );
}
