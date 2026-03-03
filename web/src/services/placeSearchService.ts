/**
 * Place Search Service
 * 封裝搜尋相關的 API 呼叫
 */
import apiClient from './api';

// ─────────────────────────────────────────────
// 型別定義
// ─────────────────────────────────────────────

export interface AutocompleteItem {
  place_id: string;       // Google place_id 或 DB uuid
  display_name: string;   // 主要名稱
  secondary_text: string; // 副標題（城市/地區）
  is_closed: boolean;     // 是否為歇業警告
  warning?: string;       // 歇業提示文字
}

export interface PlaceDetail {
  place_id: string;
  google_place_id?: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  place_type?: string;
  rating?: number;
  google_maps_url?: string;
  status?: string;
  last_updated?: string;
  created_at: string;
}

// ─────────────────────────────────────────────
// Service 函式
// ─────────────────────────────────────────────

/**
 * 搜尋景點預測清單（輕量，debounce 後呼叫）
 * 對應後端：GET /api/v1/places/autocomplete?q=...
 */
export async function autocomplete(query: string): Promise<AutocompleteItem[]> {
  if (!query.trim()) return [];
  const resp = await apiClient.get<AutocompleteItem[]>(
    '/places/autocomplete',
    { params: { q: query } }
  );
  return resp.data;
}

/**
 * 取得景點詳細資料（使用者點擊後呼叫）
 * 對應後端：GET /api/v1/places/{place_id}/detail
 * 後端會優先查 DB，超過 30 天才打 Google API
 */
export async function getPlaceDetail(placeId: string): Promise<PlaceDetail> {
  const resp = await apiClient.get<PlaceDetail>(
    `/places/${placeId}/detail`
  );
  return resp.data;
}

/**
 * 【預留】從 Google Maps 連結匯入景點
 * 對應後端：POST /api/v1/places/import-from-maps
 */
export async function importFromMapsUrl(url: string): Promise<PlaceDetail> {
  const resp = await apiClient.post<PlaceDetail>(
    '/places/import-from-maps',
    { url }
  );
  return resp.data;
}