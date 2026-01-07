// src/store/appStore.ts

import { create } from 'zustand';
import type { SavedPlace, Trip, ItineraryDay, ItineraryItem } from '../types/models';
import {
  mockSavedPlaces,
  mockTrip,
  mockItineraryDays,
} from '../utils/mockData';
import { calculateNewSequence } from '../utils/fractionalIndexing';
import { showToast } from '../utils/toast';

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
  updateItineraryItem: (itemId: string, updates: Partial<ItineraryItem>) => void;

  // 🆕 Day 管理方法
  addNewDay: () => void;
  removeDay: (dayId: string) => void;
  updateDayNotes: (dayId: string, notes: string) => void;

  // 🆕 進階操作
  copyItemToDay: (itemId: string, targetDayId: string) => void;
  clearDay: (dayId: string) => void;
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
      try {
        const day = state.itineraryDays.find(d => d.day_id === dayId);
        if (!day) {
          showToast.error('找不到目標天數');
          return state;
        }

        const place = state.savedPlaces.find(sp => sp.saved_id === savedId)?.place;
        if (!place) {
          showToast.error('找不到地點資料');
          return state;
        }

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

        showToast.success(`已加入「${place.name}」到行程`);

        return { itineraryDays: updatedDays };
      } catch (error) {
        console.error('addItemToDay error:', error);
        showToast.error('加入景點失敗，請重試');
        return state;
      }
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
      try {
        // 找到該項目關聯的 savedPlace
        let relatedSavedId: string | null = null;
        let itemName = '';
        
        for (const day of state.itineraryDays) {
          const item = day.items.find(i => i.item_id === itemId);
          if (item) {
            itemName = item.place.name;
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

        showToast.success(`已移除「${itemName}」`);

        return { itineraryDays: updatedDays };
      } catch (error) {
        console.error('removeItemFromDay error:', error);
        showToast.error('移除景點失敗，請重試');
        return state;
      }
    }),

  // 🆕 更新行程項目資訊
  updateItineraryItem: (itemId, updates) =>
    set(state => {
      const updatedDays = state.itineraryDays.map(day => ({
        ...day,
        items: day.items.map(item =>
          item.item_id === itemId
            ? { ...item, ...updates, updated_at: new Date().toISOString() }
            : item
        ),
      }));

      return { itineraryDays: updatedDays };
    }),

  // 🆕 新增一天行程
  addNewDay: () =>
    set(state => {
      try {
        if (!state.currentTrip) {
          showToast.error('沒有選擇行程');
          return state;
        }

        const newDayNumber = state.itineraryDays.length + 1;
        
        // 計算新的日期（如果有 start_date）
        let newDate: string | undefined;
        if (state.currentTrip.start_date) {
          const startDate = new Date(state.currentTrip.start_date);
          startDate.setDate(startDate.getDate() + newDayNumber - 1);
          newDate = startDate.toISOString().split('T')[0];
        }

        const newDay: ItineraryDay = {
          day_id: `day_${Date.now()}`,
          trip_id: state.currentTrip.trip_id,
          day_number: newDayNumber,
          date: newDate,
          items: [],
        };

        showToast.success(`已新增 Day ${newDayNumber}`);

        return { itineraryDays: [...state.itineraryDays, newDay] };
      } catch (error) {
        console.error('addNewDay error:', error);
        showToast.error('新增失敗，請重試');
        return state;
      }
    }),

  // 🆕 刪除一天行程
  removeDay: dayId =>
    set(state => {
      // 找到要刪除的 Day 中的所有項目
      const dayToRemove = state.itineraryDays.find(d => d.day_id === dayId);
      if (!dayToRemove) return state;

      // 將該天的所有項目從收藏池中恢復可拖曳狀態
      dayToRemove.items.forEach(item => {
        const savedPlace = state.savedPlaces.find(
          sp => sp.place_id === item.place_id && sp.current_itinerary_item_id === item.item_id
        );
        if (savedPlace) {
          get().updateSavedPlaceStatus(savedPlace.saved_id, false, undefined);
        }
      });

      // 移除該天並重新編號 + 重新計算日期
      const updatedDays = state.itineraryDays
        .filter(d => d.day_id !== dayId)
        .map((day, index) => {
          const newDayNumber = index + 1;
          
          // 🆕 重新計算日期（基於 trip 的 start_date）
          let newDate: string | undefined;
          if (state.currentTrip?.start_date) {
            const startDate = new Date(state.currentTrip.start_date);
            startDate.setDate(startDate.getDate() + index);
            newDate = startDate.toISOString().split('T')[0];
          }

          return {
            ...day,
            day_number: newDayNumber,
            date: newDate,
          };
        });

      return { itineraryDays: updatedDays };
    }),

  // 🆕 更新當日備註
  updateDayNotes: (dayId, notes) =>
    set(state => {
      const updatedDays = state.itineraryDays.map(day =>
        day.day_id === dayId ? { ...day, notes } : day
      );

      return { itineraryDays: updatedDays };
    }),

  // 🆕 複製景點到其他 Day
  copyItemToDay: (itemId, targetDayId) =>
    set(state => {
      try {
        // 找到原始項目
        let sourceItem: ItineraryItem | null = null;
        for (const day of state.itineraryDays) {
          const item = day.items.find(i => i.item_id === itemId);
          if (item) {
            sourceItem = item;
            break;
          }
        }

        if (!sourceItem) {
          showToast.error('找不到原始景點');
          return state;
        }

        // 找到目標 Day
        const targetDay = state.itineraryDays.find(d => d.day_id === targetDayId);
        if (!targetDay) {
          showToast.error('找不到目標天數');
          return state;
        }

        // 計算新 sequence（放到最後）
        const prevSeq = targetDay.items[targetDay.items.length - 1]?.sequence || null;
        const newSequence = calculateNewSequence(prevSeq, null);

        // 建立新項目（複製）
        const newItem: ItineraryItem = {
          ...sourceItem,
          item_id: `item_${Date.now()}`,
          day_id: targetDayId,
          sequence: newSequence,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // 更新行程
        const updatedDays = state.itineraryDays.map(d => {
          if (d.day_id === targetDayId) {
            return { ...d, items: [...d.items, newItem] };
          }
          return d;
        });

        showToast.success(`已複製「${sourceItem.place.name}」到 Day ${targetDay.day_number}`);

        return { itineraryDays: updatedDays };
      } catch (error) {
        console.error('copyItemToDay error:', error);
        showToast.error('複製失敗，請重試');
        return state;
      }
    }),

  // 🆕 清空某一天的所有景點
  clearDay: dayId =>
    set(state => {
      try {
        // 找到該 Day
        const dayToClear = state.itineraryDays.find(d => d.day_id === dayId);
        if (!dayToClear) {
          showToast.error('找不到目標天數');
          return state;
        }

        if (dayToClear.items.length === 0) {
          showToast.info('此天沒有景點');
          return state;
        }

        // 將所有項目從收藏池中恢復可拖曳狀態
        dayToClear.items.forEach(item => {
          const savedPlace = state.savedPlaces.find(
            sp => sp.place_id === item.place_id && sp.current_itinerary_item_id === item.item_id
          );
          if (savedPlace) {
            get().updateSavedPlaceStatus(savedPlace.saved_id, false, undefined);
          }
        });

        // 清空該天的項目
        const updatedDays = state.itineraryDays.map(d =>
          d.day_id === dayId ? { ...d, items: [] } : d
        );

        showToast.success(`已清空 Day ${dayToClear.day_number}`);

        return { itineraryDays: updatedDays };
      } catch (error) {
        console.error('clearDay error:', error);
        showToast.error('清空失敗，請重試');
        return state;
      }
    }),
}));