-- Trip Planner 資料庫初始化腳本
-- 基於 database-schema.sql，優化後的版本

-- 啟用 UUID 擴展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. 用戶表
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. 地點資料表 (全局地點池)
CREATE TABLE IF NOT EXISTS places (
    place_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    google_place_id VARCHAR(255) UNIQUE,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    place_type VARCHAR(50),
    photo_url TEXT,
    rating DECIMAL(2,1),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_places_coordinates ON places(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_places_google_id ON places(google_place_id);

-- 3. 用戶收藏地點 (Inspiration Pool)
CREATE TABLE IF NOT EXISTS user_saved_places (
    saved_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    place_id UUID REFERENCES places(place_id) ON DELETE CASCADE,
    notes TEXT,
    tags TEXT[],
    is_placed BOOLEAN DEFAULT FALSE,
    current_itinerary_item_id UUID,
    saved_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, place_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_user ON user_saved_places(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_placed ON user_saved_places(user_id, is_placed);

-- 4. 旅遊專案 (Trip Projects)
CREATE TABLE IF NOT EXISTS trips (
    trip_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    trip_name VARCHAR(255) NOT NULL,
    destination VARCHAR(100),
    start_date DATE,
    end_date DATE,
    timezone VARCHAR(50) DEFAULT 'UTC',
    cover_image_url TEXT,
    is_archived BOOLEAN DEFAULT FALSE,
    version INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trips_user ON trips(user_id);
CREATE INDEX IF NOT EXISTS idx_trips_dates ON trips(start_date, end_date);

-- 5. 每日行程 (Daily Itinerary)
CREATE TABLE IF NOT EXISTS itinerary_days (
    day_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID REFERENCES trips(trip_id) ON DELETE CASCADE,
    day_number INT NOT NULL,
    date DATE,
    notes TEXT,
    default_transport VARCHAR(50) DEFAULT 'walk',
    UNIQUE(trip_id, day_number)
);

CREATE INDEX IF NOT EXISTS idx_days_trip ON itinerary_days(trip_id, day_number);

-- 6. 行程景點 (使用 Fractional Indexing)
CREATE TABLE IF NOT EXISTS itinerary_items (
    item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    day_id UUID REFERENCES itinerary_days(day_id) ON DELETE CASCADE,
    place_id UUID REFERENCES places(place_id) ON DELETE CASCADE,
    sequence DECIMAL(20, 10) NOT NULL,
    scheduled_time TIME,
    duration_minutes INT,
    notes TEXT,
    transport_to_next VARCHAR(50),
    transport_duration_minutes INT,
    transport_cache_key VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_items_day_sequence ON itinerary_items(day_id, sequence);
CREATE INDEX IF NOT EXISTS idx_items_place ON itinerary_items(place_id);

-- 7. 交通時間快取表
CREATE TABLE IF NOT EXISTS transport_cache (
    cache_key VARCHAR(255) PRIMARY KEY,
    origin_lat DECIMAL(10, 8),
    origin_lng DECIMAL(11, 8),
    dest_lat DECIMAL(10, 8),
    dest_lng DECIMAL(11, 8),
    transport_mode VARCHAR(50),
    duration_minutes INT,
    distance_meters INT,
    cached_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_transport_expires ON transport_cache(expires_at);

-- 8. 實時同步版本控制
CREATE TABLE IF NOT EXISTS sync_log (
    sync_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID REFERENCES trips(trip_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id),
    action VARCHAR(50),
    entity_type VARCHAR(50),
    entity_id UUID,
    payload JSONB,
    client_timestamp TIMESTAMP,
    server_timestamp TIMESTAMP DEFAULT NOW(),
    conflict_resolved BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_sync_trip_time ON sync_log(trip_id, server_timestamp DESC);

-- 建立更新 updated_at 的觸發器函數
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 為需要的表添加觸發器
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trips_updated_at BEFORE UPDATE ON trips
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_itinerary_items_updated_at BEFORE UPDATE ON itinerary_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 清理過期快取的函數
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM transport_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 完成訊息
DO $$
BEGIN
    RAISE NOTICE '✅ 資料庫初始化完成！';
END $$;
