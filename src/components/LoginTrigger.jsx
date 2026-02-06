import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts'; // [修正] 从索引文件导入，而不是直接从 UserContext

export default function LoginTrigger() {
    const navigate = useNavigate();
    const { setIsLoginOpen, logout } = useUser(); // [修复] 使用 logout 替代 setIsAuthenticated

    useEffect(() => {
        // 1. 执行完整的登出流程（删除 token + 清空用户数据 + 重置缓存）
        logout();
        // 2. 打开登录弹窗
        setIsLoginOpen(true);
        // 3. 瞬间跳回主页，不留痕迹
        navigate('/', { replace: true });
    }, [navigate, setIsLoginOpen, logout]);

    return null; // 不渲染任何 UI
}
