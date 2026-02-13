// src/components/layout/MiddlePanel.tsx

import { Calendar, Clock, MapPin, ArrowRight, Trash2, Edit2, Plus, Copy, Trash, Navigation } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState, useEffect, useRef } from 'react';
import React from 'react'
import { useAppStore } from '../../store/appStore';
import { getTransportLabel } from '../../types/models';
import type { ItineraryItem, ItineraryDay } from '../../types/models';
import { EditItemModal } from '../itinerary/EditItemModal';
import { EditDayModal } from '../itinerary/EditDayModal';
import { CopyItemModal } from '../itinerary/CopyItemModal';
import { EditTransportModal } from '../itinerary/EditTransportModal';
import { setGlobalInsertInfo, getGlobalMouseY } from './AppLayout';

export function MiddlePanel() {
  const currentTrip = useAppStore(state => state.currentTrip);
  const itineraryDays = useAppStore(state => state.itineraryDays);
  
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

      {/* 每日行程卡片 */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
        <div className="flex gap-4">
          {itineraryDays.map((day: ItineraryDay) => (
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
 * 單日行程欄
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
  
  const [itemOverIndex, setItemOverIndex] = useState<number | null>(null);
  
  // ✅ 儲存每個景點的 ref，用於計算中點位置
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  
  const { setNodeRef, isOver } = useDroppable({
    id: `${day.day_id}-droppable`,
    data: {
      type: 'day-droppable',
      dayId: day.day_id,
      day,
    },
  });

  const itemIds = day.items.map((item: any) => item.item_id);
  
  // ✅ 當插入位置改變時，更新全局狀態
  useEffect(() => {
    if (itemOverIndex !== null) {
      setGlobalInsertInfo({
        dayId: day.day_id,
        insertIndex: itemOverIndex,
      });
    } else {
      setGlobalInsertInfo(null);
    }
  }, [itemOverIndex, day.day_id]);
  
  // ✅ 方案 C：當滑鼠在空白區域時，尋找最近的分界線
  useEffect(() => {
    if (isOver && itemOverIndex === null && day.items.length > 0) {
      const mouseY = getGlobalMouseY();
      if (!mouseY) return;
      
      // 計算所有分界線位置（景點中點）
      const boundaries: { position: number; insertIndex: number }[] = [];
      
      itemRefs.current.forEach((ref, idx) => {
        if (!ref) return;
        const rect = ref.getBoundingClientRect();
        const middle = rect.top + rect.height / 2;
        boundaries.push({ position: middle, insertIndex: idx });
      });
      
      // 加上最後一個景點的下方分界線
      if (itemRefs.current.length > 0) {
        const lastRef = itemRefs.current[itemRefs.current.length - 1];
        if (lastRef) {
          const lastRect = lastRef.getBoundingClientRect();
          const lastMiddle = lastRect.top + lastRect.height / 2;
          boundaries.push({ 
            position: lastMiddle, 
            insertIndex: day.items.length 
          });
        }
      }
      
      // 找到最接近的分界線
      let closestIndex = 0;
      let minDistance = Infinity;
      
      boundaries.forEach((boundary) => {
        const distance = Math.abs(mouseY - boundary.position);
        if (distance < minDistance) {
          minDistance = distance;
          closestIndex = boundary.insertIndex;
        }
      });
      
      // 判定插入位置
      const closestBoundary = boundaries.find(b => b.insertIndex === closestIndex);
      if (closestBoundary) {
        if (mouseY < closestBoundary.position) {
          setItemOverIndex(closestIndex);
        } else {
          setItemOverIndex(closestIndex + 1);
        }
      }
      
      console.log('🔵 空白區域判定:', {
        mouseY,
        boundaries,
        closestIndex,
        finalInsertIndex: itemOverIndex,
      });
    }
  }, [isOver, itemOverIndex, day.items.length]);
  
  // ✅ 只有空 Day 且有東西懸停時才高亮整個 Day
  const shouldHighlightDay = isOver && day.items.length === 0 && itemOverIndex === null;

  return (
    <div
      ref={setNodeRef}
      className={`bg-white/90 backdrop-blur-sm rounded-xl overflow-hidden border transition-all duration-150 flex flex-col animate-fade-in
        ${shouldHighlightDay
          ? 'border-primary-400 border-2 ring-4 ring-primary-100 shadow-medium scale-[1.02]'
          : 'border-gray-200 shadow-soft'
        }`}
    >
      {/* 日期標題 */}
      <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-primary-50/50 to-white group relative">
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
                if (confirm(`確定要清空 Day ${day.day_number} 的所有景點嗎?`)) {
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
              if (confirm(`確定要刪除 Day ${day.day_number} 嗎?\n此天的所有景點將被移除。`)) {
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

      {/* 景點清單 */}
      <div className="flex-1 p-3 overflow-y-auto scrollbar-hide min-h-[300px]">
        {day.items.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-400 text-sm">
            <div className="text-center">
              <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>將地點拖曳至此</p>
            </div>
          </div>
        ) : (
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-2 relative">
              {day.items.map((item: ItineraryItem, idx: number) => (
                <div key={item.item_id} className="relative">
                  {/* ✅ 第一個景點上方的插入線（只在 index=0 時顯示）*/}
                  {itemOverIndex === 0 && idx === 0 && (
                    <div className="relative h-0 -mb-2">
                      <div className="absolute inset-x-0 -top-1 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent rounded-full shadow-lg animate-pulse-soft z-30"></div>
                    </div>
                  )}
                  
                  <SortablePlaceItem
                    item={item}
                    dayId={day.day_id}
                    index={idx}
                    totalItems={day.items.length}
                    onEdit={onEditItem}
                    onCopy={onCopyItem}
                    onItemOverChange={setItemOverIndex}
                    ref={(el) => (itemRefs.current[idx] = el)}
                  />

                  {/* ✅ 交通連接器 - 永遠顯示（除了最後一個） */}
                  {idx < day.items.length - 1 && (
                    <div className="relative">
                      <TransportConnector
                        item={item}
                        dayDefaultTransport={day.default_transport}
                        onEdit={() => onEditTransport(item.item_id, item.transport_to_next)}
                      />
                      
                      {/* ✅ 插入指示線 - 浮在交通方式上方 */}
                      {itemOverIndex === idx + 1 && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                          <div className="w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent rounded-full shadow-lg animate-pulse-soft"></div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* ✅ LastPositionDroppable - 最後一個景點下方的拖曳區域 */}
              {day.items.length > 0 && (
                <LastPositionDroppable
                  dayId={day.day_id}
                  insertIndex={day.items.length}
                  itemOverIndex={itemOverIndex}
                />
              )}
            </div>
          </SortableContext>
        )}
      </div>
    </div>
  );
}

/**
 * 新增 Day 卡片
 */
function AddDayCard() {
  const addNewDay = useAppStore(state => state.addDay);

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
 * ✅ 可排序的地點項目 - 使用真實滑鼠座標
 */
const SortablePlaceItem = React.forwardRef<HTMLDivElement, {
  item: ItineraryItem;
  dayId: string;
  index: number;
  totalItems: number;
  onEdit: (item: ItineraryItem) => void;
  onCopy: (item: ItineraryItem) => void;
  onItemOverChange: (index: number | null) => void;
}>(({ item, dayId, index, totalItems, onEdit, onCopy, onItemOverChange }, ref) => {
  const removeItemFromDay = useAppStore(state => state.removeItemFromDay);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
    active,
    rect,
    over,
  } = useSortable({
    id: item.item_id,
    data: {
      type: 'itinerary-item',
      dayId,
      index,
      item,
    },
  });

  // ✅ 使用真實滑鼠座標判定插入位置
  useEffect(() => {
    if (!isOver || isDragging) {
      return;
    }

    if (!rect.current) {
      return;
    }

    const node = rect.current;
    const cardHeight = node.height;
    const cardTop = node.top;
    const cardMiddle = cardTop + cardHeight / 2;
    
    // ✅ 使用真實滑鼠座標
    const mouseY = getGlobalMouseY();
    if (!mouseY) return;

    // 判定邏輯：
    // - 滑鼠在「景點中點以上」→ 插入到當前項目「上方」(index)
    // - 滑鼠在「景點中點以下」→ 插入到當前項目「下方」(index + 1)
    const insertIndex = mouseY < cardMiddle ? index : index + 1;
    
    onItemOverChange(insertIndex);
    
    console.log('🔵 插入位置判定:', {
      index,
      mouseY,
      cardTop,
      cardMiddle,
      cardBottom: node.bottom,
      insertIndex,
      判定說明: mouseY < cardMiddle ? '滑鼠在中點上方' : '滑鼠在中點下方'
    });
  }, [isOver, isDragging, rect, index, onItemOverChange]);

  // 清理狀態
  useEffect(() => {
    if (!isOver && !isDragging) {
      onItemOverChange(null);
    }
  }, [isOver, isDragging, onItemOverChange]);

  // ✅ 合併 refs
  const combinedRef = (node: HTMLDivElement | null) => {
    setNodeRef(node);
    if (typeof ref === 'function') {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }
  };

  const style = {
    opacity: isDragging ? 0 : 1,
    transform: 'none',
    transition: 'none',
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (confirm(`確定要刪除「${item.place.name}」嗎?`)) {
        removeItemFromDay(item.item_id);
      }
    }
  };

  const formatTime = (time24: string) => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const period = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${period}`;
  };

  return (
    <div
      ref={combinedRef}
      style={style}
      className="bg-white border border-gray-200 rounded-xl p-3 transition-all duration-150 cursor-grab active:cursor-grabbing relative group hover:border-primary-300 hover:shadow-soft"
      onKeyDown={handleKeyDown}
      {...attributes}
      {...listeners}
    >
      {/* 操作按鈕組 */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
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
          <span>{formatTime(item.scheduled_time)}</span>
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
        <p className="text-xs text-gray-600 italic mt-1">
          {item.notes}
        </p>
      )}
    </div>
  );
});

SortablePlaceItem.displayName = 'SortablePlaceItem';

/**
 * ✅ LastPositionDroppable - 最後一個景點下方的拖曳區域
 */
function LastPositionDroppable({
  dayId,
  insertIndex,
  itemOverIndex,
}: {
  dayId: string;
  insertIndex: number;
  itemOverIndex: number | null;
}) {
  const { setNodeRef } = useDroppable({
    id: `last-position-${dayId}`,
    data: {
      type: 'last-position',
      dayId,
      insertIndex,
    },
  });

  return (
    <div 
      ref={setNodeRef}
      className="relative flex-1 min-h-[80px]"
    >
      {/* 插入線 */}
      {itemOverIndex === insertIndex && (
        <div className="relative py-2">
          <div className="h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent rounded-full shadow-lg animate-pulse-soft"></div>
        </div>
      )}
    </div>
  );
}

/**
 * 交通連接器
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
  const transportMode = item.transport_to_next || dayDefaultTransport;
  const hasTransport = !!transportMode;

  return (
    <div
      className="group relative flex items-center justify-center py-1.5 cursor-pointer"
      onClick={onEdit}
    >
      {/* 連接線 */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
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

// 需要 import React
// import React from 'react';