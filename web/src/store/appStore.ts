import { create } from 'zustand';
import type {
  Trip,
  SavedPlace,
  ItineraryDay,
  ItineraryItem,
} from '../types/models';
import { tripService } from '../services/tripService';
import { itineraryService } from '../services/itineraryService';
import { savedPlaceService } from '../services/savedPlaceService';
import toast from 'react-hot-toast';
import { setDroppedItemId, setPendingFlip } from '../utils/animationState';

interface AppState {
  // 當前選中的行程
  currentTrip: Trip | null;
  currentTripDetail: any | null; // 包含 days 的完整行程資料

  // 收藏池
  savedPlaces: SavedPlace[];

  // UI 狀態
  isLeftPanelCollapsed: boolean;
  isLoading: boolean;

  // 計算屬性（從 currentTripDetail 取得）
  itineraryDays: ItineraryDay[];

  // UI Actions
  toggleLeftPanel: () => void;

  // Data Actions
  loadTrip: (tripId: string) => Promise<void>;
  loadSavedPlaces: () => Promise<void>;

  // Day 操作
  addDay: () => Promise<void>;
  deleteDay: (dayId: string) => Promise<void>;
  updateDayNotes: (dayId: string, notes: string) => Promise<void>;
  updateDayDefaultTransport: (
    dayId: string,
    transport: string
  ) => Promise<void>;
  removeDay: (dayId: string) => Promise<void>;
  clearDay: (dayId: string) => Promise<void>;

  // Item 操作
  addItemToDay: (
    placeId: string,
    dayId: string,
    position?: number
  ) => Promise<void>;
  reorderItem: (
    itemId: string,
    targetDayId: string,
    targetPosition: number
  ) => Promise<void>;
  reorderDay: (dayId: string, targetPosition: number) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
  updateItem: (itemId: string, updates: any) => Promise<void>;
  updateItineraryItem: (itemId: string, updates: any) => Promise<void>;
  removeItemFromDay: (itemId: string) => Promise<void>;
  copyItemToDay: (itemId: string, targetDayId: string) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentTrip: null,
  currentTripDetail: null,
  savedPlaces: [],
  isLeftPanelCollapsed: false,
  isLoading: false,

  itineraryDays: [],

  // UI Actions
  toggleLeftPanel: () => {
    set(state => ({ isLeftPanelCollapsed: !state.isLeftPanelCollapsed }));
  },

  // 載入行程詳情
  loadTrip: async (tripId: string) => {
    set({ isLoading: true });
    try {
      const tripDetail = await tripService.getTripDetail(tripId);

      set({
        currentTrip: tripDetail,
        currentTripDetail: tripDetail,
        itineraryDays: tripDetail.days || [],
        isLoading: false,
      });
    } catch (error) {
      console.error('載入行程失敗:', error);
      toast.error('載入行程失敗');
      set({ isLoading: false });
    }
  },

  // 載入收藏池
  loadSavedPlaces: async () => {
    try {
      const places = await savedPlaceService.getSavedPlaces();
      set({ savedPlaces: places });
    } catch (error) {
      console.error('載入收藏池失敗:', error);
      toast.error('載入收藏池失敗');
    }
  },

  // 新增 Day
  addDay: async () => {
    const { currentTrip, loadTrip } = get();
    if (!currentTrip) return;

    try {
      await itineraryService.createDay(currentTrip.trip_id);
      toast.success('新增 Day 成功');
      await loadTrip(currentTrip.trip_id);
    } catch (error) {
      console.error('新增 Day 失敗:', error);
      toast.error('新增 Day 失敗');
    }
  },

  // ✅ 刪除 Day（修復：加入 loadSavedPlaces）
  deleteDay: async (dayId: string) => {
    const { currentTrip, loadTrip, loadSavedPlaces } = get();
    if (!currentTrip) return;

    try {
      await itineraryService.deleteDay(dayId);
      toast.success('刪除 Day 成功');
      // ✅ 同時重新載入行程和收藏池
      await Promise.all([loadTrip(currentTrip.trip_id), loadSavedPlaces()]);
    } catch (error) {
      console.error('刪除 Day 失敗:', error);
      toast.error('刪除 Day 失敗');
    }
  },

  // 更新 Day 備註
  updateDayNotes: async (dayId: string, notes: string) => {
    const { currentTrip, loadTrip } = get();
    if (!currentTrip) return;

    try {
      await itineraryService.updateDay(dayId, { notes });
      await loadTrip(currentTrip.trip_id);
    } catch (error) {
      console.error('更新備註失敗:', error);
      toast.error('更新備註失敗');
    }
  },

  // 更新 Day 預設交通方式
  updateDayDefaultTransport: async (dayId: string, transport: string) => {
    const { currentTrip, loadTrip } = get();
    if (!currentTrip) return;

    try {
      await itineraryService.updateDay(dayId, { default_transport: transport });
      await loadTrip(currentTrip.trip_id);
    } catch (error) {
      console.error('更新交通方式失敗:', error);
      toast.error('更新交通方式失敗');
    }
  },

  // removeDay 別名（與 deleteDay 相同）
  removeDay: async (dayId: string) => {
    await get().deleteDay(dayId);
  },

  // 清空 Day（移除所有景點）
  clearDay: async (dayId: string) => {
    const { currentTrip, loadTrip, loadSavedPlaces } = get();
    if (!currentTrip) return;

    try {
      // 獲取該 Day 的所有 Items
      const day = get().currentTripDetail?.days.find(
        (d: ItineraryDay) => d.day_id === dayId
      );
      if (!day || !day.items) return;

      // 刪除所有 Items
      await Promise.all(
        day.items.map((item: ItineraryItem) =>
          itineraryService.deleteItem(item.item_id)
        )
      );

      toast.success('清空 Day 成功');
      await Promise.all([loadTrip(currentTrip.trip_id), loadSavedPlaces()]);
    } catch (error) {
      console.error('清空 Day 失敗:', error);
      toast.error('清空 Day 失敗');
    }
  },

  // 加入景點到 Day
  addItemToDay: async (placeId: string, dayId: string, position?: number) => {
    const { currentTrip, loadTrip, loadSavedPlaces } = get();
    if (!currentTrip) return;

    try {
      // ✅ API 呼叫前先設 pendingFlip，讓 loadTrip render 後執行 FLIP
      setPendingFlip(true);

      const newItem = await itineraryService.addItem({
        day_id: dayId,
        place_id: placeId,
        position,
      });

      toast.success('加入景點成功');
      await Promise.all([loadTrip(currentTrip.trip_id), loadSavedPlaces()]);

      // ✅ loadTrip 完成後設 droppedItemId，新景點已 mount，淡入才能觸發
      if (newItem?.item_id) {
        setDroppedItemId(newItem.item_id);
      }
    } catch (error: any) {
      setPendingFlip(false); // 失敗時清除
      console.error('加入景點失敗:', error);
      toast.error(error.response?.data?.detail || '加入景點失敗');
    }
  },

  // 拖曳重新排序
  reorderItem: async (
    itemId: string,
    targetDayId: string,
    targetPosition: number
  ) => {
    const { currentTrip, loadTrip, currentTripDetail } = get();
    if (!currentTrip || !currentTripDetail) return;

    // ✅ 樂觀更新：先在本地計算新的 days 順序，立刻更新 UI
    const prevDays = currentTripDetail.days as ItineraryDay[];

    // 找到被移動的 item 和它原本所在的 day
    let movingItem: ItineraryItem | null = null;
    let sourceDayId: string | null = null;
    for (const day of prevDays) {
      const found = day.items.find((i: ItineraryItem) => i.item_id === itemId);
      if (found) { movingItem = found; sourceDayId = day.day_id; break; }
    }
    if (!movingItem || !sourceDayId) return;

    // 建立樂觀更新後的 days
    const optimisticDays = prevDays.map((day: ItineraryDay) => {
      // 從原本的 day 移除
      if (day.day_id === sourceDayId) {
        return { ...day, items: day.items.filter((i: ItineraryItem) => i.item_id !== itemId) };
      }
      return day;
    }).map((day: ItineraryDay) => {
      // 插入到目標 day 的指定位置
      if (day.day_id === targetDayId) {
        const newItems = [...day.items];
        // 如果是同一天，items 已經移除過了
        const insertPos = Math.min(targetPosition, newItems.length);
        newItems.splice(insertPos, 0, { ...movingItem!, day_id: targetDayId });
        return { ...day, items: newItems };
      }
      return day;
    });

    // 立刻更新 UI（FLIP 動畫會在這次 render 後觸發）
    console.log('🔵 樂觀更新順序:', optimisticDays.map((d: ItineraryDay) =>
      d.items.map((i: ItineraryItem) => i.place?.name || i.item_id.slice(0, 6)).join(' → ')
    ).join(' | '));

    set({
      itineraryDays: optimisticDays,
      currentTripDetail: { ...currentTripDetail, days: optimisticDays },
    });

    try {
      await itineraryService.reorderItem(itemId, {
        target_day_id: targetDayId,
        target_position: targetPosition,
        client_timestamp: Date.now(),
      });
      await loadTrip(currentTrip.trip_id);
      console.log('🟢 loadTrip 後順序:', get().itineraryDays.map((d: ItineraryDay) =>
        d.items.map((i: ItineraryItem) => i.place?.name || i.item_id.slice(0, 6)).join(' → ')
      ).join(' | '));
    } catch (error) {
      console.error('重新排序失敗:', error);
      toast.error('重新排序失敗');
      // 失敗時 rollback
      await loadTrip(currentTrip.trip_id);
    }
  },

  // 拖曳重新排序 Day（整天移動）
  reorderDay: async (dayId: string, targetPosition: number) => {
    const { currentTrip, loadTrip } = get();
    if (!currentTrip) return;

    // 樂觀更新：先在本地重排 days，避免等待 API 期間 UI 凍結
    const currentDays = get().itineraryDays;
    const movingDay = currentDays.find(d => d.day_id === dayId);
    if (!movingDay) return;

    const reordered = currentDays.filter(d => d.day_id !== dayId);
    reordered.splice(targetPosition, 0, movingDay);
    // 更新 day_number（1-based）
    const optimisticDays = reordered.map((d, i) => ({ ...d, day_number: i + 1 }));
    set({ itineraryDays: optimisticDays });

    try {
      await itineraryService.reorderDay(dayId, targetPosition);
      // API 成功後用真實資料同步
      await loadTrip(currentTrip.trip_id);
    } catch (error) {
      console.error('Day 重新排序失敗:', error);
      toast.error('Day 重新排序失敗');
      // 回滾：重新載入真實資料
      await loadTrip(currentTrip.trip_id);
    }
  },

  // 刪除景點
  deleteItem: async (itemId: string) => {
    const { currentTrip, loadTrip, loadSavedPlaces } = get();
    if (!currentTrip) return;

    try {
      await itineraryService.deleteItem(itemId);
      toast.success('刪除景點成功');
      await Promise.all([loadTrip(currentTrip.trip_id), loadSavedPlaces()]);
    } catch (error) {
      console.error('刪除景點失敗:', error);
      toast.error('刪除景點失敗');
    }
  },

  // 更新景點資訊
  updateItem: async (itemId: string, updates: any) => {
    const { currentTrip, loadTrip } = get();
    if (!currentTrip) return;

    try {
      await itineraryService.updateItem(itemId, updates);
      toast.success('更新景點成功');
      await loadTrip(currentTrip.trip_id);
    } catch (error) {
      console.error('更新景點失敗:', error);
      toast.error('更新景點失敗');
    }
  },

  // updateItineraryItem 別名（與 updateItem 相同）
  updateItineraryItem: async (itemId: string, updates: any) => {
    await get().updateItem(itemId, updates);
  },

  // removeItemFromDay 別名（與 deleteItem 相同）
  removeItemFromDay: async (itemId: string) => {
    await get().deleteItem(itemId);
  },

  // 複製景點到其他 Day
  copyItemToDay: async (itemId: string, targetDayId: string) => {
    const { currentTrip, loadTrip } = get();
    if (!currentTrip) return;

    try {
      // 找到原始 Item
      let sourceItem: ItineraryItem | null = null;
      for (const day of get().currentTripDetail?.days || []) {
        const item = day.items?.find(
          (i: ItineraryItem) => i.item_id === itemId
        );
        if (item) {
          sourceItem = item;
          break;
        }
      }

      if (!sourceItem) {
        toast.error('找不到要複製的景點');
        return;
      }

      // 加入新的 Item
      await itineraryService.addItem({
        day_id: targetDayId,
        place_id: sourceItem.place_id,
        scheduled_time: sourceItem.scheduled_time || undefined,
        duration_minutes: sourceItem.duration_minutes || undefined,
        notes: sourceItem.notes || undefined,
      });

      toast.success('複製景點成功');
      await loadTrip(currentTrip.trip_id);
    } catch (error) {
      console.error('複製景點失敗:', error);
      toast.error('複製景點失敗');
    }
  },
}));