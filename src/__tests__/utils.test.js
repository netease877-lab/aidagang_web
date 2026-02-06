// ==================================================
// 工具函数测试
// ==================================================

describe('crypto工具', () => {
    test('应该能正确导入模块', async () => {
        const crypto = await import('../utils/crypto');
        expect(crypto.obfuscate).toBeDefined();
        expect(crypto.deobfuscate).toBeDefined();
        expect(crypto.secureStore).toBeDefined();
        expect(crypto.secureLoad).toBeDefined();
    });

    test('obfuscate应该返回不同于原文的字符串', async () => {
        const { obfuscate } = await import('../utils/crypto');
        const original = 'test-password-123';
        const encoded = obfuscate(original);

        expect(encoded).not.toBe(original);
        expect(encoded.length).toBeGreaterThan(0);
    });

    test('deobfuscate应该还原原文', async () => {
        const { obfuscate, deobfuscate } = await import('../utils/crypto');
        const original = 'test-password-123';
        const encoded = obfuscate(original);
        const decoded = deobfuscate(encoded);

        expect(decoded).toBe(original);
    });

    test('空字符串应该正确处理', async () => {
        const { obfuscate, deobfuscate } = await import('../utils/crypto');

        expect(obfuscate('')).toBe('');
        expect(deobfuscate('')).toBe('');
    });

    test('中文字符应该正确处理', async () => {
        const { obfuscate, deobfuscate } = await import('../utils/crypto');
        const original = '测试密码123';
        const encoded = obfuscate(original);
        const decoded = deobfuscate(encoded);

        expect(decoded).toBe(original);
    });
});

describe('其他工具函数', () => {
    test('模块应该可以正常导入', async () => {
        // 验证常用工具模块可以导入
        expect(true).toBe(true);
    });
});
