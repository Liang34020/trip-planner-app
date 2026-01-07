// src/components/itinerary/EditItemModal.tsx

import { X, Clock, MessageSquare, Navigation } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { ItineraryItem } from '../../types/models';
import { TRANSPORT_LABELS } from '../../types/models';

interface EditItemModalProps {
  item: ItineraryItem;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: Partial<ItineraryItem>) => void;
}

export function EditItemModal({
  item,
  isOpen,
  onClose,
  onSave,
}: EditItemModalProps) {
  const [scheduledTime, setScheduledTime] = useState(item.scheduled_time || '');
  const [durationMinutes, setDurationMinutes] = useState(
    item.duration_minutes?.toString() || ''
  );
  const [notes, setNotes] = useState(item.notes || '');
  const [transportToNext, setTransportToNext] = useState(
    item.transport_to_next || ''
  );

  // 當 item 改變時重置表單
  useEffect(() => {
    setScheduledTime(item.scheduled_time || '');
    setDurationMinutes(item.duration_minutes?.toString() || '');
    setNotes(item.notes || '');
    setTransportToNext(item.transport_to_next || '');
  }, [item]);

  if (!isOpen) return null;

  function handleSave() {
    onSave({
      scheduled_time: scheduledTime || undefined,
      duration_minutes: durationMinutes ? parseInt(durationMinutes) : undefined,
      notes: notes || undefined,
      transport_to_next: (transportToNext as ItineraryItem['transport_to_next']) || undefined,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        {/* 標題列 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <h3 className="text-lg font-semibold text-gray-900">編輯景點</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 表單內容 - 可滾動 */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* 地點名稱（唯讀） */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              地點名稱
            </label>
            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-700">
              {item.place.name}
            </div>
          </div>

          {/* 預計到達時間 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Clock className="w-4 h-4 inline mr-1" />
              預計到達時間
            </label>
            <input
              type="time"
              value={scheduledTime}
              onChange={e => setScheduledTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* 停留時間 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Clock className="w-4 h-4 inline mr-1" />
              停留時間（分鐘）
            </label>
            <input
              type="number"
              min="0"
              step="15"
              value={durationMinutes}
              onChange={e => setDurationMinutes(e.target.value)}
              placeholder="例如：120"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* 交通方式 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Navigation className="w-4 h-4 inline mr-1" />
              到下一個點的交通方式
            </label>
            <select
              value={transportToNext}
              onChange={e => setTransportToNext(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">-- 未設定 --</option>
              {Object.entries(TRANSPORT_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* 備註 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <MessageSquare className="w-4 h-4 inline mr-1" />
              備註
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="例如：記得提前預約、建議早上去人比較少..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
          </div>
        </div>

        {/* 按鈕列 - 固定在底部 */}
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