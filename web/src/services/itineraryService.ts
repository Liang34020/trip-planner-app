// web/src/services/itineraryService.ts
import apiClient from './api';
import type { ItineraryDay, ItineraryItem } from '../types/models';

export interface AddItemRequest {
  day_id: string;
  place_id: string;
  position?: number;  // 插入位置（0-based），undefined 表示最後
  scheduled_time?: string;  // "HH:MM:SS" 格式
  duration_minutes?: number;
  notes?: string;
}

export interface ReorderItemRequest {
  target_day_id: string;
  target_position: number;  // ✅ 修正：後端使用 target_position
  client_timestamp?: number;
}

export interface UpdateItemRequest {
  scheduled_time?: string;
  duration_minutes?: number;
  notes?: string;
  transport_to_next?: string;
}

export interface UpdateDayRequest {
  notes?: string;
  default_transport?: string;
}

export const itineraryService = {
  // ==================== Day 管理 ====================
  
  /**
   * 新增 Day
   */
  async createDay(tripId: string): Promise<ItineraryDay> {
    const { data } = await apiClient.post(`/trips/${tripId}/days`);
    return data;
  },

  /**
   * 刪除 Day
   */
  async deleteDay(dayId: string): Promise<void> {
    await apiClient.delete(`/days/${dayId}`);
  },

  /**
   * 更新 Day（備註、預設交通方式）
   */
  async updateDay(dayId: string, dayData: UpdateDayRequest): Promise<ItineraryDay> {
    const { data } = await apiClient.patch(`/days/${dayId}`, dayData);
    return data;
  },

  // ==================== Item 管理 ====================

  /**
   * 從收藏池加入景點到 Day
   */
  async addItem(itemData: AddItemRequest): Promise<ItineraryItem> {
    const { data } = await apiClient.post('/items/', itemData);
    return data;
  },

  /**
   * 拖曳重新排序景點（核心功能）
   */
  async reorderItem(itemId: string, reorderData: ReorderItemRequest): Promise<ItineraryItem> {
    const { data } = await apiClient.patch(`/items/${itemId}/reorder`, reorderData);
    return data;
  },

  /**
   * 更新景點資訊
   */
  async updateItem(itemId: string, itemData: UpdateItemRequest): Promise<ItineraryItem> {
    const { data } = await apiClient.patch(`/items/${itemId}`, itemData);
    return data;
  },

  /**
   * 刪除景點（回到收藏池）
   */
  async deleteItem(itemId: string): Promise<void> {
    await apiClient.delete(`/items/${itemId}`);
  },
};