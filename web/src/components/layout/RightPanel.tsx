// src/components/layout/RightPanel.tsx

import { Map } from 'lucide-react';

export function RightPanel() {
  return (
    <div className="hidden xl:block w-96 bg-gray-100 border-l border-gray-200 h-screen">
      <div className="p-4 border-b border-gray-200 bg-white">
        <h3 className="font-semibold text-gray-900">地圖預覽</h3>
      </div>
      
      <div className="flex items-center justify-center h-[calc(100%-60px)]">
        <div className="text-center">
          <Map className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h4 className="text-gray-600 font-medium mb-2">地圖功能開發中</h4>
          <p className="text-gray-500 text-sm">
            未來將整合 Google Maps API
          </p>
        </div>
      </div>
    </div>
  );
}
