-- 1. 用戶表
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. 地點資料表 (全局地點池)
CREATE TABLE places (
    place_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_place_id VARCHAR(255) UNIQUE, -- Google Maps Place ID
    name VARCHAR(255) NOT NULL,
    address TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    place_type VARCHAR(50), -- restaurant, attraction, hotel...
    photo_url TEXT,
    rating DECIMAL(2,1),
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_places_coordinates ON places(latitude, longitude);
CREATE INDEX idx_places_google_id ON places(google_place_id);

-- 3. 用戶收藏地點 (Inspiration Pool) - 新增流轉狀態追蹤
CREATE TABLE user_saved_places (
    saved_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    place_id UUID REFERENCES places(place_id) ON DELETE CASCADE,
    notes TEXT, -- 用戶個人備註
    tags TEXT[], -- 自定義標籤 ['美食', '必去']
    is_placed BOOLEAN DEFAULT FALSE, -- 🆕 是否已排入行程
    current_itinerary_item_id UUID, -- 🆕 關聯的行程項目ID (nullable)
    saved_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, place_id)
);
CREATE INDEX idx_saved_user ON user_saved_places(user_id);
CREATE INDEX idx_saved_placed ON user_saved_places(user_id, is_placed);

-- 4. 旅遊專案 (Trip Projects)
CREATE TABLE trips (
    trip_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    trip_name VARCHAR(255) NOT NULL,
    destination VARCHAR(100), -- "日本東京"
    start_date DATE,
    end_date DATE,
    timezone VARCHAR(50) DEFAULT 'UTC', -- 'Asia/Tokyo'
    cover_image_url TEXT,
    is_archived BOOLEAN DEFAULT FALSE,
    version INT DEFAULT 1, -- 🆕 樂觀鎖版本號
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_trips_user ON trips(user_id);

-- 5. 每日行程 (Daily Itinerary)
CREATE TABLE itinerary_days (
    day_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID REFERENCES trips(trip_id) ON DELETE CASCADE,
    day_number INT NOT NULL, -- Day 1, Day 2...
    date DATE, -- 實際日期
    notes TEXT, -- 當日總備註
    UNIQUE(trip_id, day_number)
);

-- 6. 行程景點 (核心: 景點在時間軸上的排列) - 使用 Fractional Indexing
CREATE TABLE itinerary_items (
    item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_id UUID REFERENCES itinerary_days(day_id) ON DELETE CASCADE,
    place_id UUID REFERENCES places(place_id) ON DELETE CASCADE,
    sequence DECIMAL(20, 10) NOT NULL, -- 🆕 改用浮點數排序 (Fractional Indexing)
    scheduled_time TIME, -- 預計到達時間 (可選)
    duration_minutes INT, -- 預計停留時間
    notes TEXT, -- 該景點在此行程的專屬備註
    transport_to_next VARCHAR(50), -- 'walk', 'subway', 'taxi', 'drive'
    transport_duration_minutes INT, -- 到下一個點的交通時間
    transport_cache_key VARCHAR(255), -- 🆕 交通時間查詢快取鍵
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_items_day_sequence ON itinerary_items(day_id, sequence);
CREATE INDEX idx_items_place ON itinerary_items(place_id);

-- 7. 交通時間快取表 (減少 Google Maps API 呼叫)
CREATE TABLE transport_cache (
    cache_key VARCHAR(255) PRIMARY KEY, -- MD5(origin_lat,origin_lng,dest_lat,dest_lng,mode)
    origin_lat DECIMAL(10, 8),
    origin_lng DECIMAL(11, 8),
    dest_lat DECIMAL(10, 8),
    dest_lng DECIMAL(11, 8),
    transport_mode VARCHAR(50),
    duration_minutes INT,
    distance_meters INT,
    cached_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '24 hours') -- 🆕 24小時過期
);
CREATE INDEX idx_transport_expires ON transport_cache(expires_at);

-- 8. 實時同步版本控制 (用於 WebSocket 增量更新)
CREATE TABLE sync_log (
    sync_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID REFERENCES trips(trip_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id),
    action VARCHAR(50), -- 'add_item', 'reorder', 'delete_item', 'update_transport'
    entity_type VARCHAR(50), -- 'itinerary_item', 'trip', 'day'
    entity_id UUID,
    payload JSONB, -- 變更內容
    client_timestamp TIMESTAMP, -- 🆕 客戶端時間戳(用於衝突解決)
    server_timestamp TIMESTAMP DEFAULT NOW(),
    conflict_resolved BOOLEAN DEFAULT FALSE -- 🆕 是否為衝突解決後的記錄
);
CREATE INDEX idx_sync_trip_time ON sync_log(trip_id, server_timestamp DESC);
