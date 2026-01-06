
import React, { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

const Toast = ({ id, message, type = 'info', onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose(id);
        }, 3000);
        return () => clearTimeout(timer);
    }, [id, onClose]);

    const styles = {
        success: 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/30 dark:border-green-800 dark:text-green-300',
        error: 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300',
        warning: 'bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-300',
        info: 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300',
    };

    const icons = {
        success: <CheckCircle size={16} />,
        error: <AlertCircle size={16} />,
        warning: <AlertTriangle size={16} />,
        info: <Info size={16} />,
    };

    return (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg border shadow-lg transition-all animate-in slide-in-from-right fade-in duration-300 ${styles[type] || styles.info} min-w-[200px] max-w-sm`}>
            <div className="shrink-0">{icons[type] || icons.info}</div>
            <div className="text-sm font-medium flex-1 break-words">{message}</div>
            <button onClick={() => onClose(id)} className="shrink-0 hover:bg-black/5 rounded p-0.5">
                <X size={14} />
            </button>
        </div>
    );
};

export const ToastContainer = ({ toasts, removeToast, isMobile = false }) => {
    // [修复] 移动端不显示右下角 Toast 提示
    if (isMobile) return null;

    return (
        <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
            <div className="flex flex-col gap-2 pointer-events-auto items-end">
                {toasts.map(toast => (
                    <Toast key={toast.id} {...toast} onClose={removeToast} />
                ))}
            </div>
        </div>
    );
};
