// ==================================================
// File: frontend/src/components/LoginModal.jsx
// ==================================================
import React, { useState, useEffect } from 'react';
import { X, User, Lock, RefreshCw, ShieldAlert } from 'lucide-react';
import { apiClient } from '../services/api';

export default function LoginModal({ isOpen, onClose, onLoginSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // 验证码状态
  const [captchaUrl, setCaptchaUrl] = useState('');
  const [captchaId, setCaptchaId] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [showCaptcha, setShowCaptcha] = useState(true); // 是否需要显示验证码

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 1. 获取登录配置（是否需要验证码）
  const fetchAuthConfig = async () => {
    try {
      const json = await apiClient.get('/api/auth/config');
      const config = json.data || {};
      setShowCaptcha(config.enable_login_captcha);
      if (config.enable_login_captcha) {
        refreshCaptcha();
      }
    } catch (e) {
      console.error("获取认证配置失败", e);
    }
  };

  // 2. 刷新验证码
  const refreshCaptcha = async () => {
    try {
      const data = await apiClient.get('/api/auth/captcha');
      setCaptchaUrl(data.image_base64); // 后端直接返回 base64 字符串
      setCaptchaId(data.captcha_id);
      setCaptchaCode('');
    } catch (e) {
      console.error("验证码加载失败", e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setError('');
      fetchAuthConfig();
    }
  }, [isOpen, isRegister]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    setError('');

    if (!username.trim() || !password.trim()) {
      setError("请输入用户名和密码");
      return;
    }

    setLoading(true);
    try {
      if (isRegister) {
        // --- 注册逻辑 ---
        // [新增] 用户名长度验证
        if (username.trim().length < 6) {
          throw new Error("用户名不符合要求");
        }
        if (showCaptcha && !captchaCode) {
          throw new Error("请输入验证码");
        }

        const payload = {
          email: username.trim(),
          password: password.trim(),
          // is_active/is_superuser 等字段无需前端传，后端有默认逻辑
          // 但如果旧代码传了，我也保留着，除了 captcha
          nickname: username.trim(),
          captcha_code: captchaCode.trim(),
          captcha_id: captchaId.trim()
        };

        const res = await apiClient.post('/api/auth/register', payload);

        // apiClient 已处理 JSON 解析和状态码检查
        if (res?.detail === "REGISTER_USER_ALREADY_EXISTS") {
          if (showCaptcha) refreshCaptcha();
          throw new Error("该用户名已被注册");
        }
        if (res?.error || res?.detail) {
          if (showCaptcha) refreshCaptcha();
          throw new Error(res.detail || res.error || '注册失败');
        }

        alert('注册成功，请登录');
        setIsRegister(false);
        // 注册成功后切换回登录，可能需要刷新验证码
        if (showCaptcha) refreshCaptcha();
      } else {
        // --- 登录逻辑 ---
        if (showCaptcha && !captchaCode) {
          throw new Error("请输入验证码");
        }

        const data = await apiClient.post('/api/auth/login_secure', {
          username: username.trim(),
          password: password.trim(),
          captcha_code: captchaCode.trim(),
          captcha_id: captchaId.trim()
        });

        if (data?.error || data?.detail) {
          if (showCaptcha) refreshCaptcha();
          throw new Error(data.detail || data.error || '登录失败');
        }

        // 登录成功
        localStorage.setItem('novel_token', data.access_token);
        onLoginSuccess(username);
        onClose();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[var(--panel-bg)] w-80 rounded-xl shadow-2xl border border-[var(--border)] p-6 animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-bold text-[var(--text-main)] text-lg">{isRegister ? '注册账号' : '安全登录'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-[var(--hover-bg)] rounded-full transition"><X size={20} className="text-[var(--text-sub)]" /></button>
        </div>

        <div className="space-y-4">
          {/* 用户名输入 */}
          <div className="relative">
            <User size={16} className="absolute left-3 top-3 text-[var(--text-sub)]" />
            <input
              className="w-full pl-9 p-2.5 rounded-lg border border-[var(--border)] bg-[var(--app-bg)] text-[var(--text-main)] text-sm outline-none focus:border-[var(--accent)] transition-colors"
              placeholder="用户名 (任意字符)"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoFocus
            />
          </div>

          {/* 密码输入 */}
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-3 text-[var(--text-sub)]" />
            <input
              type="password"
              className="w-full pl-9 p-2.5 rounded-lg border border-[var(--border)] bg-[var(--app-bg)] text-[var(--text-main)] text-sm outline-none focus:border-[var(--accent)] transition-colors"
              placeholder="密码"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          {/* 验证码区域 (登录/注册并在配置开启时显示) */}
          {showCaptcha && (
            <div className="flex gap-2 h-[42px]">
              <div className="relative flex-1 h-full">
                <ShieldAlert size={16} className="absolute left-3 top-3 text-[var(--text-sub)]" />
                <input
                  className="w-full h-full pl-9 p-2.5 rounded-lg border border-[var(--border)] bg-[var(--app-bg)] text-[var(--text-main)] text-sm outline-none focus:border-[var(--accent)] uppercase font-mono transition-colors"
                  placeholder="验证码"
                  value={captchaCode}
                  onChange={e => setCaptchaCode(e.target.value)}
                  maxLength={4}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                />
              </div>
              <div className="w-24 h-full bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden border border-[var(--border)] cursor-pointer relative group flex-shrink-0" onClick={refreshCaptcha} title="点击刷新">
                {captchaUrl ? (
                  <img src={captchaUrl} alt="验证码" className="w-full h-full object-fill" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">加载中</div>
                )}
                <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                  <RefreshCw size={14} className="text-white drop-shadow-md" />
                </div>
              </div>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div className="text-red-500 text-xs bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-100 dark:border-red-900/30 flex items-start gap-1">
              <span className="shrink-0">⚠️</span> <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-2.5 bg-[var(--accent)] text-white rounded-lg font-bold text-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 shadow-md shadow-[var(--accent)]/20"
          >
            {loading ? '处理中...' : (isRegister ? '立即注册' : '登 录')}
          </button>

          <div className="text-center text-xs text-[var(--text-sub)]">
            {isRegister ? '已有账号？' : '还没有账号？'}
            <button onClick={() => setIsRegister(!isRegister)} className="text-[var(--accent)] font-bold ml-1 hover:underline">
              {isRegister ? '去登录' : '去注册'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}