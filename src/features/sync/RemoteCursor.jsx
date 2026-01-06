// ==================================================
// File: frontend/src/components/RemoteCursor.jsx
// 远程光标显示组件 - 显示其他设备的编辑状态
// ==================================================
import React from 'react';
import { Smartphone, Monitor } from 'lucide-react';

/**
 * 设备图标组件
 */
const DeviceIcon = ({ type, size = 14 }) => {
    if (type === 'mobile') {
        return <Smartphone size={size} />;
    }
    return <Monitor size={size} />;
};

/**
 * 远程光标指示器
 * 显示其他设备正在编辑的状态
 */
export function RemoteCursor({ editor, style = {} }) {
    if (!editor) return null;

    const { deviceType, cursor, text } = editor;
    const isMobile = deviceType === 'mobile';
    const label = isMobile ? '手机端' : '电脑端';

    return (
        <div
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: isMobile ? '#f0fdf4' : '#eff6ff',
                border: `1px solid ${isMobile ? '#86efac' : '#93c5fd'}`,
                color: isMobile ? '#16a34a' : '#2563eb',
                fontSize: '12px',
                fontWeight: 500,
                ...style
            }}
        >
            <DeviceIcon type={deviceType} size={14} />
            <span>{label}正在编辑</span>
            {text && (
                <span
                    style={{
                        marginLeft: '4px',
                        padding: '1px 4px',
                        backgroundColor: 'rgba(0,0,0,0.05)',
                        borderRadius: '2px',
                        fontFamily: 'monospace',
                        maxWidth: '100px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                    }}
                >
                    {text}
                </span>
            )}
        </div>
    );
}

/**
 * 远程编辑提示横条
 * 在编辑区域顶部显示
 */
export function RemoteEditorBanner({ editor, onDismiss }) {
    if (!editor) return null;

    const { deviceType, text } = editor;
    const isMobile = deviceType === 'mobile';
    const label = isMobile ? '📱 手机端' : '💻 电脑端';

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                backgroundColor: isMobile ? '#dcfce7' : '#dbeafe',
                borderBottom: `2px solid ${isMobile ? '#22c55e' : '#3b82f6'}`,
                fontSize: '13px',
                color: isMobile ? '#166534' : '#1d4ed8'
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <DeviceIcon type={deviceType} size={16} />
                <span><strong>{label}</strong> 正在编辑此章节</span>
                {text && (
                    <span
                        style={{
                            padding: '2px 6px',
                            backgroundColor: 'rgba(255,255,255,0.5)',
                            borderRadius: '4px',
                            fontFamily: 'monospace'
                        }}
                    >
                        最新输入: {text}
                    </span>
                )}
            </div>
            {onDismiss && (
                <button
                    onClick={onDismiss}
                    style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        opacity: 0.6,
                        fontSize: '14px'
                    }}
                >
                    ✕
                </button>
            )}
        </div>
    );
}

/**
 * 远程编辑者列表
 * 显示所有正在编辑的设备
 */
export function RemoteEditorsList({ remoteEditors }) {
    const editors = Object.entries(remoteEditors);

    if (editors.length === 0) return null;

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                padding: '8px',
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                fontSize: '12px'
            }}
        >
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                同步编辑中 ({editors.length})
            </div>
            {editors.map(([chapterId, editor]) => (
                <div
                    key={chapterId}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 8px',
                        backgroundColor: 'white',
                        borderRadius: '4px',
                        border: '1px solid #e2e8f0'
                    }}
                >
                    <DeviceIcon type={editor.deviceType} size={12} />
                    <span>{editor.deviceType === 'mobile' ? '手机端' : '电脑端'}</span>
                    {editor.text && (
                        <span style={{ color: '#64748b', marginLeft: 'auto' }}>
                            "{editor.text}"
                        </span>
                    )}
                </div>
            ))}
        </div>
    );
}

export default RemoteCursor;
