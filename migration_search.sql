-- ============================================================
-- Migration: 搜尋功能 - places 表補欄位
-- ============================================================

-- 建立 place_status_enum 型別（如果尚未存在）
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'place_status_enum') THEN
        CREATE TYPE place_status_enum AS ENUM ('ACTIVE', 'CLOSED', 'HIDDEN');
    END IF;
END$$;

-- 三個欄位合併成單一 ALTER TABLE（避免 PowerShell 管道傳輸的語法問題）
ALTER TABLE places
    ADD COLUMN IF NOT EXISTS google_maps_url TEXT,
    ADD COLUMN IF NOT EXISTS status place_status_enum NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP WITH TIME ZONE;

-- 為搜尋功能建立索引
CREATE INDEX IF NOT EXISTS idx_places_name ON places(name);
CREATE INDEX IF NOT EXISTS idx_places_status ON places(status);

-- 完成訊息
DO $$
BEGIN
    RAISE NOTICE 'Migration 完成：places 表已補齊搜尋功能所需欄位';
END $$;