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
import type { DragEndEvent, DragOverEvent } from '@dnd-kit/core';
import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { LeftPanel } from './LeftPanel';
import { MiddlePanel } from './MiddlePanel';
import { RightPanel } from './RightPanel';

export function AppLayout() {
  const {
    isLeftPanelCollapsed,
    toggleLeftPanel,
    addItemToDay,
    reorderItemInDay,
  } = useAppStore();

  const [activeId, setActiveId] = useState<string | null>(null);

  // 🆕 配置拖曳感應器（8px 防止誤觸）
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  /**
   * 🆕 拖曳懸停處理（視覺回饋）
   */
  function handleDragOver(_event: DragOverEvent) {
    // 目前只用於觸發 isOver 狀態，不需要額外邏輯
    // isOver 狀態由 useDroppable 和 useSortable 自動管理
  }

  /**
   * 🆕 拖曳結束處理
   */
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    setActiveId(null);

    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

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
      // Case 1B: 拖曳到現有 item 上方 🆕
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
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={event => setActiveId(event.active.id as string)}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-screen overflow-hidden bg-gray-50 relative">
        {/* 收藏池（左欄）*/}
        <div
          className={`transition-all duration-300 ease-in-out ${
            isLeftPanelCollapsed ? 'w-0' : 'w-80'
          }`}
        >
          <LeftPanel />
        </div>

        {/* 折疊按鈕 - 固定在分界線上 */}
        <button
          onClick={toggleLeftPanel}
          className={`absolute top-1/2 -translate-y-1/2 z-50 p-2 bg-white rounded-full shadow-lg hover:bg-gray-50 transition-all duration-300 border border-gray-300 hover:border-primary-500 ${
            isLeftPanelCollapsed ? 'left-4' : 'left-[304px]'
          }`}
          title={isLeftPanelCollapsed ? '展開收藏池' : '收起收藏池'}
        >
          {isLeftPanelCollapsed ? (
            <ChevronRight className="w-5 h-5 text-gray-700" />
          ) : (
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          )}
        </button>

        {/* 行程編輯器（中欄）*/}
        <MiddlePanel />

        {/* 地圖（右欄，桌面版顯示）*/}
        <RightPanel />
      </div>

      {/* 🆕 拖曳預覽 */}
      <DragOverlay>
        {activeId ? (
          <div className="card opacity-80 shadow-2xl">正在拖曳...</div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}