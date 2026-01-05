// src/store/appStore.ts

import { create } from 'zustand';
import type { SavedPlace, Trip, ItineraryDay } from '../types/models';
import {
  mockSavedPlaces,
  mockTrip,
  mockItineraryDays,
} from '../utils/mockData';

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
}

export const useAppStore = create<AppState>(set => ({
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
}));
