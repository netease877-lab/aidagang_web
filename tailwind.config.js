/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        'dots-pattern': 'radial-gradient(#cbd5e1 1px, transparent 1px)',
      },
      backgroundSize: {
        'dots-pattern': '20px 20px',
      },
      // [核心修复] 将复杂的贝塞尔曲线定义为标准配置 'smooth'
      // 解决 "class is ambiguous" 构建警告
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.25, 0.1, 0.25, 1.0)',
      }
    },
  },
  plugins: [
    require('tailwindcss-animate'),
    require('@tailwindcss/typography')
  ],
}