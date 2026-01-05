// src/types/models.ts

/**
 * 地點資料（對應 places 表）
 */
export interface Place {
  place_id: string;
  google_place_id?: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  place_type?: 'restaurant' | 'attraction' | 'hotel' | 'cafe' | 'shopping';
  photo_url?: string;
  rating?: number;
  created_at: string;
}

/**
 * 用戶收藏地點（對應 user_saved_places 表）
 */
export interface SavedPlace {
  saved_id: string;
  user_id: string;
  place_id: string;
  place: Place; // 關聯的地點資料
  notes?: string;
  tags?: string[];
  is_placed: boolean; // 🆕 是否已排入行程
  current_itinerary_item_id?: string; // 🆕 關聯的行程項目 ID
  saved_at: string;
}

/**
 * 旅遊專案（對應 trips 表）
 */
export interface Trip {
  trip_id: string;
  user_id: string;
  trip_name: string;
  destination?: string;
  start_date?: string;
  end_date?: string;
  timezone: string;
  cover_image_url?: string;
  is_archived: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

/**
 * 每日行程（對應 itinerary_days 表）
 */
export interface ItineraryDay {
  day_id: string;
  trip_id: string;
  day_number: number;
  date?: string;
  notes?: string;
  items: ItineraryItem[]; // 該日的所有景點
}

/**
 * 行程景點（對應 itinerary_items 表）
 */
export interface ItineraryItem {
  item_id: string;
  day_id: string;
  place_id: string;
  place: Place; // 關聯的地點資料
  sequence: number; // Fractional Indexing 排序值
  scheduled_time?: string; // HH:mm 格式
  duration_minutes?: number;
  notes?: string;
  transport_to_next?: 'walk' | 'subway' | 'taxi' | 'drive' | 'bus';
  transport_duration_minutes?: number;
  created_at: string;
  updated_at: string;
}

/**
 * 交通方式顯示文字
 */
export const TRANSPORT_LABELS: Record<
  NonNullable<ItineraryItem['transport_to_next']>,
  string
> = {
  walk: '步行',
  subway: '地鐵',
  taxi: '計程車',
  drive: '開車',
  bus: '公車',
};

/**
 * 地點類型顯示文字
 */
export const PLACE_TYPE_LABELS: Record<
  NonNullable<Place['place_type']>,
  string
> = {
  restaurant: '餐廳',
  attraction: '景點',
  hotel: '住宿',
  cafe: '咖啡廳',
  shopping: '購物',
};