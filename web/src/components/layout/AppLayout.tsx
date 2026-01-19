import { useState, useEffect } from 'react';
import { DndContext, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { LeftPanel } from './LeftPanel';
import { MiddlePanel } from './MiddlePanel';
import { RightPanel } from './RightPanel';
import { useAppStore } from '../../store/appStore';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';

export default function AppLayout() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'place' | 'item' | 'day' | null>(null);
  
  const { loadTrip, loadSavedPlaces, currentTripDetail, reorderItem, addItemToDay } = useAppStore();

  // 載入資料
  useEffect(() => {
    const initData = async () => {
      // TODO: 從 URL 或用戶選擇獲取 tripId
      // 暫時使用測試 tripId（需要先在 Swagger 建立行程並複製 ID）
      const testTripId = localStorage.getItem('current_trip_id');
      if (testTripId) {
        await loadTrip(testTripId);
      }
      await loadSavedPlaces();
    };

    initData();
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    setActiveId(active.id as string);

    // 判斷拖曳類型
    if (active.data.current?.type === 'saved-place') {
      setActiveType('place');
    } else if (active.data.current?.type === 'itinerary-item') {
      setActiveType('item');
    } else if (active.data.current?.type === 'day') {
      setActiveType('day');
    }

    // 禁止收藏池滾動
    const leftPanel = document.querySelector('.left-panel-scroll');
    if (leftPanel) {
      leftPanel.classList.add('overflow-hidden');
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    // 恢復滾動
    const leftPanel = document.querySelector('.left-panel-scroll');
    if (leftPanel) {
      leftPanel.classList.remove('overflow-hidden');
    }

    setActiveId(null);
    setActiveType(null);

    if (!over || !over.data.current) return;

    const activeId = active.id as string;
    const overType = over.data.current.type;

    // 情況 1: 從收藏池拖曳到 Day
    if (active.data.current?.type === 'saved-place' && overType === 'day-droppable') {
      const placeId = active.data.current.placeId;
      const dayId = over.data.current.dayId;
      
      await addItemToDay(placeId, dayId);
      return;
    }

    // 情況 2: 從收藏池拖曳到 Item 之間
    if (active.data.current?.type === 'saved-place' && overType === 'itinerary-item') {
      const targetItem = over.data.current;
      if (!targetItem) return;
      
      const placeId = active.data.current.placeId;
      const dayId = targetItem.dayId;
      const position = targetItem.index;

      await addItemToDay(placeId, dayId, position);
      return;
    }

    // 情況 3: Item 之間拖曳（同一天或跨天）
    if (active.data.current?.type === 'itinerary-item' && overType === 'itinerary-item') {
      if (!over.data.current) return;
      
      const itemId = activeId;
      const targetDayId = over.data.current.dayId;
      const targetPosition = over.data.current.index;

      await reorderItem(itemId, targetDayId, targetPosition);
      return;
    }

    // 情況 4: 拖曳到空的 Day
    if (active.data.current?.type === 'itinerary-item' && overType === 'day-droppable') {
      if (!over.data.current) return;
      
      const itemId = activeId;
      const targetDayId = over.data.current.dayId;

      await reorderItem(itemId, targetDayId, 0);
      return;
    }

    // 情況 5: Day 之間拖曳（整天排序）
    // TODO: 實作整天排序功能
  }

  if (!currentTripDetail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">載入行程中...</p>
          <p className="text-sm text-gray-500 mt-2">
            如果這是第一次使用，請先在 Swagger UI 建立行程
          </p>
          <a 
            href="http://localhost:8000/api/docs" 
            target="_blank"
            className="text-primary-600 hover:underline text-sm mt-2 inline-block"
          >
            前往 Swagger UI →
          </a>
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-screen flex bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <LeftPanel />
        <MiddlePanel />
        <RightPanel />

        <DragOverlay dropAnimation={null}>
          {activeType === 'place' && activeId && (
            <div className="w-64 opacity-90 scale-105 shadow-2xl bg-white rounded-lg p-4">
              拖曳中...
            </div>
          )}
        </DragOverlay>
      </div>
    </DndContext>
  );
}