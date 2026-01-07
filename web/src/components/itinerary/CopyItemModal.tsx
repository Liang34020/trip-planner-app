// src/components/itinerary/CopyItemModal.tsx

import { X, Copy } from 'lucide-react';
import type { ItineraryItem, ItineraryDay } from '../../types/models';

interface CopyItemModalProps {
  item: ItineraryItem;
  allDays: ItineraryDay[];
  isOpen: boolean;
  onClose: () => void;
  onCopy: (targetDayId: string) => void;
}

export function CopyItemModal({
  item,
  allDays,
  isOpen,
  onClose,
  onCopy,
}: CopyItemModalProps) {
  if (!isOpen) return null;

  // 找到當前景點所在的 Day
  const currentDayId = item.day_id;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        {/* 標題列 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Copy className="w-5 h-5" />
            複製景點
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 內容 */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* 景點資訊 */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-gray-600 mb-1">將複製此景點：</p>
            <p className="font-medium text-gray-900">{item.place.name}</p>
          </div>

          {/* 選擇目標 Day */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              選擇要複製到的天數
            </label>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {allDays.map(day => {
                const isCurrent = day.day_id === currentDayId;
                return (
                  <button
                    key={day.day_id}
                    onClick={() => onCopy(day.day_id)}
                    disabled={isCurrent}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                      isCurrent
                        ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-50'
                        : 'border-gray-200 hover:border-primary-500 hover:bg-primary-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">
                          Day {day.day_number}
                          {isCurrent && (
                            <span className="ml-2 text-xs text-gray-500">
                              (目前所在)
                            </span>
                          )}
                        </p>
                        {day.date && (
                          <p className="text-sm text-gray-600">
                            {new Date(day.date).toLocaleDateString('zh-TW', {
                              month: 'long',
                              day: 'numeric',
                              weekday: 'short',
                            })}
                          </p>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {day.items.length} 個景點
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 按鈕列 */}
        <div className="flex justify-end p-4 border-t border-gray-200 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}