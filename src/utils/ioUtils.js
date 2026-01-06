/**
 * ioUtils.js
 * 处理小说数据的导入导出逻辑
 * [重构] 使用 backupUtils.js 的公共函数
 */
import { toChineseNum, DATA_VERSION } from '../constants';
import { buildBackupJSON, restoreFromBackup, handleRestoreSuccess } from './backupUtils';

/**
 * 导出 JSON 备份
 * 使用与 WebDAV 相同的数据格式
 */
export const exportNovelJSON = (novel) => {
    const currentTitle = novel.novelsRef.current.find(n => n.id === novel.currentNovelId)?.title || 'Backup';

    // 使用公共函数构建备份 JSON
    const exportData = buildBackupJSON({
        novelId: novel.currentNovelId,
        title: currentTitle,
        data: novel.data,
        chapterTemplates: novel.chapterTemplates,
        charFields: novel.charFields,
        charCats: novel.charCats,
        characters: novel.characters,
        sceneCats: novel.sceneCats,
        scenes: novel.scenes,
        settingCats: novel.settingCats,
        worldSettings: novel.worldSettings,
        relations: novel.relations || []
    });

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentTitle}.json`;
    a.click();
    URL.revokeObjectURL(url);
};

/**
 * 导出 TXT 文本
 */
/**
 * 导出 TXT 纯文本 (小说阅读格式)
 * 格式：
 * 第XX卷 卷名
 * 第XX章 章名
 * 正文内容
 */
export const exportNovelText = (novel) => {
    const novelTitle = novel.novelsRef.current.find(n => n.id === novel.currentNovelId)?.title || '未命名作品';
    // 纯文本头部，去除 Markdown 标题符号
    let text = `${novelTitle}\n导出时间：${new Date().toLocaleString()}\n软件版本：小说工坊 ${DATA_VERSION}\n\n================================\n\n`;
    let volIndex = 0;
    let chapIndex = 0;

    const processNode = (node) => {
        if (node.type === 'node' && (!node.content || !node.content.trim())) return;
        let title = node.title || '未命名';
        if (node.type === 'volume') {
            volIndex++;
            // 卷：前后空行，无特殊符号
            text += `\n\n第${toChineseNum(volIndex)}卷 ${title}\n\n`;
        } else if (node.type === 'chapter') {
            chapIndex++;
            // 章：前空行
            text += `\n第${toChineseNum(chapIndex)}章 ${title}\n`;
        } else if (node.type === 'node') {
            // 节/片段：作为正文分隔符
            text += `\n[${title}]\n`;
        }

        if (node.content) {
            // 正文：简单的段落处理
            text += `${node.content}\n`;
        }

        if (node.children?.length > 0) {
            node.children.forEach(child => processNode(child));
        }
    };

    if (novel.data) novel.data.forEach(node => processNode(node));

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${novelTitle}.txt`;
    a.click();
    URL.revokeObjectURL(url);
};

/**
 * 导出 Markdown (思维导图/大纲格式)
 * 格式：
 * # 第X卷 卷名
 * ## 第X章 章名
 * ### 节名
 * - 正文摘要...
 */
export const exportNovelMindmap = (novel) => {
    const novelTitle = novel.novelsRef.current.find(n => n.id === novel.currentNovelId)?.title || '未命名作品';
    let text = `# ${novelTitle}\n\n`;

    // [修复] 增加卷章计数器
    let volIndex = 0;
    let chapIndex = 0;

    const processNode = (node, level = 1) => {
        let title = node.title || '未命名';

        // [修复] 根据类型添加前缀
        if (node.type === 'volume') {
            volIndex++;
            title = `第${toChineseNum(volIndex)}卷 ${title}`;
        } else if (node.type === 'chapter') {
            chapIndex++;
            title = `第${toChineseNum(chapIndex)}章 ${title}`;
        }

        const indent = '#'.repeat(level);

        // 标题行
        text += `${indent} ${title}\n`;

        // 内容作为引用块，避免混淆结构
        if (node.content && node.content.trim()) {
            // 截取前100字作为摘要
            const summary = node.content.trim().slice(0, 100).replace(/\n/g, ' ');
            text += `> ${summary}...\n\n`;
        } else {
            text += `\n`;
        }

        if (node.children?.length > 0) {
            node.children.forEach(child => processNode(child, level + 1));
        }
    };

    if (novel.data) novel.data.forEach(node => processNode(node, 2)); // [修复] 从二级标题开始，书名作为一级标题

    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // 专门导出为 .md 格式
    a.download = `${novelTitle}_大纲.md`;
    a.click();
    URL.revokeObjectURL(url);
};

/**
 * 导入 JSON
 * 使用公共恢复函数，与 WebDAV 共用逻辑
 */
export const importNovelJSON = (file, novel, setConfirmDialog, toast, getStorageKey) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const json = JSON.parse(event.target.result);
            if (!json.content || !json.meta) {
                toast.showToast('文件格式错误：缺少 content 或 meta', 'error');
                return;
            }

            const importTitle = json.meta.title || '未知作品';

            setConfirmDialog({
                visible: true,
                message: `确定要导入《${importTitle}》吗？将创建一本新书籍。`,
                onConfirm: async () => {
                    // 使用公共恢复函数
                    const result = await restoreFromBackup(json, getStorageKey, toast);
                    if (result.success) {
                        handleRestoreSuccess(result.newId, result.newTitle, getStorageKey, toast);
                    } else {
                        toast.showToast('导入失败: ' + result.error, 'error');
                    }
                }
            });
        } catch (err) {
            toast.showToast('解析 JSON 失败', 'error');
            console.error(err);
        }
    };
    reader.readAsText(file);
};
