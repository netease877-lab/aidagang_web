// ==================================================
// File: frontend/src/contexts/index.js
// Context 统一导出
// [激进重构] 删除 EditorContext
// ==================================================

export { ToastProvider, useToast } from './ToastContext';
export { UserProvider, useUser } from './UserContext';
// export { EntityProvider, useEntity } from './EntityContext'; // Deleted
// export { OutlineProvider, useOutline } from './OutlineContext'; // Deleted
export { NovelProvider, useNovel } from './NovelContext';
