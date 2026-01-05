// src/utils/mockData.ts

import type { Place, SavedPlace, Trip, ItineraryDay } from '../types/models';

/**
 * 模擬地點資料
 */
export const mockPlaces: Place[] = [
  {
    place_id: 'place_1',
    name: '淺草寺',
    address: '東京都台東區淺草2-3-1',
    latitude: 35.7148,
    longitude: 139.7967,
    place_type: 'attraction',
    photo_url: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400',
    rating: 4.5,
    created_at: '2025-01-01T00:00:00Z',
  },
  {
    place_id: 'place_2',
    name: '晴空塔',
    address: '東京都墨田區押上1-1-2',
    latitude: 35.7101,
    longitude: 139.8107,
    place_type: 'attraction',
    photo_url: 'https://images.unsplash.com/photo-1536098561742-ca998e48cbcc?w=400',
    rating: 4.6,
    created_at: '2025-01-01T00:00:00Z',
  },
  {
    place_id: 'place_3',
    name: '築地市場',
    address: '東京都中央區築地5-2-1',
    latitude: 35.6654,
    longitude: 139.7707,
    place_type: 'restaurant',
    photo_url: 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=400',
    rating: 4.4,
    created_at: '2025-01-01T00:00:00Z',
  },
  {
    place_id: 'place_4',
    name: '明治神宮',
    address: '東京都澀谷區代代木神園町1-1',
    latitude: 35.6764,
    longitude: 139.6993,
    place_type: 'attraction',
    photo_url: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=400',
    rating: 4.5,
    created_at: '2025-01-01T00:00:00Z',
  },
  {
    place_id: 'place_5',
    name: '上野公園',
    address: '東京都台東區上野公園',
    latitude: 35.7148,
    longitude: 139.7744,
    place_type: 'attraction',
    photo_url: 'https://images.unsplash.com/photo-1480796927426-f609979314bd?w=400',
    rating: 4.3,
    created_at: '2025-01-01T00:00:00Z',
  },
  {
    place_id: 'place_6',
    name: '涉谷十字路口',
    address: '東京都澀谷區道玄坂2-1',
    latitude: 35.6595,
    longitude: 139.7004,
    place_type: 'attraction',
    photo_url: 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=400',
    rating: 4.7,
    created_at: '2025-01-01T00:00:00Z',
  },
];

/**
 * 模擬收藏地點（Inspiration Pool）
 */
export const mockSavedPlaces: SavedPlace[] = mockPlaces.map((place, idx) => ({
  saved_id: `saved_${idx + 1}`,
  user_id: 'user_1',
  place_id: place.place_id,
  place,
  notes: idx === 0 ? '一定要去參拜' : undefined,
  tags: idx === 0 ? ['必去', '文化'] : idx === 2 ? ['美食'] : [],
  is_placed: idx < 2, // 前兩個已排入行程
  current_itinerary_item_id: idx < 2 ? `item_${idx + 1}` : undefined,
  saved_at: '2025-01-01T00:00:00Z',
}));

/**
 * 模擬旅遊專案
 */
export const mockTrip: Trip = {
  trip_id: 'trip_1',
  user_id: 'user_1',
  trip_name: '東京五日遊',
  destination: '日本東京',
  start_date: '2025-03-15',
  end_date: '2025-03-19',
  timezone: 'Asia/Tokyo',
  cover_image_url: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800',
  is_archived: false,
  version: 1,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

/**
 * 模擬每日行程
 */
export const mockItineraryDays: ItineraryDay[] = [
  {
    day_id: 'day_1',
    trip_id: 'trip_1',
    day_number: 1,
    date: '2025-03-15',
    notes: '第一天：東京經典景點',
    items: [
      {
        item_id: 'item_1',
        day_id: 'day_1',
        place_id: 'place_1',
        place: mockPlaces[0],
        sequence: 1.0,
        scheduled_time: '09:00',
        duration_minutes: 120,
        notes: '早上人比較少',
        transport_to_next: 'subway',
        transport_duration_minutes: 15,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      },
      {
        item_id: 'item_2',
        day_id: 'day_1',
        place_id: 'place_2',
        place: mockPlaces[1],
        sequence: 2.0,
        scheduled_time: '12:00',
        duration_minutes: 180,
        notes: '可以在塔上用餐',
        transport_to_next: 'walk',
        transport_duration_minutes: 10,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      },
    ],
  },
  {
    day_id: 'day_2',
    trip_id: 'trip_1',
    day_number: 2,
    date: '2025-03-16',
    notes: '第二天：購物與美食',
    items: [],
  },
  {
    day_id: 'day_3',
    trip_id: 'trip_1',
    day_number: 3,
    date: '2025-03-17',
    items: [],
  },
];