// src/components/layout/AppLayout.tsx

import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { LeftPanel } from './LeftPanel';
import { MiddlePanel } from './MiddlePanel';
import { RightPanel } from './RightPanel';
import type { SavedPlace, ItineraryItem } from '../../types/models';

export function AppLayout() {
  const {
    isLeftPanelCollapsed,
    toggleLeftPanel,
    addItemToDay,
    reorderItemInDay,
    itineraryDays,
    reorderDays,
  } = useAppStore();

  // ✅ 拖曳狀態管理
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'place' | 'item' | 'day' | null>(null);
  const [activeSavedPlace, setActiveSavedPlace] = useState<SavedPlace | null>(null);
  const [activeItem, setActiveItem] = useState<ItineraryItem | null>(null);

  // 配置拖曳感應器（8px 防止誤觸）
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  /**
   * ✅ 拖曳開始處理
   */
  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    const activeData = active.data.current;

    setActiveId(active.id as string);

    // ✅ 禁止所有滾動
    
    document.body.style.overflow = 'hidden';
    // 禁止內部元素滾動
    const scrollableElements = document.querySelectorAll('.overflow-y-auto, .overflow-x-auto, .overflow-auto');
    scrollableElements.forEach(el => {
      (el as HTMLElement).style.overflow = 'hidden';
    });

    if (activeData?.type === 'place') {
      setActiveType('place');
      setActiveSavedPlace(activeData.savedPlace);
    } else if (activeData?.type === 'item') {
      setActiveType('item');
      setActiveItem(activeData.item);
    } else if (activeData?.type === 'day') {
      setActiveType('day');
    }
  }

  /**
   * ✅ 拖曳取消處理（按 ESC 或拖出範圍）
   */
  function handleDragCancel() {
    setActiveId(null);
    setActiveType(null);
    setActiveSavedPlace(null);
    setActiveItem(null);
    
    // ✅ 恢復所有滾動
    document.body.style.overflow = '';
    const scrollableElements = document.querySelectorAll('.overflow-y-auto, .overflow-x-auto, .overflow-auto');
    scrollableElements.forEach(el => {
      (el as HTMLElement).style.overflow = '';
    });
  }

  /**
   * 拖曳懸停處理（視覺回饋）
   */
  function handleDragOver(_event: DragOverEvent) {
    // 目前只用於觸發 isOver 狀態，不需要額外邏輯
  }

  /**
   * ✅ 拖曳結束處理（支援 Day、Place、Item）
   */
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // ✅ Case 0: 拖曳 Day（整天排序）
    if (activeData?.type === 'day' && overData?.type === 'day') {
      const oldIndex = itineraryDays.findIndex(d => d.day_id === activeData.day.day_id);
      const newIndex = itineraryDays.findIndex(d => d.day_id === overData.day.day_id);

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        reorderDays(oldIndex, newIndex);
        console.log(`✅ Day ${oldIndex + 1} 移動到 Day ${newIndex + 1}`);
      }
      return;
    }

    // Case 1: 從收藏池拖曳地點
    if (activeData?.type === 'place') {
      const { savedPlace } = activeData;
      let targetDayId: string;
      let dropIndex: number;

      // Case 1A: 拖曳到 Day 容器（空白區域）
      if (overData?.type === 'day') {
        targetDayId = overData.day.day_id;
        dropIndex = overData.day.items.length; // 放到最後
      }
      // Case 1B: 拖曳到現有 item 上方
      else if (overData?.type === 'item') {
        targetDayId = overData.item.day_id;

        // 找到目標位置（插入到該 item 之前）
        const itineraryDays = useAppStore.getState().itineraryDays;
        const targetDay = itineraryDays.find(d => d.day_id === targetDayId);
        if (!targetDay) return;

        const targetIndex = targetDay.items.findIndex(
          i => i.item_id === over.id
        );
        dropIndex = targetIndex;
      } else {
        return;
      }

      addItemToDay(
        savedPlace.place.place_id,
        savedPlace.saved_id,
        targetDayId,
        dropIndex
      );

      console.log(
        `✅ 將 ${savedPlace.place.name} 加入行程（位置 ${dropIndex}）`
      );
    }

    // Case 2: 在同一天或跨天重新排序
    else if (activeData?.type === 'item') {
      const { item } = activeData;
      let targetDayId: string;
      let dropIndex: number;

      if (overData?.type === 'day') {
        // 拖曳到空白 Day
        targetDayId = overData.day.day_id;
        dropIndex = overData.day.items.length;
      } else if (overData?.type === 'item') {
        // 拖曳到另一個 item 上方
        targetDayId = overData.item.day_id;

        // 找到目標 item 的索引
        const itineraryDays = useAppStore.getState().itineraryDays;
        const targetDay = itineraryDays.find(d => d.day_id === targetDayId);
        if (!targetDay) return;

        const targetIndex = targetDay.items.findIndex(
          i => i.item_id === over.id
        );

        // 如果是同一天且拖曳到自己後面，索引不變
        if (targetDayId === item.day_id && active.id !== over.id) {
          const activeIndex = targetDay.items.findIndex(
            i => i.item_id === active.id
          );
          dropIndex = activeIndex < targetIndex ? targetIndex : targetIndex;
        } else {
          dropIndex = targetIndex;
        }
      } else {
        return;
      }

      reorderItemInDay(item.item_id, targetDayId, dropIndex);

      console.log(`✅ 將 ${item.place.name} 移動到新位置（索引 ${dropIndex}）`);
    }

    // ✅ 重置拖曳狀態
    setActiveId(null);
    setActiveType(null);
    setActiveSavedPlace(null);
    setActiveItem(null);
    
    // ✅ 恢復所有滾動
    document.body.style.overflow = '';
    const scrollableElements = document.querySelectorAll('.overflow-y-auto, .overflow-x-auto, .overflow-auto');
    scrollableElements.forEach(el => {
      (el as HTMLElement).style.overflow = '';
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex h-screen overflow-hidden bg-gray-50">
        {/* 收藏池（左欄）*/}
        <div
          className={`transition-all duration-300 ease-in-out flex-shrink-0 ${
            isLeftPanelCollapsed ? 'w-0' : 'w-80'
          }`}
        >
          <LeftPanel />
        </div>

        {/* ✅ 折疊按鈕 - 統一使用貼邊長方形樣式 */}
        <button
          onClick={toggleLeftPanel}
          className={`fixed top-1/2 -translate-y-1/2 z-50 w-6 h-16 transition-all duration-300 border border-gray-300 hover:border-primary-500 bg-white shadow-md hover:bg-gray-50 flex items-center justify-center
            ${isLeftPanelCollapsed 
              ? 'left-0 rounded-r-lg' 
              : 'left-[295px] rounded-l-lg'
            }`}
          title={isLeftPanelCollapsed ? '展開收藏池' : '收起收藏池'}
        >
          {isLeftPanelCollapsed ? (
            <ChevronRight className="w-4 h-4 text-gray-700" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-gray-700" />
          )}
        </button>

        {/* 行程編輯器（中欄）*/}
        <div className="flex-1 min-w-0">
          <MiddlePanel />
        </div>

        {/* 地圖（右欄，桌面版顯示）*/}
        <RightPanel />
      </div>

      {/* ✅ 拖曳預覽 - 只顯示 Place 和 Item，不顯示 Day */}
      <DragOverlay dropAnimation={null}>
        {activeType === 'place' && activeSavedPlace && (
          <div className="w-64 opacity-90 scale-105 shadow-2xl">
            <DragPreviewPlaceCard savedPlace={activeSavedPlace} />
          </div>
        )}
        {activeType === 'item' && activeItem && (
          <div className="w-64 opacity-90 scale-105 shadow-2xl">
            <DragPreviewItemCard item={activeItem} />
          </div>
        )}
        {/* Day 拖移不顯示預覽 */}
      </DragOverlay>
    </DndContext>
  );
}

/**
 * ✅ 拖曳預覽 - 收藏池地點卡片
 */
function DragPreviewPlaceCard({ savedPlace }: { savedPlace: SavedPlace }) {
  const { place } = savedPlace;

  return (
    <div className="bg-white rounded-lg border-2 border-primary-500 overflow-hidden shadow-2xl">
      {place.photo_url && (
        <img
          src={place.photo_url}
          alt={place.name}
          className="w-full h-20 object-cover"
        />
      )}
      <div className="p-2">
        <h4 className="font-medium text-gray-900 text-sm">
          {place.name}
        </h4>
      </div>
    </div>
  );
}

/**
 * ✅ 拖曳預覽 - 行程景點卡片
 */
function DragPreviewItemCard({ item }: { item: ItineraryItem }) {
  return (
    <div className="bg-white border-2 border-primary-500 rounded-xl p-3 shadow-2xl">
      {/* 時間 */}
      {item.scheduled_time && (
        <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
          <span>🕐</span>
          <span>{item.scheduled_time}</span>
          {item.duration_minutes && (
            <span className="text-gray-400">({item.duration_minutes} 分鐘)</span>
          )}
        </div>
      )}
      
      {/* 地點名稱 */}
      <h4 className="font-medium text-gray-900 text-sm">
        {item.place.name}
      </h4>
    </div>
  );
}