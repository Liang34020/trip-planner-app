// src/components/layout/RightPanel.tsx

import { Map, X } from 'lucide-react';
import { useState } from 'react';

export function RightPanel() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* 🆕 小螢幕地圖開關按鈕 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed bottom-4 right-4 z-40 p-4 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-full shadow-strong hover:shadow-[0_20px_60px_-10px_rgba(59,130,246,0.5)] transition-all duration-300 hover:scale-110 active:scale-95"
        title="開啟地圖"
      >
        <Map className="w-6 h-6" />
      </button>

      {/* 地圖面板 */}
      <div
        className={`
          fixed lg:static
          top-0 right-0 bottom-0
          z-30
          bg-gray-100 border-l border-gray-200
          transition-transform duration-300 ease-in-out
          flex flex-col
          lg:flex lg:h-screen lg:flex-shrink-0 lg:w-80 xl:w-96
          ${isOpen ? 'translate-x-0 w-full sm:w-96' : 'translate-x-full lg:translate-x-0'}
        `}
      >
        {/* 標題列 */}
        <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-primary-50 to-white flex-shrink-0 flex items-center justify-between">
          <h3 className="font-bold text-gradient">地圖預覽</h3>
          {/* 🆕 小螢幕關閉按鈕 */}
          <button
            onClick={() => setIsOpen(false)}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-all active:scale-95"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 地圖內容 */}
        <div className="flex-1 flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 to-blue-50/30">
          <div className="empty-state animate-pulse-soft">
            <Map className="empty-state-icon text-primary-300" />
            <h4 className="empty-state-title">地圖功能開發中</h4>
            <p className="empty-state-description">未來將整合 Google Maps API</p>
          </div>
        </div>
      </div>

      {/* 🆕 遮罩層（小螢幕） */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-20"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}