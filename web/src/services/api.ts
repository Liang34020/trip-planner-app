// web/src/services/api.ts
import axios, { AxiosError } from 'axios';
import type { AxiosInstance ,InternalAxiosRequestConfig } from 'axios';

// API 基礎 URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// 創建 axios 實例
const apiClient: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// ✅ 請求攔截器：自動加入 Token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token');
    
    console.log('🔑 Request interceptor:', {
      url: config.url,
      hasToken: !!token,
      token: token ? `${token.substring(0, 20)}...` : 'none'
    });
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// ✅ 響應攔截器：統一錯誤處理
apiClient.interceptors.response.use(
  (response) => {
    console.log('✅ Response:', response.config.url, response.status);
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    console.error('❌ Response error:', {
      url: originalRequest?.url,
      status: error.response?.status,
      message: error.message
    });

    // 401 錯誤：Token 過期，嘗試刷新
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        
        if (!refreshToken) {
          console.warn('⚠️ No refresh token, redirecting to login');
          throw new Error('No refresh token');
        }

        console.log('🔄 Attempting to refresh token...');

        // 刷新 Token
        const { data } = await axios.post(`${API_BASE_URL}/api/v1/auth/refresh`, {
          refresh_token: refreshToken,
        });

        console.log('✅ Token refreshed successfully');

        // 儲存新 Token
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);

        // 重試原請求
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        console.error('❌ Token refresh failed:', refreshError);
        
        // 刷新失敗，清除 Token 並跳轉登入
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        
        // 只在瀏覽器環境跳轉
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;