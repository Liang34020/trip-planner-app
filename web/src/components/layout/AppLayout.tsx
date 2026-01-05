// src/components/layout/AppLayout.tsx

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { LeftPanel } from './LeftPanel';
import { MiddlePanel } from './MiddlePanel';
import { RightPanel } from './RightPanel';

export function AppLayout() {
  const { isLeftPanelCollapsed, toggleLeftPanel } = useAppStore();

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 relative">
      {/* 收藏池（左欄）*/}
      <div
        className={`transition-all duration-300 ease-in-out ${
          isLeftPanelCollapsed ? 'w-0' : 'w-80'
        }`}
      >
        <LeftPanel />
      </div>

      {/* 折疊按鈕 - 固定在分界線上 */}
      <button
        onClick={toggleLeftPanel}
        className={`absolute top-1/2 -translate-y-1/2 z-50 p-2 bg-white rounded-full shadow-lg hover:bg-gray-50 transition-all duration-300 border border-gray-300 hover:border-primary-500 ${
          isLeftPanelCollapsed ? 'left-4' : 'left-[304px]'
        }`}
        title={isLeftPanelCollapsed ? '展開收藏池' : '收起收藏池'}
      >
        {isLeftPanelCollapsed ? (
          <ChevronRight className="w-5 h-5 text-gray-700" />
        ) : (
          <ChevronLeft className="w-5 h-5 text-gray-700" />
        )}
      </button>

      {/* 行程編輯器（中欄）*/}
      <MiddlePanel />

      {/* 地圖（右欄，桌面版顯示）*/}
      <RightPanel />
    </div>
  );
}