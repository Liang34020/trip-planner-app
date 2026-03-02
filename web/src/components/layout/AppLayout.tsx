import { useState, useEffect, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDndMonitor,
} from '@dnd-kit/core';
import type {
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { setDroppedItemId, setFadingOutItemId, snapshotAllDays } from '../../utils/animationState';
import { LeftPanel } from './LeftPanel';
import { MiddlePanel, setGlobalMouseX } from './MiddlePanel';
import { RightPanel } from './RightPanel';
import { useAppStore } from '../../store/appStore';
import type { ItineraryItem } from '../../types/models';

// ─────────────────────────────────────────────
// Module-level 全局變數（非 React state，讀寫不觸發 re-render）
// ─────────────────────────────────────────────

/** MiddlePanel DayColumn 計算出的插入位置，handleDragEnd 時讀取 */
let globalInsertInfo: {
  dayId: string;
  insertIndex: number;
} | null = null;

/** Day 拖曳時計算出的橫向插入位置（在第幾個 Day 之前插入） */
let globalDayInsertIndex: number | null = null;

/** 即時滑鼠 Y 座標，供 MiddlePanel RAF loop 讀取 */
let globalMouseY: number | null = null;

/** 即時滑鼠 X 座標，供 MiddlePanel RAF loop 判斷左右邊界 */
let globalMouseX: number | null = null;

// 導出供 MiddlePanel 使用
export function setGlobalInsertInfo(info: { dayId: string; insertIndex: number } | null) {
  globalInsertInfo = info;
}

export function getGlobalMouseY(): number | null {
  return globalMouseY;
}

export function setGlobalDayInsertIndex(index: number | null) {
  globalDayInsertIndex = index;
}

export function getGlobalDayInsertIndex(): number | null {
  return globalDayInsertIndex;
}

// ─────────────────────────────────────────────
// AppLayout
// ─────────────────────────────────────────────

export default function AppLayout() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'place' | 'item' | 'day' | null>(null);
  const [activeItem, setActiveItem] = useState<ItineraryItem | null>(null);

  const {
    loadTrip,
    loadSavedPlaces,
    currentTripDetail,
    itineraryDays,
    reorderItem,
    reorderDay,
    addItemToDay,
    savedPlaces,
    removeItemFromDay,
  } = useAppStore();

  // 初始資料載入
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

  // ✅ 修復問題 4：只設 distance，移除 delay
  // distance 和 delay 是 OR 關係，同時設定會讓 delay 幾乎失效。
  // 純 distance 模式：移動超過 8px 才觸發，保護 Edit/Copy/Delete 按鈕不被誤觸。
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // ─────────────────────────────────────────────
  // Drag handlers
  // ─────────────────────────────────────────────

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    setActiveId(active.id as string);

    const activeData = active.data.current;
    if (activeData?.type === 'saved-place') {
      setActiveType('place');
    } else if (activeData?.type === 'itinerary-item') {
      setActiveType('item');
      setActiveItem(activeData.item as ItineraryItem);
    } else if (activeData?.type === 'day') {
      setActiveType('day');
    }

    console.log('🟢 拖曳開始:', { activeId: active.id, activeType: activeData?.type });
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    // 先讀取 globalInsertInfo（在重置前），確保不受 DragMonitor.onDragEnd 清除影響
    const insertInfo = globalInsertInfo;

    // 重置 UI 狀態
    setActiveId(null);
    setActiveType(null);
    setActiveItem(null);
    globalInsertInfo = null;

    if (!over || !over.data.current) {
      console.log('🔵 拖曳取消：無效目標');
      return;
    }

    const activeItemId = active.id as string;
    const activeData = active.data.current;
    const overData = over.data.current;
    const overType = overData.type as string;

    console.log('🔵 拖曳事件:', {
      activeId: activeItemId,
      activeType: activeData?.type,
      overId: over.id,
      overType,
      insertInfo,
    });

    // ─────────────────────────────────────────────
    // 拖回收藏池：從行程移除景點
    // ─────────────────────────────────────────────
    if (
      activeData?.type === 'itinerary-item' &&
      (overType === 'saved-place' || overType === 'left-panel')
    ) {
      console.log('✅ 拖回收藏池：移除景點', { itemId: activeItemId });
      snapshotAllDays(activeItemId);
      setFadingOutItemId(activeItemId);
      await new Promise(resolve => setTimeout(resolve, 250)); // 等淡出動畫
      try {
        await removeItemFromDay(activeItemId);
      } catch (error) {
        console.error('❌ 移除景點失敗:', error);
      }
      return;
    }

    // 收藏池景點拖回收藏池：無意義，取消
    if (
      activeData?.type === 'saved-place' &&
      (overType === 'saved-place' || overType === 'left-panel')
    ) {
      console.log('🔵 取消：收藏池景點拖回收藏池');
      return;
    }

    // ─────────────────────────────────────────────
    // ✅ 修復問題 2：合併情況 1 + 情況 2
    // saved-place 拖到 Day（不論 overType 是 day-droppable 還是 itinerary-item）
    // 統一優先使用 globalInsertInfo，沒有才回退到末尾
    // ─────────────────────────────────────────────
    if (activeData?.type === 'saved-place') {
      const placeId = activeData.placeId;

      // 從 overData 或 insertInfo 取得目標 dayId
      const targetDayId: string | undefined =
        insertInfo?.dayId ??
        overData.dayId;

      if (!targetDayId) {
        console.log('🔵 取消：無法確定目標 Day');
        return;
      }

      if (insertInfo && insertInfo.dayId === targetDayId) {
        // 有精確插入位置 → 插入到指定位置
        console.log('✅ 新增景點（指定位置）:', { placeId, ...insertInfo });
        try {
          await addItemToDay(placeId, insertInfo.dayId, insertInfo.insertIndex);
        } catch (error) {
          console.error('❌ 插入景點失敗:', error);
        }
      } else {
        // 無插入位置（拖到空 Day）→ 加到末尾
        console.log('✅ 新增景點到空 Day:', { placeId, targetDayId });
        try {
          await addItemToDay(placeId, targetDayId);
        } catch (error) {
          console.error('❌ 加入景點失敗:', error);
        }
      }
      return;
    }

    // ─────────────────────────────────────────────
    // itinerary-item 重排或跨天移動
    // 同樣合併 overType 為 itinerary-item 和 day-droppable 的情況
    // ─────────────────────────────────────────────
    if (activeData?.type === 'itinerary-item') {
      const itemId = activeItemId;

      const targetDayId: string | undefined =
        insertInfo?.dayId ??
        overData.dayId;

      if (!targetDayId) {
        console.log('🔵 取消：無法確定目標 Day');
        return;
      }

      // ✅ 原地放開判斷：同一天且插入位置等於目前位置，直接取消
      if (insertInfo) {
        const targetDay = itineraryDays.find(d => d.day_id === insertInfo.dayId);
        const currentIndex = targetDay?.items.findIndex(
          (i: ItineraryItem) => i.item_id === itemId
        ) ?? -1;
        const isSamePosition =
          currentIndex !== -1 &&
          (insertInfo.insertIndex === currentIndex ||
            insertInfo.insertIndex === currentIndex + 1);
        if (isSamePosition) {
          console.log('🔵 原地放開：位置未變，取消');
          return;
        }
      }

      if (insertInfo && insertInfo.dayId === targetDayId) {
        console.log('✅ 移動/重排景點（指定位置）:', { itemId, ...insertInfo });
        snapshotAllDays(itemId);
        setDroppedItemId(itemId);
        try {
          await reorderItem(itemId, insertInfo.dayId, insertInfo.insertIndex);
        } catch (error) {
          console.error('❌ 重排景點失敗:', error);
        }
      } else {
        console.log('✅ 移動景點到空 Day:', { itemId, targetDayId });
        snapshotAllDays(itemId);
        setDroppedItemId(itemId);
        try {
          await reorderItem(itemId, targetDayId, 0);
        } catch (error) {
          console.error('❌ 移動到空 Day 失敗:', error);
        }
      }
      return;
    }

    // ─────────────────────────────────────────────
    // Day 整天拖曳排序
    // ─────────────────────────────────────────────
    if (activeData?.type === 'day') {
      const dayInsertIndex = globalDayInsertIndex;
      globalDayInsertIndex = null;

      if (dayInsertIndex === null) {
        console.log('🔵 Day 拖曳取消：無插入位置');
        return;
      }

      // ✅ 原地判斷：找被拖 Day 目前的位置，插入前後都算原地
      const currentDayIndex = itineraryDays.findIndex(d => d.day_id === activeItemId);
      if (
        currentDayIndex !== -1 &&
        (dayInsertIndex === currentDayIndex || dayInsertIndex === currentDayIndex + 1)
      ) {
        console.log('🔵 Day 原地放開：位置未變，取消');
        return;
      }

      console.log('✅ Day 重新排序:', { dayId: activeItemId, targetPosition: dayInsertIndex });
      try {
        await reorderDay(activeItemId, dayInsertIndex);
      } catch (error) {
        console.error('❌ Day 重新排序失敗:', error);
      }
      return;
    }

    // 未處理的情況
    console.log('🔵 拖曳取消：未處理的情況', {
      activeType: activeData?.type,
      overType,
    });
  }

  // ─────────────────────────────────────────────
  // 載入中畫面
  // ─────────────────────────────────────────────
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

  // ─────────────────────────────────────────────
  // 主畫面
  // ─────────────────────────────────────────────
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* ✅ DragMonitor 必須在 DndContext 內部才能呼叫 useDndMonitor */}
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

          {activeType === 'item' && activeItem && (
            <div className="w-64 opacity-90 scale-105 shadow-2xl bg-white rounded-lg p-4 border-2 border-blue-500">
              <h4 className="font-semibold text-gray-900 mb-1 text-sm">
                {activeItem.place.name}
              </h4>
              {activeItem.place.address && (
                <p className="text-xs text-gray-500 line-clamp-1 mb-2">
                  {activeItem.place.address}
                </p>
              )}
              <div className="text-xs text-blue-600 font-medium flex items-center gap-1">
                <svg className="w-4 h-4 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4" />
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

// ─────────────────────────────────────────────
// ✅ DragMonitor：在 DndContext 內部追蹤滑鼠座標
// 必須是獨立組件，才能在 DndContext 內呼叫 useDndMonitor
//
// ⚠️ 為什麼不用 delta 計算座標：
//   delta.y = 相對於拖曳「起點」的位移，不含容器滾動偏移。
//   當使用者拖曳同時滾動卡片時，同樣的 delta 對應的視覺位置會偏移。
//
// ✅ 解法：直接監聽 pointermove 取得真實 clientX/clientY，
//   clientX/Y 永遠是相對於視窗的即時座標，不受滾動影響。
// ─────────────────────────────────────────────
function DragMonitor() {
  const isDraggingRef = useRef(false);

  useDndMonitor({
    onDragStart() {
      isDraggingRef.current = true;
    },
    onDragEnd() {
      isDraggingRef.current = false;
      globalMouseY = null;
      globalMouseX = null;
      setGlobalMouseX(null);
      console.log('🔴 DragMonitor: 拖曳結束');
    },
  });

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      // clientX/Y 直接就是視窗座標，不受任何滾動影響
      globalMouseY = e.clientY;
      globalMouseX = e.clientX;
      setGlobalMouseX(globalMouseX);
    };

    // capture:true 確保在任何子元素攔截前都能收到事件
    window.addEventListener('pointermove', handlePointerMove, { capture: true });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove, { capture: true });
    };
  }, []);

  return null;
}