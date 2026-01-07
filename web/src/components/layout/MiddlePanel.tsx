// src/components/layout/MiddlePanel.tsx

import { Calendar, Clock, MapPin, ArrowRight, Trash2, Edit2, Plus, Copy, Trash } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { getTransportLabel } from '../../types/models';
import type { ItineraryItem, ItineraryDay } from '../../types/models';
import { EditItemModal } from '../itinerary/EditItemModal';
import { EditDayModal } from '../itinerary/EditDayModal';
import { CopyItemModal } from '../itinerary/CopyItemModal';

export function MiddlePanel() {
  const { currentTrip, itineraryDays } = useAppStore();
  const [editingItem, setEditingItem] = useState<ItineraryItem | null>(null);
  const [editingDay, setEditingDay] = useState<ItineraryDay | null>(null);
  const [copyingItem, setCopyingItem] = useState<ItineraryItem | null>(null);

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
    <div className="flex-1 flex flex-col bg-gray-50 h-screen overflow-hidden">
      {/* 行程標題列 */}
      <div className="bg-white border-b border-gray-200 p-4 flex-shrink-0">
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

      {/* 每日行程卡片 - 🆕 整體垂直滾動 */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex gap-4">
          {itineraryDays.map(day => (
            <div key={day.day_id} className="flex-shrink-0 w-64">
              <DayColumn
                day={day}
                onEditItem={setEditingItem}
                onEditDay={setEditingDay}
                onCopyItem={setCopyingItem}
              />
            </div>
          ))}

          {/* 🆕 新增 Day 按鈕 */}
          <div className="flex-shrink-0 w-64">
            <AddDayCard />
          </div>
        </div>
      </div>

      {/* 編輯景點彈窗 */}
      {editingItem && (
        <EditItemModal
          item={editingItem}
          isOpen={!!editingItem}
          onClose={() => setEditingItem(null)}
          onSave={(updates: Partial<ItineraryItem>) => {
            useAppStore.getState().updateItineraryItem(editingItem.item_id, updates);
            setEditingItem(null);
          }}
        />
      )}

      {/* 🆕 編輯 Day 彈窗 */}
      {editingDay && (
        <EditDayModal
          day={editingDay}
          isOpen={!!editingDay}
          onClose={() => setEditingDay(null)}
          onSave={(notes: string) => {
            useAppStore.getState().updateDayNotes(editingDay.day_id, notes);
            setEditingDay(null);
          }}
        />
      )}

      {/* 🆕 複製景點彈窗 */}
      {copyingItem && (
        <CopyItemModal
          item={copyingItem}
          allDays={itineraryDays}
          isOpen={!!copyingItem}
          onClose={() => setCopyingItem(null)}
          onCopy={(targetDayId: string) => {
            useAppStore.getState().copyItemToDay(copyingItem.item_id, targetDayId);
            setCopyingItem(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * 🆕 可放置的單日行程欄
 */
function DayColumn({
  day,
  onEditItem,
  onEditDay,
  onCopyItem,
}: {
  day: any;
  onEditItem: (item: ItineraryItem) => void;
  onEditDay: (day: ItineraryDay) => void;
  onCopyItem: (item: ItineraryItem) => void;
}) {
  const { removeDay, clearDay } = useAppStore();
  const { setNodeRef, isOver } = useDroppable({
    id: day.day_id,
    data: {
      type: 'day',
      day,
    },
  });

  const itemIds = day.items.map((item: any) => item.item_id);

  return (
    <div
      ref={setNodeRef}
      className={`bg-white rounded-lg border shadow-sm transition-all flex flex-col ${
        isOver ? 'border-primary-500 border-2 ring-2 ring-primary-200' : 'border-gray-200'
      }`}
    >
      {/* 日期標題 */}
      <div className="p-4 border-b border-gray-200 bg-gray-50 group relative">
        <h3 className="font-semibold text-gray-900">Day {day.day_number}</h3>
        {day.date && (
          <p className="text-sm text-gray-600 mt-1">
            {new Date(day.date).toLocaleDateString('zh-TW', {
              month: 'long',
              day: 'numeric',
              weekday: 'short',
            })}
          </p>
        )}

        {/* 🆕 Day 操作按鈕 */}
        <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEditDay(day)}
            className="p-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
            title="編輯此天"
          >
            <Edit2 className="w-3 h-3" />
          </button>
          {day.items.length > 0 && (
            <button
              onClick={() => {
                if (confirm(`確定要清空 Day ${day.day_number} 的所有景點嗎？`)) {
                  clearDay(day.day_id);
                }
              }}
              className="p-1 bg-orange-50 text-orange-600 rounded hover:bg-orange-100"
              title="清空此天"
            >
              <Trash className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={() => {
              if (confirm(`確定要刪除 Day ${day.day_number} 嗎？\n此天的所有景點將被移除。`)) {
                removeDay(day.day_id);
              }
            }}
            className="p-1 bg-red-50 text-red-600 rounded hover:bg-red-100"
            title="刪除此天"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* 🆕 可排序的景點列表 */}
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div className="flex-1 p-3 space-y-2">
          {day.items.length === 0 ? (
            <div
              className={`text-center py-12 rounded-lg transition-colors ${
                isOver ? 'bg-primary-50' : 'text-gray-400'
              }`}
            >
              <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {isOver ? '放開以加入此天' : '將地點拖曳至此'}
              </p>
            </div>
          ) : (
            day.items.map((item: any, idx: number) => (
              <div key={item.item_id}>
                <SortablePlaceItem
                  item={item}
                  onEdit={onEditItem}
                  onCopy={onCopyItem}
                />
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
      </SortableContext>

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
 * 🆕 新增 Day 卡片
 */
function AddDayCard() {
  const addNewDay = useAppStore(state => state.addNewDay);

  return (
    <button
      onClick={addNewDay}
      className="bg-white border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-all w-full min-h-[400px] flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-primary-600"
    >
      <Plus className="w-8 h-8" />
      <span className="font-medium">新增一天</span>
    </button>
  );
}

/**
 * 🆕 可排序的地點項目
 */
function SortablePlaceItem({
  item,
  onEdit,
  onCopy,
}: {
  item: ItineraryItem;
  onEdit: (item: ItineraryItem) => void;
  onCopy: (item: ItineraryItem) => void;
}) {
  const removeItemFromDay = useAppStore(state => state.removeItemFromDay);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: item.item_id,
    data: {
      type: 'item',
      item,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // 🆕 鍵盤快捷鍵：Delete 刪除
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (confirm(`確定要刪除「${item.place.name}」嗎？`)) {
        removeItemFromDay(item.item_id);
      }
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white border rounded-lg p-3 hover:shadow-md transition-all cursor-grab active:cursor-grabbing relative group ${
        isOver ? 'border-primary-500 border-2 bg-primary-50' : 'border-gray-200'
      }`}
      // tabIndex={0}
      onKeyDown={handleKeyDown}
      {...attributes}
      {...listeners}
    >
      {/* 🆕 操作按鈕組 */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={e => {
            e.stopPropagation();
            onCopy(item);
          }}
          className="p-1 bg-green-50 text-green-600 rounded hover:bg-green-100"
          title="複製到其他天"
        >
          <Copy className="w-3 h-3" />
        </button>
        <button
          onClick={e => {
            e.stopPropagation();
            onEdit(item);
          }}
          className="p-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
          title="編輯此景點"
        >
          <Edit2 className="w-3 h-3" />
        </button>
        <button
          onClick={e => {
            e.stopPropagation();
            removeItemFromDay(item.item_id);
          }}
          className="p-1 bg-red-50 text-red-600 rounded hover:bg-red-100"
          title="移除此景點"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* 時間 */}
      {item.scheduled_time && (
        <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
          <Clock className="w-3 h-3" />
          <span>{item.scheduled_time}</span>
          {item.duration_minutes && (
            <span className="text-gray-400">({item.duration_minutes} 分鐘)</span>
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
        {getTransportLabel(mode as ItineraryItem['transport_to_next'])}
        {duration && ` (${duration} 分鐘)`}
      </span>
    </div>
  );
}