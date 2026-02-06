// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import AppRouter from './routes.jsx';
import './index.css';
import { ToastProvider, UserProvider, NovelProvider } from './contexts';

// [新增] PWA 自动更新机制
import { registerSW } from 'virtual:pwa-register';

// 自动更新 SW，每小时检查一次
const updateSW = registerSW({
  onNeedRefresh() {
    console.log('[PWA] New content available, updating...');
    updateSW(true); // 自动更新
  },
  onOfflineReady() {
    console.log('[PWA] App ready to work offline');
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ToastProvider>
      <UserProvider>
        <NovelProvider>
          <AppRouter />
        </NovelProvider>
      </UserProvider>
    </ToastProvider>
  </React.StrictMode>
);