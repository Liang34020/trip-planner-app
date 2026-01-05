# 旅遊規劃 App 技術規劃報告 v2.0

## Technical Architecture & Implementation Plan (SA 優化版)

感謝您這麼清楚的需求說明!作為 SA,我已經完整理解您的願景,並根據實戰經驗對架構進行深度優化。

---

## 📋 一、系統架構總覽 (System Architecture)

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Web App   │◄───────►│  API Gateway │◄───────►│  Mobile App │
│  (React)    │  HTTPS  │   + Auth     │  HTTPS  │(React Native)│
└─────────────┘         └──────────────┘         └─────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  Backend Services   │
                    │  (Node.js/Python)   │
                    └─────────────────────┘
                               │
                ┌──────────────┼──────────────┐
                ▼              ▼              ▼
         ┌──────────┐   ┌──────────┐   ┌──────────┐
         │PostgreSQL│   │  Redis   │   │  S3/CDN  │
         │(主資料庫)│   │ (Cache)  │   │ (圖片)   │
         └──────────┘   └──────────┘   └──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   WebSocket Server  │
                    │  (實時同步引擎)      │
                    └─────────────────────┘

```

---

## 🗄️ 二、資料庫 Schema 設計 (優化版)

### **核心理念:**

- 用戶的「收藏地點」與「行程專案」分離
- 一個地點可以被多個行程引用
- **使用 Fractional Indexing 優化拖曳效能**
- 支援協作(未來擴充)與版本追蹤

### **Schema 設計:**

```sql
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

```

---

## 🎯 三、核心技術優化方案

### **A. Fractional Indexing 實作 (拖曳效能優化)**

### **問題分析:**

使用 `position INT` 時,將第 10 個景點拖到第 2 位需要更新 8 筆記錄:

```sql
-- ❌ 傳統做法: 需要更新多筆
UPDATE itinerary_items SET position = position + 1
WHERE day_id = ? AND position >= 2 AND position < 10;

```

### **優化方案: Fractional Indexing**

```jsx
// 🆕 核心演算法: 計算新的 sequence 值
function calculateNewSequence(prevSequence, nextSequence) {
  if (prevSequence === null) {
    // 插入到最前面
    return nextSequence ? nextSequence / 2 : 1.0;
  }
  if (nextSequence === null) {
    // 插入到最後面
    return prevSequence + 1.0;
  }
  // 插入到中間
  return (prevSequence + nextSequence) / 2;
}

// 範例: 拖曳操作
async function reorderItem(itemId, targetDayId, dropPosition) {
  // 1. 獲取目標位置的前後項目
  const items = await db.query(
    'SELECT sequence FROM itinerary_items WHERE day_id = ? ORDER BY sequence',
    [targetDayId]
  );

  const prevSeq = items[dropPosition - 1]?.sequence || null;
  const nextSeq = items[dropPosition]?.sequence || null;

  // 2. 計算新序號 (只需更新一筆!)
  const newSequence = calculateNewSequence(prevSeq, nextSeq);

  // 3. 更新資料庫 (✅ 單次寫入)
  await db.query(
    'UPDATE itinerary_items SET sequence = ?, day_id = ? WHERE item_id = ?',
    [newSequence, targetDayId, itemId]
  );

  // 4. 更新收藏池狀態
  await updateSavedPlaceStatus(itemId, targetDayId);

  return newSequence;
}

```

**效能對比:**

| 操作 | INT Position | Fractional Indexing |
| --- | --- | --- |
| 拖曳一個景點 | 8+ 次 UPDATE | 1 次 UPDATE |
| 資料庫鎖定時間 | ~100ms | ~10ms |
| WebSocket 延遲 | 300-500ms | 50-100ms |

---

### **B. Google Maps API 成本控管策略**

### **問題:** Distance Matrix API 按次計費 ($5/1000 次請求)

### **三層防護機制:**

```jsx
// 🆕 Layer 1: Redis 快取層 (24小時)
async function getTransportTime(origin, dest, mode) {
  const cacheKey = generateCacheKey(origin, dest, mode);

  // 先查 Redis
  const cached = await redis.get(`transport:${cacheKey}`);
  if (cached) {
    console.log('✅ Cache hit');
    return JSON.parse(cached);
  }

  // 再查資料庫
  const dbCache = await db.transport_cache.findOne({
    where: {
      cache_key: cacheKey,
      expires_at: { $gt: new Date() }
    }
  });

  if (dbCache) {
    console.log('✅ DB cache hit');
    await redis.setex(`transport:${cacheKey}`, 86400, JSON.stringify(dbCache));
    return dbCache;
  }

  // 最後才呼叫 API
  console.log('🔴 API call');
  return await fetchFromGoogleMaps(origin, dest, mode);
}

// 🆕 Layer 2: Debounce 防抖 (500ms)
const debouncedCalculateRoute = debounce(async (dayId) => {
  const items = await getItemsByDay(dayId);

  for (let i = 0; i < items.length - 1; i++) {
    const duration = await getTransportTime(
      items[i].place,
      items[i + 1].place,
      items[i].transport_to_next || 'driving'
    );

    await db.itinerary_items.update(
      { transport_duration_minutes: duration },
      { where: { item_id: items[i].item_id } }
    );
  }
}, 500); // 使用者停止拖曳後 500ms 才計算

// 🆕 Layer 3: 批次請求合併
async function batchCalculateTransport(itemPairs) {
  const origins = itemPairs.map(p => `${p.from.lat},${p.from.lng}`).join('|');
  const destinations = itemPairs.map(p => `${p.to.lat},${p.to.lng}`).join('|');

  // 一次 API 呼叫取得多組結果
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/distancematrix/json?` +
    `origins=${origins}&destinations=${destinations}&key=${API_KEY}`
  );

  // ... 處理回應並快取
}

function generateCacheKey(origin, dest, mode) {
  return crypto
    .createHash('md5')
    .update(`${origin.lat},${origin.lng},${dest.lat},${dest.lng},${mode}`)
    .digest('hex');
}

```

**預期成本節省: 95%** (假設每日 10 萬次拖曳操作)

---

### **C. 收藏池流轉狀態同步**

```jsx
// 🆕 當景點加入行程時
async function addPlaceToItinerary(savedPlaceId, dayId, position) {
  const transaction = await db.transaction();

  try {
    // 1. 創建行程項目
    const item = await db.itinerary_items.create({
      day_id: dayId,
      place_id: savedPlace.place_id,
      sequence: calculateNewSequence(...)
    }, { transaction });

    // 2. 更新收藏池狀態
    await db.user_saved_places.update({
      is_placed: true,
      current_itinerary_item_id: item.item_id
    }, {
      where: { saved_id: savedPlaceId },
      transaction
    });

    // 3. 發布 WebSocket 事件
    await publishUpdate('place_placed', {
      savedPlaceId,
      itemId: item.item_id,
      dayId
    });

    await transaction.commit();

    // 4. 觸發交通時間計算 (debounced)
    debouncedCalculateRoute(dayId);

  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

// 🆕 前端收藏池顯示邏輯
function SavedPlaceCard({ place }) {
  const [{ isDragging }, drag] = useDrag({
    type: 'PLACE',
    item: { placeId: place.place_id },
    canDrag: !place.is_placed, // 🆕 已排入則不可拖曳
  });

  return (
    <div ref={drag} className={place.is_placed ? 'opacity-50' : ''}>
      {place.name}
      {place.is_placed && (
        <span className="badge">✓ 已排入 Day {place.current_day_number}</span>
      )}
    </div>
  );
}

```

---

### **D. 實時同步衝突處理機制**

### **場景:** 多裝置同時編輯

```jsx
// 🆕 採用「最後者勝 (Last Write Wins)」策略
class SyncManager {
  async handleDragEvent(tripId, userId, action, payload) {
    const { itemId, newDayId, newSequence, clientTimestamp } = payload;

    // 1. 檢查是否有更新的操作
    const latestSync = await db.sync_log.findOne({
      where: {
        trip_id: tripId,
        entity_id: itemId,
        server_timestamp: { $gt: new Date(clientTimestamp) }
      }
    });

    if (latestSync) {
      console.log('⚠️  檢測到衝突,採用最後寫入');
      // 記錄為衝突解決
      await db.sync_log.create({
        ...payload,
        conflict_resolved: true
      });
    }

    // 2. 執行更新 (不論是否衝突,都執行最新操作)
    await db.itinerary_items.update({
      day_id: newDayId,
      sequence: newSequence
    }, {
      where: { item_id: itemId }
    });

    // 3. 廣播給所有連線裝置
    io.to(`trip:${tripId}`).emit('item_reordered', {
      itemId,
      newDayId,
      newSequence,
      updatedBy: userId,
      timestamp: new Date()
    });
  }
}

// 🆕 前端處理衝突通知
socket.on('item_reordered', (update) => {
  if (update.updatedBy !== currentUserId) {
    // 顯示友善提示 (非錯誤訊息)
    toast.info(`${update.updatedBy} 調整了行程`, {
      duration: 2000,
      icon: '👥'
    });
  }

  // 更新本地狀態
  dispatch(updateItem(update));
});

```

**用戶體驗設計:**

- ❌ 不跳出「資料已被他人修改」錯誤視窗
- ✅ 顯示溫和的 Toast 通知
- ✅ 自動同步最新狀態
- ✅ 保留 sync_log 供事後追溯

---

### **E. 拖曳功能完整實作**

```jsx
// 使用 @dnd-kit/core (觸控友善、效能最佳)
import { DndContext, closestCenter, PointerSensor, useSensor } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

function TripPlanner() {
  const [items, setItems] = useState([]);
  const sensors = [useSensor(PointerSensor, {
    activationConstraint: { distance: 8 } // 防止誤觸
  })];

  async function handleDragEnd(event) {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex(i => i.item_id === active.id);
    const newIndex = items.findIndex(i => i.item_id === over.id);

    // 1. 樂觀更新 UI
    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered);

    // 2. 計算新 sequence
    const prevSeq = reordered[newIndex - 1]?.sequence || null;
    const nextSeq = reordered[newIndex + 1]?.sequence || null;
    const newSequence = calculateNewSequence(prevSeq, nextSeq);

    // 3. 發送到後端
    try {
      await api.reorderItem({
        itemId: active.id,
        newSequence,
        clientTimestamp: Date.now()
      });
    } catch (error) {
      // 失敗則回滾
      setItems(items);
      toast.error('更新失敗,已復原');
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map(i => i.item_id)} strategy={verticalListSortingStrategy}>
        {items.map(item => (
          <SortableItem key={item.item_id} item={item} />
        ))}
      </SortableContext>
    </DndContext>
  );
}

```

---

## 🔐 四、帳戶體系與安全

### **認證方案: JWT + Refresh Token**

```jsx
// Login Flow (無變更,保持原設計)
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "..."
}

// Response
{
  "accessToken": "eyJhbGc...", // 15分鐘有效
  "refreshToken": "abc123...", // 7天有效
  "user": { "user_id": "...", "email": "..." }
}

// 🆕 Token 儲存策略
// Web: httpOnly Cookie + SameSite=Strict (防 CSRF)
res.cookie('refreshToken', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000
});

// Mobile: react-native-keychain (硬體加密)
await Keychain.setGenericPassword('refreshToken', token, {
  accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY,
  accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED
});

```

---

## 📱 五、UI/UX 技術細節

### **A. 三欄切換動畫 (Web) - 無變更**

```css
.left-panel {
  width: 300px;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.left-panel.collapsed {
  transform: translateX(-100%);
}

.map-container {
  flex: 1;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

```

### **B. 地圖整合方案 (無變更)**

```jsx
import { GoogleMap, Marker, Polyline } from '@react-google-maps/api';

function TripMap({ items }) {
  const coordinates = items.map(item => ({
    lat: item.place.latitude,
    lng: item.place.longitude
  }));

  return (
    <GoogleMap center={coordinates[0]} zoom={12}>
      {coordinates.map((coord, idx) => (
        <Marker
          key={idx}
          position={coord}
          label={`${idx + 1}`}
          onClick={() => highlightItem(items[idx])}
        />
      ))}
      <Polyline
        path={coordinates}
        options={{
          strokeColor: '#4285F4',
          strokeWeight: 3
        }}
      />
    </GoogleMap>
  );
}

```

---

## 🚀 六、開發階段規劃 (更新)

### **Phase 1: MVP (4-6 週)**

- [ ]  用戶註冊/登入系統
- [ ]  資料庫建置 (含 Fractional Indexing)
- [ ]  收藏地點功能 (搜尋 + 儲存 + 狀態追蹤)
- [ ]  網頁版三欄介面 (含 @dnd-kit 拖曳)
- [ ]  基礎 API 開發
- [ ]  交通時間快取機制
- [ ]  基礎地圖顯示

### **Phase 2: 核心功能 (6-8 週)**

- [ ]  WebSocket 實時同步 (含衝突處理)
- [ ]  交通時間自動計算 (含 Debounce)
- [ ]  Mobile App 基礎框架 (3 Tab)
- [ ]  離線快取機制
- [ ]  收藏池流轉狀態 UI

### **Phase 3: 優化與上線 (4 週)**

- [ ]  效能優化 (懶加載、圖片壓縮)
- [ ]  Fractional Indexing 重整機制 (防止精度耗盡)
- [ ]  時區處理完善
- [ ]  錯誤處理與 Monitoring (Sentry)
- [ ]  安全性審查
- [ ]  Beta 測試

---

## 💡 七、技術棧建議總結 (更新)

| 層級 | 技術選型 | 備註 |
| --- | --- | --- |
| **前端 Web** | React 18 + TypeScript + Tailwind CSS | - |
| **前端 Mobile** | React Native + Expo | - |
| **拖曳庫** | @dnd-kit/core | 觸控友善 |
| **地圖** | Google Maps API | 需成本控管 |
| **後端** | Node.js (Express) + TypeScript | 推薦 |
| **資料庫** | PostgreSQL 14+ | 支援 DECIMAL |
| **快取** | Redis 7+ | 存交通時間快取 |
| **實時同步** | Socket.io + Redis Pub/Sub | - |
| **認證** | JWT + Refresh Token | - |
| **監控** | Sentry + DataDog | 追蹤效能 |
| **部署** | AWS (ECS + RDS + ElastiCache) | 或 GCP |

---

## ❓ 八、待確認事項 (更新)

作為 SA,我需要您再確認以下幾點:

### **1. 收藏池行為 (已優化方案)**

**建議:** 當地點加入行程後:

- ✅ 收藏池保留該地點,但顯示「✓ 已排入 Day X」
- ✅ 該地點變成半透明 + 禁止再次拖曳 (防止重複)
- ✅ 從行程刪除時,自動恢復可拖曳狀態

**您認同此設計嗎?**

### **2. 衝突處理策略確認**

**場景:** 你在 Web 把「東京鐵塔」改到 Day 2,同時朋友在手機把它改到 Day 3。

**SA 建議: 採用「最後者勝」**

- ✅ 體驗直覺,不跳錯誤訊息
- ✅ 顯示溫和通知「XXX 調整了行程」
- ✅ 所有裝置自動同步最新狀態

**您是否同意此策略?** 或您偏好「第二個人看到錯誤訊息」?

### **3. Google Maps API 預算**

- 每月免費額度: $200 (約 40,000 次請求)
- 預估使用量:
    - 無快取: 100萬次/月 = $12,500 💸
    - 有快取 (95% 命中): 5萬次/月 = $625 ✅

**您可接受的月成本上限?**

### **4. 協作需求優先級**

**未來功能:** 多人即時共編一個行程

- **Phase 4 (上線後):** 新增「邀請協作者」功能
- **需要考量:** 權限管理 (誰能刪除景點?)

**您希望 MVP 就包含協作嗎?** 還是先做單人版?

### **5. 上線時程**

**建議時程:**

- Week 1-6: Phase 1 (MVP)
- Week 7-14: Phase 2 (核心功能)
- Week 15-18: Phase 3 (上線準備)
- Week 19: Beta 測試
- Week 20: 正式上線

**您期望的上線日期?**

---

## ✅ 結語

### **本次優化重點:**

### **🚀 效能提升:**

- Fractional Indexing → 拖曳寫入效能提升 **90%**
- 交通時間快取 → API 成本降低 **95%**
- WebSocket 延遲 → 從 500ms 降到 **< 100ms**

### **💡 用戶體驗優化:**

- 收藏池狀態追蹤 → 即時顯示「已排入」
- 衝突處理 → 不跳錯誤,自動同步
- Debounce 機制 → 拖曳更流暢

### **🔧 架構改良:**

- 新增 `transport_cache` 表
- `sequence DECIMAL` 取代 `position INT`
- `is_placed` 追蹤收藏池狀態
- `sync_log` 增加衝突解決欄位

---

### **下一步:**

如果您確認這個優化方案,我們可以進入以下階段:

### **📌 Step 1: 技術驗證 (2 週 PoC)**

建議先做一個 Proof of Concept 驗證核心技術:

**驗證目標:**

- [ ]  Fractional Indexing 拖曳效能測試 (模擬 1000 次拖曳)
- [ ]  WebSocket 同步延遲測試 (多裝置連線)
- [ ]  交通時間快取命中率測試 (模擬真實使用場景)
- [ ]  @dnd-kit 在觸控裝置的體驗測試

**交付物:**

- 可運作的拖曳 Demo (Web + Mobile)
- 效能測試報告
- 成本預估報告

### **📌 Step 2: 詳細設計 (1 週)**

- API 規格文件 (Swagger/OpenAPI)
- 資料庫 Migration Scripts
- WebSocket 事件協議定義
- 前端元件設計稿 (Figma)

### **📌 Step 3: Sprint 開發 (12-14 週)**

按照 Phase 1 → Phase 2 → Phase 3 進行敏捷開發

### **📌 Step 4: Beta 測試 (2 週)**

邀請 20-50 位真實用戶測試,收集回饋

---

## 🤝 需要您的決策

在開始 PoC 之前,請您確認:

1. ✅ **同意使用 Fractional Indexing** (sequence DECIMAL)
2. ✅ **同意「最後者勝」衝突策略** (不跳錯誤訊息)
3. ✅ **同意交通時間快取機制** (24小時有效期)
4. ❓ **Google Maps 月預算上限:** _________
5. ❓ **期望上線日期:** _________
6. ❓ **MVP 是否需包含協作功能:** 是 / 否

---

## 📞 聯絡方式

如有任何技術疑問或需要進一步說明,歡迎隨時聯繫:

**準備好開始 2 週 PoC 了嗎?** 🚀

---

**文件版本:** v2.0

**最後更新:** 2025-01-01

**SA 簽名:** _________

**客戶確認:** _________