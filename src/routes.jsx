import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import EditorPage from './pages/EditorPage';
import LoginTrigger from './components/LoginTrigger';

export default function AppRouter() {
    return (
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
                <Route path="/" element={<EditorPage />} />
                {/* 隐藏的登录入口：访问此路径触发退出并打开登录框，然后自动跳回主页 */}
                <Route path="/user-login" element={<LoginTrigger />} />
                {/* 404 fallback：未知路径强制重定向到主页，不保留错误 URL */}
                <Route path="*" element={<Navigate to="/" replace={true} />} />
            </Routes>
        </Router>
    );
}
