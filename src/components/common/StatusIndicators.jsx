/**
 * StatusIndicators - 状态指示灯组件
 * 从 DesktopLayout.jsx 和 MobileLayout.jsx 提取的通用组件
 * 显示系统备份、WebDAV、WebSocket 连接状态
 */
import React from 'react';

/**
 * @param {Object} props
 * @param {string} props.dbSyncStatus - 系统自动备份状态 ('idle'|'unsaved'|'syncing'|'success'|'error')
 * @param {string} props.webdavSyncStatus - WebDAV同步状态 ('idle'|'syncing'|'success'|'error')
 * @param {string} props.webdavLastMsg - WebDAV最后消息
 * @param {string} props.wsStatus - WebSocket连接状态 ('connected'|'connecting'|'disconnected')
 * @param {boolean} props.showWebdav - 是否显示 WebDAV 状态灯
 * @param {number} [props.visibleLights=3] - 显示的状态灯数量（用于移动端空间限制）
 * @param {string} [props.size='desktop'] - 尺寸模式 ('desktop'|'mobile')
 */
const StatusIndicators = ({
    dbSyncStatus = 'idle',
    webdavSyncStatus = 'idle',
    webdavLastMsg = '',
    wsStatus = 'disconnected',
    showWebdav = true,
    visibleLights = 3,
    size = 'desktop'
}) => {
    const isMobile = size === 'mobile';
    const gapClass = isMobile ? 'gap-1.5' : 'gap-3';
    const marginClass = isMobile ? '' : 'mr-3';

    // 状态灯样式生成
    // [优化] error/disconnected 状态添加闪烁动画，吸引用户注意
    const getLightClass = (status, type) => {
        const baseClass = 'w-2.5 h-2.5 rounded-full transition-colors flex-shrink-0';

        if (type === 'db') {
            switch (status) {
                case 'syncing': return `${baseClass} bg-blue-500 animate-pulse`;
                case 'unsaved': return `${baseClass} bg-yellow-500`;
                case 'success': return `${baseClass} bg-green-500`;
                case 'error': return `${baseClass} bg-red-500 animate-pulse`; // [优化] 错误时闪烁
                default: return `${baseClass} bg-gray-300`;
            }
        }

        if (type === 'webdav') {
            switch (status) {
                case 'syncing': return `${baseClass} bg-blue-500 animate-pulse`;
                case 'success': return `${baseClass} bg-green-500`;
                case 'error': return `${baseClass} bg-red-500 animate-pulse`; // [优化] 错误时闪烁
                default: return `${baseClass} bg-gray-400`;
            }
        }

        if (type === 'ws') {
            switch (status) {
                case 'connected': return `${baseClass} bg-green-500`;
                case 'connecting': return `${baseClass} bg-yellow-500 animate-pulse`;
                default: return `${baseClass} bg-red-500 animate-pulse`; // [优化] 断开时闪烁
            }
        }

        return baseClass;
    };

    // 状态提示文本生成
    const getDbTitle = () => {
        const statusMap = {
            success: '已同步',
            syncing: '同步中...',
            unsaved: '有未保存更改',
            error: '同步失败'
        };
        return `系统自动备份: ${statusMap[dbSyncStatus] || '空闲'}`;
    };

    const getWebdavTitle = () => {
        const statusMap = {
            success: '已同步',
            syncing: '同步中...'
        };
        const msg = statusMap[webdavSyncStatus] || '未同步';
        return `WebDAV: ${msg}${webdavLastMsg ? ` (${webdavLastMsg})` : ''}`;
    };

    const getWsTitle = () => {
        return `服务器连接: ${wsStatus === 'connected' ? '正常' : '断开'}`;
    };

    return (
        <div className={`flex items-center ${gapClass} ${marginClass}`}>
            {/* 1. 系统自动备份状态 - 始终显示 */}
            <div className="cursor-help" title={getDbTitle()}>
                <div className={getLightClass(dbSyncStatus, 'db')} />
            </div>

            {/* 2. WebDAV状态 - 根据权限和空间显示 */}
            {showWebdav && visibleLights >= 2 && (
                <div className="cursor-help" title={getWebdavTitle()}>
                    <div className={getLightClass(webdavSyncStatus, 'webdav')} />
                </div>
            )}

            {/* 3. 心跳状态 - 根据空间显示 */}
            {visibleLights >= 3 && (
                <div className="cursor-help" title={getWsTitle()}>
                    <div className={getLightClass(wsStatus, 'ws')} />
                </div>
            )}
        </div>
    );
};

export default StatusIndicators;
