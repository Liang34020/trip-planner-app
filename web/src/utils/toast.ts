// src/utils/toast.ts

import toast from 'react-hot-toast';

/**
 * Toast 通知工具（統一樣式）
 */

export const showToast = {
  success: (message: string) => {
    toast.success(message, {
      duration: 3000,
      position: 'top-center',
      style: {
        background: '#10B981',
        color: '#fff',
        padding: '12px 24px',
        borderRadius: '8px',
      },
      icon: '✅',
    });
  },

  error: (message: string) => {
    toast.error(message, {
      duration: 4000,
      position: 'top-center',
      style: {
        background: '#EF4444',
        color: '#fff',
        padding: '12px 24px',
        borderRadius: '8px',
      },
      icon: '❌',
    });
  },

  info: (message: string) => {
    toast(message, {
      duration: 3000,
      position: 'top-center',
      style: {
        background: '#3B82F6',
        color: '#fff',
        padding: '12px 24px',
        borderRadius: '8px',
      },
      icon: 'ℹ️',
    });
  },

  loading: (message: string) => {
    return toast.loading(message, {
      position: 'top-center',
      style: {
        background: '#6B7280',
        color: '#fff',
        padding: '12px 24px',
        borderRadius: '8px',
      },
    });
  },

  dismiss: (toastId?: string) => {
    toast.dismiss(toastId);
  },
};