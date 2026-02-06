// ==================================================
// Hook测试 - 测试自定义Hooks
// ==================================================
import { renderHook, act } from '@testing-library/react';

// Mock localStorage
const mockLocalStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

describe('usePersistedState Hook', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('应该能正确导入Hook', async () => {
        const { usePersistedState } = await import('../hooks/usePersistedState');
        expect(usePersistedState).toBeDefined();
    });

    test('应该能正确导入布尔值Hook', async () => {
        const { usePersistedBool } = await import('../hooks/usePersistedState');
        expect(usePersistedBool).toBeDefined();
    });

    test('应该能正确导入数值Hook', async () => {
        const { usePersistedNumber } = await import('../hooks/usePersistedState');
        expect(usePersistedNumber).toBeDefined();
    });
});

describe('useAiChat Hook', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ data: [] }),
            })
        );
    });

    test('应该能正确导入Hook', async () => {
        const { useAiChat } = await import('../hooks/useAiChat');
        expect(useAiChat).toBeDefined();
    });

    test('初始状态应该正确', async () => {
        const { useAiChat } = await import('../hooks/useAiChat');
        const { result } = renderHook(() => useAiChat({}));

        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBeNull();
        expect(result.current.result).toBeNull();
    });

    test('validateConfig应该在无apiKey时返回false', async () => {
        const { useAiChat } = await import('../hooks/useAiChat');
        const { result } = renderHook(() => useAiChat({ aiConfig: {} }));

        expect(result.current.validateConfig()).toBe(false);
    });

    test('reset应该清空所有状态', async () => {
        const { useAiChat } = await import('../hooks/useAiChat');
        const { result } = renderHook(() => useAiChat({}));

        act(() => {
            result.current.reset();
        });

        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBeNull();
        expect(result.current.result).toBeNull();
    });
});

describe('useTreeOperations Hook', () => {
    test('应该能正确导入Hook', async () => {
        const { useTreeOperations } = await import('../hooks/useTreeOperations');
        expect(useTreeOperations).toBeDefined();
    });
});

describe('useLayoutState Hook', () => {
    test('应该能正确导入Hook', async () => {
        const { useLayoutState } = await import('../hooks/useLayoutState');
        expect(useLayoutState).toBeDefined();
    });

    test('初始状态应该正确', async () => {
        const { useLayoutState } = await import('../hooks/useLayoutState');
        const { result } = renderHook(() => useLayoutState());

        expect(result.current.activeTab).toBe('outline');
        expect(result.current.isFullscreen).toBe(false);
        expect(result.current.isMarkingMode).toBe(false);
    });

    test('switchTab应该改变activeTab', async () => {
        const { useLayoutState } = await import('../hooks/useLayoutState');
        const { result } = renderHook(() => useLayoutState());

        act(() => {
            result.current.switchTab('characters');
        });

        expect(result.current.activeTab).toBe('characters');
    });

    test('toggleFullscreen应该切换全屏状态', async () => {
        const { useLayoutState } = await import('../hooks/useLayoutState');
        const { result } = renderHook(() => useLayoutState());

        expect(result.current.isFullscreen).toBe(false);

        act(() => {
            result.current.toggleFullscreen();
        });

        expect(result.current.isFullscreen).toBe(true);
    });
});
