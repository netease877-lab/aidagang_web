import { openDB } from 'idb';

const DB_NAME = 'novel-studio-db';
const DB_VERSION = 3; // [升级] 升级版本号以触发 pending_edits 表创建

/**
 * 数据库服务 - 封装 IndexedDB 操作
 * 使用 'idb' 库简化 Promise 操作
 */
class DBService {
    constructor() {
        this.dbPromise = this.init();
        // [新增] 初始化时静默执行清理任务
        this.cleanupOldSnapshots().catch(e => console.warn('[DB] Cleanup failed:', e));
    }

    async init() {
        return openDB(DB_NAME, DB_VERSION, {
            upgrade(db, oldVersion, newVersion, transaction) {
                // 1. 小说元数据 (metadata)
                if (!db.objectStoreNames.contains('novels')) {
                    db.createObjectStore('novels', { keyPath: 'id' });
                }
                // 2. 小说内容 (heavy data: nodes, entities...)
                if (!db.objectStoreNames.contains('contents')) {
                    db.createObjectStore('contents', { keyPath: 'novel_id' });
                }
                // 3. 同步快照 (snapshots) - 确保在升级时创建
                if (!db.objectStoreNames.contains('snapshots')) {
                    db.createObjectStore('snapshots', { keyPath: 'novel_id' });
                }
                // 4. [新增] 编辑暂存表 (pending_edits) - 用于存储编辑中的临时数据
                if (!db.objectStoreNames.contains('pending_edits')) {
                    db.createObjectStore('pending_edits', { keyPath: 'novel_id' });
                }
            },
        });
    }

    /**
     * 保存小说列表/元数据
     * @param {Array} novels 
     */
    async saveNovelsMetadata(novels) {
        const db = await this.dbPromise;
        const tx = db.transaction('novels', 'readwrite');
        const store = tx.objectStore('novels');
        await Promise.all(novels.map(novel => store.put(novel)));
        return tx.done;
    }

    async getNovelsMetadata() {
        const db = await this.dbPromise;
        return db.getAll('novels');
    }

    /**
     * 保存小说完整内容
     * @param {string} novelId 
     * @param {Object} content { data, characters, scenes... }
     */
    async saveNovelContent(novelId, content) {
        const db = await this.dbPromise;
        // 确保 content 包含 novel_id 作为主键
        const payload = { ...content, novel_id: novelId, updated_at: Date.now() };
        return db.put('contents', payload);
    }

    /**
     * 获取小说内容
     * @param {string} novelId 
     */
    async getNovelContent(novelId) {
        const db = await this.dbPromise;
        return db.get('contents', novelId);
    }

    /**
     * 保存快照
     * @param {string} novelId 
     * @param {Object} snapshot 
     */
    async saveSnapshot(novelId, snapshot) {
        const db = await this.dbPromise;
        // [新增] 加入时间戳用于过期清理
        const payload = {
            ...snapshot,
            novel_id: novelId,
            _snapshot_timestamp: Date.now()
        };
        return db.put('snapshots', payload);
    }

    async getSnapshot(novelId) {
        const db = await this.dbPromise;
        return db.get('snapshots', novelId);
    }

    /**
     * [新增] 清理超过 1 天的快照
     */
    async cleanupOldSnapshots() {
        const db = await this.dbPromise;
        const tx = db.transaction('snapshots', 'readwrite');
        const store = tx.objectStore('snapshots');
        let cursor = await store.openCursor();

        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        let deletedCount = 0;

        while (cursor) {
            const snapshot = cursor.value;
            // 如果快照太旧 (24小时前)，则删除
            if (snapshot?._snapshot_timestamp && snapshot._snapshot_timestamp < oneDayAgo) {
                await cursor.delete();
                deletedCount++;
            }
            cursor = await cursor.continue();
        }
        if (deletedCount > 0) {
        }
        return tx.done;
    }

    // ==================== Pending Edits (编辑暂存) ====================

    /**
     * 保存编辑暂存数据
     * @param {string} novelId 
     * @param {Object} content 
     */
    async savePendingEdit(novelId, content) {
        const db = await this.dbPromise;
        const payload = { ...content, novel_id: novelId, updated_at: Date.now() };
        return db.put('pending_edits', payload);
    }

    /**
     * 获取编辑暂存数据
     * @param {string} novelId 
     */
    async getPendingEdit(novelId) {
        const db = await this.dbPromise;
        return db.get('pending_edits', novelId);
    }

    /**
     * 删除编辑暂存数据
     * @param {string} novelId 
     */
    async deletePendingEdit(novelId) {
        const db = await this.dbPromise;
        return db.delete('pending_edits', novelId);
    }

    /**
     * 获取所有暂存数据（用于启动时恢复）
     */
    async getAllPendingEdits() {
        const db = await this.dbPromise;
        return db.getAll('pending_edits');
    }

    /**
     * 删除小说所有数据
     * @param {string} novelId 
     */
    async deleteNovel(novelId) {
        const db = await this.dbPromise;
        const tx = db.transaction(['novels', 'contents', 'snapshots', 'pending_edits'], 'readwrite');
        await Promise.all([
            tx.objectStore('novels').delete(novelId),
            tx.objectStore('contents').delete(novelId),
            tx.objectStore('snapshots').delete(novelId),
        ]);
        // 保存内容时，顺便清空该小说的 pending_edit
        // [修复] 检查 store 是否存在，防止版本升级失败导致崩溃
        if (db.objectStoreNames.contains('pending_edits')) {
            try {
                await tx.objectStore('pending_edits').delete(novelId);
            } catch (ignore) {
                // 忽略清理临时数据的失败
            }
        }

        return tx.done;
    }

}

export const dbService = new DBService();
