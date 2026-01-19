import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await authService.login({ email, password });
      toast.success('登入成功！');
      navigate('/');
    } catch (error: any) {
      console.error('登入失敗:', error);
      toast.error(error.response?.data?.detail || '登入失敗');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await authService.register({ email, password });
      toast.success('註冊成功！');
      navigate('/');
    } catch (error: any) {
      console.error('註冊失敗:', error);
      toast.error(error.response?.data?.detail || '註冊失敗');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-2 text-gray-800">
          🗺️ Trip Planner
        </h1>
        <p className="text-center text-gray-600 mb-8">開始規劃你的旅程</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="your@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              密碼
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="••••••••"
              required
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
            >
              {isLoading ? '登入中...' : '登入'}
            </button>
            <button
              type="button"
              onClick={handleRegister}
              disabled={isLoading}
              className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 transition disabled:opacity-50"
            >
              {isLoading ? '註冊中...' : '註冊'}
            </button>
          </div>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-600 text-center">
            測試帳號：test@example.com / test123456
          </p>
          <p className="text-xs text-gray-500 text-center mt-2">
            首次使用請先註冊，或使用測試帳號登入
          </p>
        </div>
      </div>
    </div>
  );
}