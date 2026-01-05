// src/components/layout/MiddlePanel.tsx

import { Calendar, Clock, MapPin, ArrowRight } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { TRANSPORT_LABELS } from '../../types/models';

export function MiddlePanel() {
  const { currentTrip, itineraryDays } = useAppStore();

  if (!currentTrip) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            尚未選擇行程
          </h3>
          <p className="text-gray-500 mb-6">建立或選擇一個旅遊專案開始規劃</p>
          <button className="btn-primary">+ 建立新行程</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50 h-screen">
      {/* 行程標題列 */}
      <div className="bg-white border-b border-gray-200 p-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {currentTrip.trip_name}
        </h1>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span className="flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            {currentTrip.destination}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            {currentTrip.start_date} ~ {currentTrip.end_date}
          </span>
        </div>
      </div>

      {/* 每日行程卡片 */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {itineraryDays.map(day => (
            <DayColumn key={day.day_id} day={day} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * 單日行程欄
 */
function DayColumn({ day }: { day: any }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* 日期標題 */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <h3 className="font-semibold text-gray-900">
          Day {day.day_number}
        </h3>
        {day.date && (
          <p className="text-sm text-gray-600 mt-1">
            {new Date(day.date).toLocaleDateString('zh-TW', {
              month: 'long',
              day: 'numeric',
              weekday: 'short',
            })}
          </p>
        )}
      </div>

      {/* 景點列表 */}
      <div className="p-3 space-y-2 min-h-[200px]">
        {day.items.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">將地點拖曳至此</p>
          </div>
        ) : (
          day.items.map((item: any, idx: number) => (
            <div key={item.item_id}>
              <PlaceItem item={item} />
              {idx < day.items.length - 1 && item.transport_to_next && (
                <TransportIndicator
                  mode={item.transport_to_next}
                  duration={item.transport_duration_minutes}
                />
              )}
            </div>
          ))
        )}
      </div>

      {/* 當日備註 */}
      {day.notes && (
        <div className="p-3 border-t border-gray-200 bg-gray-50 text-sm text-gray-600">
          💡 {day.notes}
        </div>
      )}
    </div>
  );
}

/**
 * 行程中的地點項目
 */
function PlaceItem({ item }: { item: any }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow cursor-move">
      {/* 時間 */}
      {item.scheduled_time && (
        <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
          <Clock className="w-3 h-3" />
          <span>{item.scheduled_time}</span>
          {item.duration_minutes && (
            <span className="text-gray-400">
              ({item.duration_minutes} 分鐘)
            </span>
          )}
        </div>
      )}

      {/* 地點名稱 */}
      <h4 className="font-medium text-gray-900 text-sm mb-1">
        {item.place.name}
      </h4>

      {/* 備註 */}
      {item.notes && (
        <p className="text-xs text-gray-600 mt-2 italic">{item.notes}</p>
      )}
    </div>
  );
}

/**
 * 交通方式指示器
 */
function TransportIndicator({
  mode,
  duration,
}: {
  mode: string;
  duration?: number;
}) {
  return (
    <div className="flex items-center justify-center gap-2 py-2 text-xs text-gray-500">
      <ArrowRight className="w-3 h-3" />
      <span>
        {TRANSPORT_LABELS[mode as keyof typeof TRANSPORT_LABELS]}
        {duration && ` (${duration} 分鐘)`}
      </span>
    </div>
  );
}