// web/src/services/savedPlaceService.ts
import apiClient from './api';
import type { SavedPlace } from '../types/models';

export interface CreateSavedPlaceRequest {
  place_id: string;
  notes?: string;
  tags?: string[];
}

export interface UpdateSavedPlaceRequest {
  notes?: string;
  tags?: string[];
}

export const savedPlaceService = {
  /**
   * 取得收藏池列表
   */
  async getSavedPlaces(): Promise<SavedPlace[]> {
    const { data } = await apiClient.get('/saved-places/');
    return data;
  },

  /**
   * 新增地點到收藏池
   */
  async createSavedPlace(placeData: CreateSavedPlaceRequest): Promise<SavedPlace> {
    const { data } = await apiClient.post('/saved-places/', placeData);
    return data;
  },

  /**
   * 更新收藏地點
   */
  async updateSavedPlace(
    savedId: string,
    placeData: UpdateSavedPlaceRequest
  ): Promise<SavedPlace> {
    const { data } = await apiClient.put(`/saved-places/${savedId}`, placeData);
    return data;
  },

  /**
   * 刪除收藏地點
   */
  async deleteSavedPlace(savedId: string): Promise<void> {
    await apiClient.delete(`/saved-places/${savedId}`);
  },
};