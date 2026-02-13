import { useState, useEffect } from 'react';
import { 
  DndContext, 
  DragOverlay, 
  closestCenter, 
  PointerSensor, 
  useSensor, 
  useSensors,
  useDndMonitor } from '@dnd-kit/core';
import type { 
  DragStartEvent,
  DragEndEvent } from '@dnd-kit/core';

import { LeftPanel } from './LeftPanel';
import { MiddlePanel } from './MiddlePanel';
import { RightPanel } from './RightPanel';
import { useAppStore } from '../../store/appStore';

// ✅ 全局狀態：儲存當前的插入位置資訊
let globalInsertInfo: {
  dayId: string;
  insertIndex: number;
} | null = null;

// ✅ 全局變數：儲存真實滑鼠 Y 座標
let globalMouseY: number | null = null;

// ✅ 導出函數供其他組件使用
export function setGlobalInsertInfo(info: { dayId: string; insertIndex: number } | null) {
  globalInsertInfo = info;
}

export function getGlobalMouseY(): number | null {
  return globalMouseY;
}

export default function AppLayout() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'place' | 'item' | 'day' | null>(null);
  
  const { 
    loadTrip, 
    loadSavedPlaces, 
    currentTripDetail, 
    reorderItem, 
    addItemToDay,
    savedPlaces,
    removeItemFromDay
  } = useAppStore();

  // 載入資料
  useEffect(() => {
    const initData = async () => {
      const testTripId = localStorage.getItem('current_trip_id');
      if (testTripId) {
        await loadTrip(testTripId);
      }
      await loadSavedPlaces();
    };

    initData();
  }, [loadTrip, loadSavedPlaces]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
        delay: 100,
      },
    })
  );

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    setActiveId(active.id as string);

    // 判斷拖曳類型
    const activeData = active.data.current;
    if (activeData?.type === 'saved-place') {
      setActiveType('place');
    } else if (activeData?.type === 'itinerary-item') {
      setActiveType('item');
    } else if (activeData?.type === 'day') {
      setActiveType('day');
    }

    console.log('🟢 拖曳開始:', {
      activeId: active.id,
      activeType: activeData?.type,
    });
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    // 重置狀態
    setActiveId(null);
    setActiveType(null);

    if (!over) {
      console.log('🔵 拖曳取消：放回原處（over 為 null）');
      globalInsertInfo = null;
      return;
    }

    if (!over.data.current) {
      console.log('🔵 拖曳取消：無效目標（over.data.current 為 null）');
      globalInsertInfo = null;
      return;
    }

    const activeId = active.id as string;
    const activeData = active.data.current;
    const overData = over.data.current;
    const overType = overData.type;

    console.log('🔵 拖曳事件:', {
      activeId,
      activeType: activeData?.type,
      overId: over.id,
      overType,
      overData,
      globalInsertInfo,
    });

    // ✅ 修復：拖回收藏池 = 從行程中移除景點
    if (activeData?.type === 'itinerary-item' && (overType === 'saved-place' || overType === 'left-panel')) {
      const itemId = activeId;
      
      console.log('✅ 拖回收藏池：移除景點', { itemId, overType });
      
      try {
        await removeItemFromDay(itemId);
        globalInsertInfo = null;
      } catch (error) {
        console.error('❌ 移除景點失敗:', error);
        globalInsertInfo = null;
      }
      return;
    }

    // ✅ 檢查是否拖回收藏池（從收藏池拖出的景點不能拖回收藏池）
    if (activeData?.type === 'saved-place' && (overType === 'saved-place' || overType === 'left-panel')) {
      console.log('🔵 拖曳取消：從收藏池拖出的景點不能拖回收藏池');
      globalInsertInfo = null;
      return;
    }

    // ═══════════════════════════════════════════════════════════════
    // 情況 1: 從收藏池拖曳到空的 Day
    // ═══════════════════════════════════════════════════════════════
    if (activeData?.type === 'saved-place' && overType === 'day-droppable') {
      const placeId = activeData.placeId;
      const dayId = overData.dayId;
      
      // ✅ 檢查是否有全局插入資訊（如果有，說明是拖到 Item 之間）
      if (globalInsertInfo && globalInsertInfo.dayId === dayId) {
        console.log('✅ 使用全局插入位置:', globalInsertInfo);
        try {
          await addItemToDay(placeId, dayId, globalInsertInfo.insertIndex);
          globalInsertInfo = null;
        } catch (error) {
          console.error('❌ 插入景點失敗:', error);
          globalInsertInfo = null;
        }
        return;
      }
      
      // 否則是拖到空 Day
      console.log('✅ 加入景點到空 Day:', { placeId, dayId });
      
      try {
        await addItemToDay(placeId, dayId);
        globalInsertInfo = null;
      } catch (error) {
        console.error('❌ 加入景點失敗:', error);
        globalInsertInfo = null;
      }
      return;
    }

    // ═══════════════════════════════════════════════════════════════
    // 情況 2: 從收藏池拖曳到 Item 之間（使用全局插入位置）
    // ═══════════════════════════════════════════════════════════════
    if (activeData?.type === 'saved-place' && overType === 'itinerary-item') {
      const placeId = activeData.placeId;
      
      // ✅ 使用全局插入資訊
      if (globalInsertInfo) {
        console.log('✅ 插入景點到 Item 之間（全局位置）:', globalInsertInfo);
        
        try {
          await addItemToDay(placeId, globalInsertInfo.dayId, globalInsertInfo.insertIndex);
          globalInsertInfo = null;
        } catch (error) {
          console.error('❌ 插入景點失敗:', error);
          globalInsertInfo = null;
        }
        return;
      }
      
      // 備用方案：使用 overData
      const targetDayId = overData.dayId;
      const targetPosition = overData.index;

      console.log('✅ 插入景點到 Item 之間（備用）:', { 
        placeId, 
        dayId: targetDayId, 
        position: targetPosition 
      });
      
      try {
        await addItemToDay(placeId, targetDayId, targetPosition);
        globalInsertInfo = null;
      } catch (error) {
        console.error('❌ 插入景點失敗:', error);
        globalInsertInfo = null;
      }
      return;
    }

    // ═══════════════════════════════════════════════════════════════
    // 情況 3: Item 之間拖曳（使用全局插入位置）
    // ═══════════════════════════════════════════════════════════════
    if (activeData?.type === 'itinerary-item' && overType === 'itinerary-item') {
      const itemId = activeId;
      
      // ✅ 使用全局插入資訊
      if (globalInsertInfo) {
        console.log('✅ 重新排序景點（全局位置）:', globalInsertInfo);
        
        try {
          await reorderItem(itemId, globalInsertInfo.dayId, globalInsertInfo.insertIndex);
          globalInsertInfo = null;
        } catch (error) {
          console.error('❌ 重新排序失敗:', error);
          globalInsertInfo = null;
        }
        return;
      }
      
      // 備用方案
      const targetDayId = overData.dayId;
      const targetPosition = overData.index;

      console.log('✅ 重新排序景點（備用）:', { 
        itemId, 
        targetDayId, 
        targetPosition 
      });
      
      try {
        await reorderItem(itemId, targetDayId, targetPosition);
        globalInsertInfo = null;
      } catch (error) {
        console.error('❌ 重新排序失敗:', error);
        globalInsertInfo = null;
      }
      return;
    }

    // ═══════════════════════════════════════════════════════════════
    // 情況 4: 拖曳 Item 到空的 Day
    // ═══════════════════════════════════════════════════════════════
    if (activeData?.type === 'itinerary-item' && overType === 'day-droppable') {
      const itemId = activeId;
      const targetDayId = overData.dayId;

      // ✅ 檢查是否有全局插入資訊
      if (globalInsertInfo && globalInsertInfo.dayId === targetDayId) {
        console.log('✅ 移動景點（全局位置）:', globalInsertInfo);
        
        try {
          await reorderItem(itemId, targetDayId, globalInsertInfo.insertIndex);
          globalInsertInfo = null;
        } catch (error) {
          console.error('❌ 移動失敗:', error);
          globalInsertInfo = null;
        }
        return;
      }

      console.log('✅ 移動景點到空 Day:', { 
        itemId, 
        targetDayId 
      });
      
      try {
        await reorderItem(itemId, targetDayId, 0);
        globalInsertInfo = null;
      } catch (error) {
        console.error('❌ 移動到空 Day 失敗:', error);
        globalInsertInfo = null;
      }
      return;
    }

    // ✅ 處理 LastPositionDroppable
    if ((activeData?.type === 'saved-place' || activeData?.type === 'itinerary-item') && 
        overType === 'last-position') {
      const targetDayId = overData.dayId;
      const targetPosition = overData.insertIndex;
      
      if (activeData?.type === 'saved-place') {
        const placeId = activeData.placeId;
        console.log('✅ 插入景點到最後位置:', { placeId, targetDayId, targetPosition });
        
        try {
          await addItemToDay(placeId, targetDayId, targetPosition);
          globalInsertInfo = null;
        } catch (error) {
          console.error('❌ 插入到最後位置失敗:', error);
          globalInsertInfo = null;
        }
      } else {
        const itemId = activeId;
        console.log('✅ 移動景點到最後位置:', { itemId, targetDayId, targetPosition });
        
        try {
          await reorderItem(itemId, targetDayId, targetPosition);
          globalInsertInfo = null;
        } catch (error) {
          console.error('❌ 移動到最後位置失敗:', error);
          globalInsertInfo = null;
        }
      }
      return;
    }

    // ═══════════════════════════════════════════════════════════════
    // 其他情況：取消操作
    // ═══════════════════════════════════════════════════════════════
    console.log('🔵 拖曳取消：未處理的拖曳情況', {
      activeType: activeData?.type,
      overType,
    });
    globalInsertInfo = null;
  }

  // 載入中狀態
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
            rel="noopener noreferrer"
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
      {/* ✅ DragMonitor 必須在 DndContext 內部 */}
      <DragMonitor />
      
      <div className="h-screen flex bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <LeftPanel />
        <MiddlePanel />
        <RightPanel />

        <DragOverlay dropAnimation={null}>
          {activeType === 'place' && activeId && (() => {
            const savedPlace = savedPlaces.find(sp => sp.saved_id === activeId);
            if (!savedPlace) return null;

            return (
              <div className="w-64 opacity-90 scale-105 shadow-2xl bg-white rounded-lg p-4 border-2 border-primary-500 animate-pulse-soft">
                <h4 className="font-semibold text-gray-900 mb-1">
                  {savedPlace.place.name}
                </h4>
                <p className="text-xs text-gray-500 line-clamp-1 mb-2">
                  {savedPlace.place.address}
                </p>
                <div className="text-xs text-primary-600 font-medium flex items-center gap-1">
                  <svg className="w-4 h-4 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                  </svg>
                  拖曳中...
                </div>
              </div>
            );
          })()}

          {activeType === 'item' && activeId && (
            <div className="w-64 opacity-90 scale-105 shadow-2xl bg-white rounded-lg p-4 border-2 border-blue-500">
              <div className="text-sm text-blue-600 font-medium flex items-center gap-1">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                移動中...
              </div>
            </div>
          )}
        </DragOverlay>
      </div>
    </DndContext>
  );
}

/**
 * ✅ DragMonitor - 監聽拖曳移動事件，獲取真實滑鼠座標
 * 必須放在 DndContext 內部
 */
function DragMonitor() {
  useDndMonitor({
    onDragMove(event) {
      // 嘗試從 activatorEvent 獲取滑鼠座標
      if (event.activatorEvent && 'clientY' in event.activatorEvent) {
        globalMouseY = event.activatorEvent.clientY as number;
      }
    },
    onDragEnd() {
      globalMouseY = null;
    },
  });

  return null; // 這個組件不渲染任何東西
}