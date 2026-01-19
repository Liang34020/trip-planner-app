// web/src/services/tripService.ts
import apiClient from './api';
import type { Trip, ItineraryDay, ItineraryItem } from '../types/models';

export interface TripDetailResponse extends Trip {
  days: (ItineraryDay & {
    items: ItineraryItem[];
  })[];
}

export interface CreateTripRequest {
  trip_name: string;
  destination?: string;
  start_date?: string;  // "YYYY-MM-DD" 格式
  end_date?: string;
  timezone?: string;
}

export interface UpdateTripRequest {
  trip_name?: string;
  destination?: string;
  start_date?: string;
  end_date?: string;
  timezone?: string;
  cover_image_url?: string;
}

export const tripService = {
  /**
   * 取得行程列表
   */
  async getTrips(includeArchived = false): Promise<Trip[]> {
    // ✅ 修正：後端直接返回陣列，不是 { trips, total }
    const { data } = await apiClient.get('/trips/', {
      params: { include_archived: includeArchived },
    });
    return data;
  },

  /**
   * 取得行程詳情（包含所有 Days 和 Items）
   */
  async getTripDetail(tripId: string): Promise<TripDetailResponse> {
    const { data } = await apiClient.get(`/trips/${tripId}`);
    return data;
  },

  /**
   * 建立新行程
   */
  async createTrip(tripData: CreateTripRequest): Promise<TripDetailResponse> {
    const { data } = await apiClient.post('/trips/', tripData);
    return data;
  },

  /**
   * 更新行程
   */
  async updateTrip(tripId: string, tripData: UpdateTripRequest): Promise<TripDetailResponse> {
    const { data } = await apiClient.patch(`/trips/${tripId}`, tripData);
    return data;
  },

  /**
   * 刪除行程
   */
  async deleteTrip(tripId: string): Promise<void> {
    await apiClient.delete(`/trips/${tripId}`);
  },
};