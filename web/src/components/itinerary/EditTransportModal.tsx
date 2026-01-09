// src/components/itinerary/EditTransportModal.tsx

import { X, Navigation, Footprints, Train, Car, Bus, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface EditTransportModalProps {
  itemId: string;
  currentMode?: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (mode: string) => void;
}

const TRANSPORT_OPTIONS = [
  { value: 'walk', label: '步行', icon: Footprints, color: 'text-green-600', bgColor: 'bg-green-50' },
  { value: 'subway', label: '地鐵', icon: Train, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  { value: 'bus', label: '公車', icon: Bus, color: 'text-orange-600', bgColor: 'bg-orange-50' },
  { value: 'taxi', label: '計程車', icon: Car, color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
  { value: 'drive', label: '開車', icon: Car, color: 'text-purple-600', bgColor: 'bg-purple-50' },
];

export function EditTransportModal({
  currentMode,
  isOpen,
  onClose,
  onSave,
}: EditTransportModalProps) {
  const [selectedMode, setSelectedMode] = useState(currentMode || '');

  if (!isOpen) return null;

  function handleSave() {
    if (selectedMode) {
      onSave(selectedMode);
    }
    onClose();
  }

  function handleRemove() {
    onSave('');
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-scale-in">
        {/* 標題列 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Navigation className="w-5 h-5 text-primary-500" />
            選擇交通方式
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 內容 */}
        <div className="p-4">
          <div className="grid grid-cols-2 gap-3">
            {TRANSPORT_OPTIONS.map(option => {
              const Icon = option.icon;
              const isSelected = selectedMode === option.value;

              return (
                <button
                  key={option.value}
                  onClick={() => setSelectedMode(option.value)}
                  className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                    isSelected
                      ? `border-primary-500 ${option.bgColor} shadow-soft scale-105`
                      : 'border-gray-200 hover:border-gray-300 hover:shadow-soft'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className={`p-3 rounded-full ${option.bgColor}`}>
                      <Icon className={`w-6 h-6 ${option.color}`} />
                    </div>
                    <span className={`text-sm font-medium ${
                      isSelected ? 'text-gray-900' : 'text-gray-600'
                    }`}>
                      {option.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 按鈕列 */}
        <div className="flex gap-2 p-4 border-t border-gray-100">
          {currentMode && (
            <button
              onClick={handleRemove}
              className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              移除
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!selectedMode}
            className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            確定
          </button>
        </div>
      </div>
    </div>
  );
}