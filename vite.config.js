import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    // [新增] PWA 离线支持配置
    VitePWA({
      // 开发模式也启用 (用于测试)
      devOptions: {
        enabled: true,
        type: 'classic', // [修改] 使用 classic 类型以支持 importScripts
      },
      // 注册策略：自动注册 Service Worker
      registerType: 'autoUpdate',
      // 包含的静态资源
      includeAssets: [
        'vite.svg', 'favicon.ico', 'silence-sw.js',
        'pwa-48x48.png', 'pwa-72x72.png', 'pwa-96x96.png',
        'pwa-128x128.png', 'pwa-144x144.png', 'pwa-192x192.png', 'pwa-512x512.png'
      ],
      // PWA Manifest 配置
      manifest: {
        id: '/dagang-workshop/',
        name: '小说大纲工坊',
        short_name: '大纲工坊',
        description: '专业的小说创作与大纲管理工具',
        theme_color: '#3b82f6',
        background_color: '#1e293b',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'zh-CN',
        categories: ['productivity', 'utilities', 'books'],
        icons: [
          {
            src: '/pwa-48x48.png',
            sizes: '48x48',
            type: 'image/png',
          },
          {
            src: '/pwa-72x72.png',
            sizes: '72x72',
            type: 'image/png',
          },
          {
            src: '/pwa-96x96.png',
            sizes: '96x96',
            type: 'image/png',
          },
          {
            src: '/pwa-128x128.png',
            sizes: '128x128',
            type: 'image/png',
          },
          {
            src: '/pwa-144x144.png',
            sizes: '144x144',
            type: 'image/png',
          },
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      // Workbox 配置：缓存策略
      workbox: {
        // [新增] 引入静默脚本
        importScripts: ['silence-sw.js'],
        // [关键修复] 排除后台管理页面的导航请求，防止 SPA fallback 拦截
        // 注：/adminer 是在后台 iframe 中加载，不是导航请求，无需排除
        navigateFallbackDenylist: [
          /^\/ztadmin/,    // 后台管理页面
        ],
        // 预缓存所有静态资源
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // 运行时缓存策略
        runtimeCaching: [
          {
            // API 请求：网络优先，失败则用缓存
            urlPattern: /^https?:\/\/.*\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24小时
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // 静态资源：缓存优先
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30天
              },
            },
          },
          {
            // 字体：缓存优先
            urlPattern: /\.(?:woff|woff2|ttf|eot)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'font-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1年
              },
            },
          },
        ],
      },
    }),
  ],
  esbuild: {
    // 仅在生产环境构建时移除 console 和 debugger
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
  server: {
    host: '0.0.0.0',  // 监听所有网络接口（Docker 环境必需）
    port: 5173,
    watch: {
      usePolling: true  // Docker 环境中文件监听需要轮询
    },
    proxy: {
      // ============================================
      // 1. 后台管理系统 (最高优先级，放在最前面)
      // ============================================
      '/ztadmin': {
        target: 'http://backend:8000',
        changeOrigin: false,  // 保持原始 Host，防止内部域名重定向
        secure: false,
        // [修复] 确保 Cookie 正确传递
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('[/ztadmin] Proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('[/ztadmin] Proxying:', req.method, req.url);
            // 手动转发 Cookie
            if (req.headers.cookie) {
              proxyReq.setHeader('Cookie', req.headers.cookie);
            }
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            // 将后端设置的 Cookie 传递给客户端
            const cookies = proxyRes.headers['set-cookie'];
            if (cookies) {
              res.setHeader('Set-Cookie', cookies);
            }
          });
        },
      },

      // ============================================
      // 1.5 Adminer 数据库管理代理
      // ============================================
      '/adminer': {
        target: 'http://backend:8000',
        changeOrigin: false,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('[/adminer] Proxy error:', err);
          });
          // 转发 Cookie
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            if (req.headers.cookie) proxyReq.setHeader('Cookie', req.headers.cookie);
          });
        },
      },
      // ============================================
      // 2. 后台静态资源
      // ============================================
      '/statics': {
        target: 'http://backend:8000',
        changeOrigin: false,
        secure: false,
      },

      // ============================================
      // 3. WebDAV 代理
      // ============================================
      '/__proxy__': {
        target: 'http://backend:8000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/__proxy__/, '/api/webdav_proxy'),
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('[/__proxy__] Proxy error:', err);
          });
        },
      },

      // ============================================
      // 4. 通用 API 接口 (含 WebSocket)
      // ============================================
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: false,
        secure: false,
        ws: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('[/api] Proxy error:', err);
          });
          // [修复] 添加Cookie转发，与/ztadmin保持一致
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // 手动转发请求中的Cookie
            if (req.headers.cookie) {
              proxyReq.setHeader('Cookie', req.headers.cookie);
            }
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            // [关键修复] 将后端设置的Cookie传递给客户端
            const cookies = proxyRes.headers['set-cookie'];
            if (cookies) {
              res.setHeader('Set-Cookie', cookies);
            }
          });
        },
      },
    },
    // CORS 配置
    cors: {
      origin: '*',
      methods: [
        'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD',
        'PROPFIND', 'PROPPATCH', 'MKCOL', 'COPY', 'MOVE', 'LOCK', 'UNLOCK'
      ],
      allowedHeaders: [
        'Content-Type', 'Authorization', 'Depth', 'Destination',
        'Overwrite', 'X-Requested-With'
      ],
      credentials: true
    }
  }
}))