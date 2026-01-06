// src/store/appStore.ts

import { create } from 'zustand';
import type { SavedPlace, Trip, ItineraryDay, ItineraryItem } from '../types/models';
import {
  mockSavedPlaces,
  mockTrip,
  mockItineraryDays,
} from '../utils/mockData';
import { calculateNewSequence } from '../utils/fractionalIndexing';

interface AppState {
  // UI 狀態
  isLeftPanelCollapsed: boolean;
  toggleLeftPanel: () => void;

  // 資料狀態
  savedPlaces: SavedPlace[];
  currentTrip: Trip | null;
  itineraryDays: ItineraryDay[];

  // 行動方法
  loadMockData: () => void;
  updateSavedPlaceStatus: (
    savedId: string,
    isPlaced: boolean,
    itemId?: string
  ) => void;

  // 🆕 拖曳相關方法
  addItemToDay: (
    placeId: string,
    savedId: string,
    dayId: string,
    dropIndex: number
  ) => void;
  reorderItemInDay: (itemId: string, dayId: string, dropIndex: number) => void;
  removeItemFromDay: (itemId: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // 初始 UI 狀態
  isLeftPanelCollapsed: false,
  toggleLeftPanel: () =>
    set(state => ({ isLeftPanelCollapsed: !state.isLeftPanelCollapsed })),

  // 初始資料狀態
  savedPlaces: [],
  currentTrip: null,
  itineraryDays: [],

  // 載入 Mock Data
  loadMockData: () =>
    set({
      savedPlaces: mockSavedPlaces,
      currentTrip: mockTrip,
      itineraryDays: mockItineraryDays,
    }),

  // 更新收藏地點的「已排入」狀態
  updateSavedPlaceStatus: (savedId, isPlaced, itemId) =>
    set(state => ({
      savedPlaces: state.savedPlaces.map(sp =>
        sp.saved_id === savedId
          ? { ...sp, is_placed: isPlaced, current_itinerary_item_id: itemId }
          : sp
      ),
    })),

  // 🆕 從收藏池拖曳地點到行程
  addItemToDay: (placeId, savedId, dayId, dropIndex) =>
    set(state => {
      const day = state.itineraryDays.find(d => d.day_id === dayId);
      if (!day) return state;

      const place = state.savedPlaces.find(sp => sp.saved_id === savedId)?.place;
      if (!place) return state;

      // 計算新 sequence
      const prevSeq = day.items[dropIndex - 1]?.sequence || null;
      const nextSeq = day.items[dropIndex]?.sequence || null;
      const newSequence = calculateNewSequence(prevSeq, nextSeq);

      // 建立新項目
      const newItem: ItineraryItem = {
        item_id: `item_${Date.now()}`,
        day_id: dayId,
        place_id: placeId,
        place,
        sequence: newSequence,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // 更新行程
      const updatedDays = state.itineraryDays.map(d => {
        if (d.day_id === dayId) {
          const newItems = [...d.items];
          newItems.splice(dropIndex, 0, newItem);
          return { ...d, items: newItems };
        }
        return d;
      });

      // 更新收藏池狀態
      get().updateSavedPlaceStatus(savedId, true, newItem.item_id);

      return { itineraryDays: updatedDays };
    }),

  // 🆕 在同一天或跨天重新排序
  reorderItemInDay: (itemId, targetDayId, dropIndex) =>
    set(state => {
      // 找到原始項目
      let sourceItem: ItineraryItem | null = null;
      let sourceDayId: string | null = null;

      for (const day of state.itineraryDays) {
        const item = day.items.find(i => i.item_id === itemId);
        if (item) {
          sourceItem = item;
          sourceDayId = day.day_id;
          break;
        }
      }

      if (!sourceItem || !sourceDayId) return state;

      // 從原位置移除
      const daysAfterRemove = state.itineraryDays.map(d => ({
        ...d,
        items: d.items.filter(i => i.item_id !== itemId),
      }));

      // 找到目標 Day
      const targetDay = daysAfterRemove.find(d => d.day_id === targetDayId);
      if (!targetDay) return state;

      // 計算新 sequence
      const prevSeq = targetDay.items[dropIndex - 1]?.sequence || null;
      const nextSeq = targetDay.items[dropIndex]?.sequence || null;
      const newSequence = calculateNewSequence(prevSeq, nextSeq);

      // 更新項目並插入新位置
      const updatedItem = {
        ...sourceItem,
        day_id: targetDayId,
        sequence: newSequence,
        updated_at: new Date().toISOString(),
      };

      const updatedDays = daysAfterRemove.map(d => {
        if (d.day_id === targetDayId) {
          const newItems = [...d.items];
          newItems.splice(dropIndex, 0, updatedItem);
          return { ...d, items: newItems };
        }
        return d;
      });

      return { itineraryDays: updatedDays };
    }),

  // 🆕 從行程中刪除項目
  removeItemFromDay: itemId =>
    set(state => {
      // 找到該項目關聯的 savedPlace
      let relatedSavedId: string | null = null;
      for (const day of state.itineraryDays) {
        const item = day.items.find(i => i.item_id === itemId);
        if (item) {
          const savedPlace = state.savedPlaces.find(
            sp => sp.place_id === item.place_id && sp.current_itinerary_item_id === itemId
          );
          if (savedPlace) {
            relatedSavedId = savedPlace.saved_id;
          }
          break;
        }
      }

      // 從行程中移除
      const updatedDays = state.itineraryDays.map(d => ({
        ...d,
        items: d.items.filter(i => i.item_id !== itemId),
      }));

      // 更新收藏池狀態（恢復可拖曳）
      if (relatedSavedId) {
        get().updateSavedPlaceStatus(relatedSavedId, false, undefined);
      }

      return { itineraryDays: updatedDays };
    }),
}));