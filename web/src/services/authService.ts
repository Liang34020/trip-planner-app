// web/src/services/authService.ts
import apiClient from './api';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  display_name?: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: {
    user_id: string;
    email: string;
    display_name?: string;
  };
}

export const authService = {
  /**
   * 登入
   */
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>('/auth/login', credentials);
    
    console.log('✅ Login successful:', {
      email: data.user.email,
      hasAccessToken: !!data.access_token,
      hasRefreshToken: !!data.refresh_token
    });
    
    // 儲存 Token
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    
    return data;
  },

  /**
   * 註冊
   */
  async register(userData: RegisterRequest): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>('/auth/register', userData);
    
    console.log('✅ Registration successful:', {
      email: data.user.email,
      hasAccessToken: !!data.access_token,
      hasRefreshToken: !!data.refresh_token
    });
    
    // 儲存 Token
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    
    return data;
  },

  /**
   * 登出
   */
  logout() {
    console.log('🚪 Logging out...');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
  },

  /**
   * 獲取當前用戶
   */
  async getCurrentUser() {
    const { data } = await apiClient.get('/auth/me');
    localStorage.setItem('user', JSON.stringify(data));
    return data;
  },

  /**
   * 檢查是否已登入
   */
  isAuthenticated(): boolean {
    const hasToken = !!localStorage.getItem('access_token');
    console.log('🔐 isAuthenticated:', hasToken);
    return hasToken;
  },

  /**
   * 獲取本地用戶資料
   */
  getLocalUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },
};