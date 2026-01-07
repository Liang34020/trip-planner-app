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
        className="lg:hidden fixed bottom-4 right-4 z-40 p-3 bg-primary-600 text-white rounded-full shadow-lg hover:bg-primary-700 transition-colors"
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
        <div className="p-4 border-b border-gray-200 bg-white flex-shrink-0 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">地圖預覽</h3>
          {/* 🆕 小螢幕關閉按鈕 */}
          <button
            onClick={() => setIsOpen(false)}
            className="lg:hidden p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 地圖內容 */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <Map className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h4 className="text-gray-600 font-medium mb-2">地圖功能開發中</h4>
            <p className="text-gray-500 text-sm">未來將整合 Google Maps API</p>
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