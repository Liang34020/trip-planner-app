// src/components/layout/MiddlePanel.tsx

import { Calendar, Clock, MapPin, ArrowRight, Trash2, Edit2, Plus, Copy, Trash, Navigation } from 'lucide-react';
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
import { EditTransportModal } from '../itinerary/EditTransportModal';

export function MiddlePanel() {
  const { currentTrip, itineraryDays } = useAppStore();
  const [editingItem, setEditingItem] = useState<ItineraryItem | null>(null);
  const [editingDay, setEditingDay] = useState<ItineraryDay | null>(null);
  const [copyingItem, setCopyingItem] = useState<ItineraryItem | null>(null);
  const [editingTransport, setEditingTransport] = useState<{
    itemId: string;
    currentMode?: string;
  } | null>(null);

  if (!currentTrip) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50">
        <div className="empty-state animate-scale-in">
          <Calendar className="empty-state-icon animate-pulse-soft" />
          <h3 className="empty-state-title">尚未選擇行程</h3>
          <p className="empty-state-description">建立或選擇一個旅遊專案開始規劃</p>
          <button className="btn btn-primary">+ 建立新行程</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-br from-gray-50 via-blue-50/20 to-gray-50 h-screen overflow-hidden">
      {/* 行程標題列 */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-100 p-4 flex-shrink-0 shadow-soft">
        <h1 className="text-2xl font-bold text-gradient mb-2 animate-fade-in">
          {currentTrip.trip_name}
        </h1>
        <div className="flex items-center gap-4 text-sm text-gray-600 animate-fade-in animation-delay-100">
          <span className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-lg shadow-sm">
            <MapPin className="w-4 h-4 text-primary-500" />
            {currentTrip.destination}
          </span>
          <span className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-lg shadow-sm">
            <Calendar className="w-4 h-4 text-primary-500" />
            {currentTrip.start_date} ~ {currentTrip.end_date}
          </span>
        </div>
      </div>

      {/* 每日行程卡片 - ✅ 移除滾動條 */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
        <div className="flex gap-4">
          {itineraryDays.map(day => (
            <div key={day.day_id} className="flex-shrink-0 w-64">
              <DayColumn
                day={day}
                onEditItem={setEditingItem}
                onEditDay={setEditingDay}
                onCopyItem={setCopyingItem}
                onEditTransport={(itemId, currentMode) => setEditingTransport({ itemId, currentMode })}
              />
            </div>
          ))}

          {/* 新增 Day 按鈕 */}
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

      {/* 編輯 Day 彈窗 */}
      {editingDay && (
        <EditDayModal
          day={editingDay}
          isOpen={!!editingDay}
          onClose={() => setEditingDay(null)}
          onSave={(notes: string, defaultTransport?: ItineraryDay['default_transport']) => {
            useAppStore.getState().updateDayNotes(editingDay.day_id, notes);
            if (defaultTransport !== undefined) {
              useAppStore.getState().updateDayDefaultTransport(editingDay.day_id, defaultTransport);
            }
            setEditingDay(null);
          }}
        />
      )}

      {/* 複製景點彈窗 */}
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

      {/* 編輯交通方式彈窗 */}
      {editingTransport && (
        <EditTransportModal
          itemId={editingTransport.itemId}
          currentMode={editingTransport.currentMode}
          isOpen={!!editingTransport}
          onClose={() => setEditingTransport(null)}
          onSave={(mode: string) => {
            useAppStore.getState().updateItineraryItem(editingTransport.itemId, {
              transport_to_next: mode as ItineraryItem['transport_to_next'],
            });
            setEditingTransport(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * ✅ 可拖移的單日行程欄
 */
function DayColumn({
  day,
  onEditItem,
  onEditDay,
  onCopyItem,
  onEditTransport,
}: {
  day: any;
  onEditItem: (item: ItineraryItem) => void;
  onEditDay: (day: ItineraryDay) => void;
  onCopyItem: (item: ItineraryItem) => void;
  onEditTransport: (itemId: string, currentMode?: string) => void;
}) {
  const { removeDay, clearDay } = useAppStore();
  
  // ✅ 使用 useSortable 讓整個 Day 可拖移
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging: isDayDragging,
  } = useSortable({
    id: day.day_id,
    data: {
      type: 'day',
      day,
    },
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `${day.day_id}-droppable`,
    data: {
      type: 'day',
      day,
    },
  });

  const itemIds = day.items.map((item: any) => item.item_id);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDayDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={node => {
        setSortableRef(node);
        setDroppableRef(node);
      }}
      style={style}
      className={`bg-white/90 backdrop-blur-sm rounded-xl border transition-all duration-300 flex flex-col animate-fade-in
        ${isOver 
          ? 'border-primary-500 border-2 ring-4 ring-primary-200 shadow-lg scale-[1.02]' 
          : isDayDragging 
            ? 'border-gray-300 shadow-soft opacity-50'
            : 'border-gray-200 shadow-soft'
        }`}
    >
      {/* ✅ 日期標題 - 可拖移 */}
      <div 
        className="p-4 border-b border-gray-100 bg-gradient-to-r from-primary-50/50 to-white group relative cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse-soft"></div>
          <h3 className="font-bold text-gray-900">Day {day.day_number}</h3>
        </div>
        {day.date && (
          <p className="text-sm text-gray-600 mt-1.5 ml-4">
            {new Date(day.date).toLocaleDateString('zh-TW', {
              month: 'long',
              day: 'numeric',
              weekday: 'short',
            })}
          </p>
        )}

        {/* Day 操作按鈕 */}
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

      {/* ✅ 可排序的景點列表 - 移除滾動條 */}
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-hide">
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
                {/* ✅ 交通連接器：只在不是最後一個景點時顯示 */}
                {idx < day.items.length - 1 && (
                  <TransportConnector
                    item={item}
                    dayDefaultTransport={day.default_transport}
                    onEdit={() => onEditTransport(item.item_id, item.transport_to_next)}
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
 * 新增 Day 卡片
 */
function AddDayCard() {
  const addNewDay = useAppStore(state => state.addNewDay);

  return (
    <button
      onClick={addNewDay}
      className="bg-white/50 backdrop-blur-sm border-2 border-dashed border-gray-300 rounded-xl hover:border-primary-400 hover:bg-primary-50/50 transition-all duration-300 w-full min-h-[400px] flex flex-col items-center justify-center gap-3 text-gray-500 hover:text-primary-600 group animate-fade-in hover:shadow-soft hover:scale-[1.02]"
    >
      <div className="p-4 bg-white rounded-full shadow-soft group-hover:shadow-medium transition-all">
        <Plus className="w-8 h-8 group-hover:rotate-90 transition-transform duration-300" />
      </div>
      <span className="font-semibold text-lg">新增一天</span>
    </button>
  );
}

/**
 * 可排序的地點項目
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
      className={`bg-white border rounded-xl p-3 transition-all duration-300 cursor-grab active:cursor-grabbing relative group ${
        isOver ? 'border-primary-400 border-2 bg-primary-50 shadow-medium scale-[1.02]' : 'border-gray-200 hover:border-primary-300 hover:shadow-soft'
      } ${isDragging ? 'opacity-50 scale-95' : ''}`}
      onKeyDown={handleKeyDown}
      {...attributes}
      {...listeners}
    >
      {/* 操作按鈕組 */}
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

      {/* ✅ 地點名稱 + 備註（同一行、垂直置中） */}
      <div className="flex items-center gap-2 mb-1">
        <h4 className="font-medium text-gray-900 text-sm flex-1">
          {item.place.name}
        </h4>
        {item.notes && (
          <p className="text-xs text-gray-600 italic flex-shrink-0">💡 {item.notes}</p>
        )}
      </div>
    </div>
  );
}

/**
 * ✅ 交通連接器（獨立卡片、間距縮小）
 */
function TransportConnector({
  item,
  dayDefaultTransport,
  onEdit,
}: {
  item: ItineraryItem;
  dayDefaultTransport?: string;
  onEdit: () => void;
}) {
  // 使用 item 的交通方式，若無則使用 Day 預設
  const transportMode = item.transport_to_next || dayDefaultTransport;
  const hasTransport = !!transportMode;

  return (
    <div
      className="group relative flex items-center justify-center py-1.5 cursor-pointer"
      onClick={onEdit}
    >
      {/* 連接線 */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-px h-full bg-gray-200 group-hover:bg-primary-300 transition-colors"></div>
      </div>

      {/* 內容區 */}
      <div className="relative z-10 flex items-center gap-2 px-3 py-1 bg-white border border-gray-200 rounded-lg group-hover:border-primary-400 group-hover:shadow-soft transition-all">
        {hasTransport ? (
          <>
            <Navigation className="w-3 h-3 text-gray-500 group-hover:text-primary-600 transition-colors" />
            <span className="text-xs text-gray-600 group-hover:text-primary-700 font-medium">
              {getTransportLabel(transportMode as ItineraryItem['transport_to_next'])}
            </span>
            {item.transport_duration_minutes && (
              <span className="text-xs text-gray-400">
                ({item.transport_duration_minutes} 分鐘)
              </span>
            )}
          </>
        ) : (
          <>
            <Plus className="w-3 h-3 text-gray-400 group-hover:text-primary-600 transition-colors" />
            <span className="text-xs text-gray-400 group-hover:text-primary-700 font-medium">
              點擊設定交通方式
            </span>
          </>
        )}
      </div>
    </div>
  );
}