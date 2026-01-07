// src/components/itinerary/EditDayModal.tsx

import { X, MessageSquare } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { ItineraryDay } from '../../types/models';

interface EditDayModalProps {
  day: ItineraryDay;
  isOpen: boolean;
  onClose: () => void;
  onSave: (notes: string) => void;
}

export function EditDayModal({ day, isOpen, onClose, onSave }: EditDayModalProps) {
  const [notes, setNotes] = useState(day.notes || '');

  useEffect(() => {
    setNotes(day.notes || '');
  }, [day]);

  if (!isOpen) return null;

  function handleSave() {
    onSave(notes);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        {/* 標題列 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <h3 className="text-lg font-semibold text-gray-900">
            編輯 Day {day.day_number}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 表單內容 */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* 日期（唯讀） */}
          {day.date && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                日期
              </label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-700">
                {new Date(day.date).toLocaleDateString('zh-TW', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  weekday: 'long',
                })}
              </div>
            </div>
          )}

          {/* 當日備註 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <MessageSquare className="w-4 h-4 inline mr-1" />
              當日備註
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              placeholder="例如：第一天：東京經典景點、預計晚上 8 點到達飯店..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
          </div>

          {/* 統計資訊 */}
          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>景點數量：</span>
              <span className="font-medium">{day.items.length} 個</span>
            </div>
            {day.items.length > 0 && (
              <div className="flex justify-between mt-1">
                <span>預計停留時間：</span>
                <span className="font-medium">
                  {day.items.reduce((sum, item) => sum + (item.duration_minutes || 0), 0)} 分鐘
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 按鈕列 */}
        <div className="flex flex-col sm:flex-row gap-2 p-4 border-t border-gray-200 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            儲存
          </button>
        </div>
      </div>
    </div>
  );
}