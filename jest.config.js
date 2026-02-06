/** @type {import('jest').Config} */
module.exports = {
    // 使用jsdom环境模拟浏览器
    testEnvironment: 'jsdom',

    // Setup文件
    setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],

    // 模块路径映射
    moduleNameMapper: {
        // 处理CSS模块
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
        // 处理静态资源
        '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/__mocks__/fileMock.js',
    },

    // 转换配置
    transform: {
        '^.+\\.(js|jsx)$': 'babel-jest',
    },

    // 忽略的路径
    testPathIgnorePatterns: ['/node_modules/', '/dist/'],

    // 收集覆盖率
    collectCoverageFrom: [
        'src/**/*.{js,jsx}',
        '!src/index.js',
        '!src/**/*.d.ts',
    ],

    // 覆盖率阈值
    coverageThreshold: {
        global: {
            branches: 10,
            functions: 10,
            lines: 10,
            statements: 10,
        },
    },
};
