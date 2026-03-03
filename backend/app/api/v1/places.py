"""
Places API
新增三個端點：
  GET  /api/v1/places/autocomplete     - 搜尋預測清單（併發 DB + Google）
  GET  /api/v1/places/{place_id}/detail - 景點詳情（DB 優先，超過 30 天才打 Google）
  POST /api/v1/places/import-from-maps  - 預留：Google Maps 連結匯入
"""
import asyncio
import uuid
import httpx
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel

from app.core.database import get_db
from app.models.place import Place, PlaceStatus
from app.schemas.place import (
    PlaceResponse,
    AutocompleteItem,
    PlaceDetailResponse,
)
from app.services.google_places_service import google_places_service

router = APIRouter()

# DB 快取有效期（30 天）
CACHE_VALID_DAYS = 30


# ─────────────────────────────────────────────
# 原有端點（保持相容）
# ─────────────────────────────────────────────

@router.get("/", response_model=List[PlaceResponse])
async def get_places(
    search: str = Query(None, description="搜尋關鍵字"),
    place_type: str = Query(None, description="地點類型篩選"),
    limit: int = Query(100, ge=1, le=500, description="返回數量"),
    db: AsyncSession = Depends(get_db)
):
    """獲取地點列表（原有端點，保持不變）"""
    query = select(Place)

    if search:
        query = query.where(Place.name.ilike(f"%{search}%"))
    if place_type:
        query = query.where(Place.place_type == place_type)

    query = query.limit(limit)
    result = await db.execute(query)
    places = result.scalars().all()
    return places


@router.get("/{place_id}", response_model=PlaceResponse)
async def get_place(place_id: str, db: AsyncSession = Depends(get_db)):
    """獲取單個地點詳情（原有端點，保持不變）"""
    result = await db.execute(select(Place).where(Place.place_id == place_id))
    place = result.scalar_one_or_none()
    if not place:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="地點不存在")
    return place


# ─────────────────────────────────────────────
# B-3：Autocomplete 端點
# ─────────────────────────────────────────────

@router.get("/autocomplete", response_model=List[AutocompleteItem])
async def autocomplete_places(
    q: str = Query(..., min_length=1, description="搜尋關鍵字"),
    db: AsyncSession = Depends(get_db)
):
    """
    搜尋景點預測清單（輕量化）

    邏輯：
    1. 併發查詢 DB（關鍵字模糊）+ Google Autocomplete
    2. 歇業景點處理：DB 有(CLOSED/HIDDEN) 但 Google 沒有 → 置頂顯示警告
    3. 排序：歇業警告 > 其他結果
    """

    # 1. 併發查詢
    db_task = _search_db(q, db)
    google_task = google_places_service.autocomplete(q)
    db_places, google_results = await asyncio.gather(db_task, google_task)

    # 2. 建立 Google place_id 集合（用來比對歇業）
    google_place_ids = {r.place_id for r in google_results}

    # 3. 處理 DB 中的歇業景點（有名字符合 q，但 Google 沒搜到）
    closed_items: list[AutocompleteItem] = []
    for place in db_places:
        if place.status in (PlaceStatus.CLOSED, PlaceStatus.HIDDEN):
            if place.google_place_id not in google_place_ids:
                # Google 沒有此點 → 歇業警告置頂
                closed_items.append(AutocompleteItem(
                    place_id=str(place.place_id),
                    display_name=place.name,
                    secondary_text=place.address or "",
                    is_closed=True,
                    warning="提示：地圖資訊顯示此處可能已歇業",
                ))

    # 4. 正常結果（來自 Google Autocomplete）
    normal_items: list[AutocompleteItem] = [
        AutocompleteItem(
            place_id=r.place_id,
            display_name=r.display_name,
            secondary_text=r.secondary_text,
        )
        for r in google_results
    ]

    # 5. 若 Google 無結果，補入 DB 中的 ACTIVE 景點
    if not normal_items:
        for place in db_places:
            if place.status == PlaceStatus.ACTIVE:
                normal_items.append(AutocompleteItem(
                    place_id=str(place.place_id),
                    display_name=place.name,
                    secondary_text=place.address or "",
                ))

    # 歇業警告置頂
    return closed_items + normal_items


# ─────────────────────────────────────────────
# B-3：Place Detail 端點
# ─────────────────────────────────────────────

@router.get("/{google_place_id}/detail", response_model=PlaceDetailResponse)
async def get_place_detail(
    google_place_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    取得景點詳細資料（只在使用者點擊時呼叫）

    邏輯：
    1. 先查 DB（用 google_place_id 或 place_id）
    2. DB 有且 last_updated < 30 天 → 直接回傳，不打 Google API
    3. 否則呼叫 Google Place Details → upsert DB → 回傳
    """
    now = datetime.now(timezone.utc)
    cache_cutoff = now - timedelta(days=CACHE_VALID_DAYS)

    # 判斷傳入的是 google_place_id 還是 DB uuid
    is_uuid = _is_uuid(google_place_id)

    if is_uuid:
        stmt = select(Place).where(Place.place_id == google_place_id)
    else:
        stmt = select(Place).where(Place.google_place_id == google_place_id)

    result = await db.execute(stmt)
    place = result.scalar_one_or_none()

    # DB 有且資料還新鮮 → 直接回傳
    if place and place.last_updated and place.last_updated > cache_cutoff:
        return place

    # 需要呼叫 Google API
    # 若是 uuid 形式但找到了 place，用 place.google_place_id 打 Google
    g_place_id = google_place_id
    if is_uuid and place and place.google_place_id:
        g_place_id = place.google_place_id

    detail = await google_places_service.place_details(g_place_id)

    if not detail:
        # Google 沒回傳（可能歇業或 API 失敗）
        if place:
            # 有 DB 資料就回傳舊的（不更新 status，讓使用者知道景點存在）
            return place
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="找不到此景點資料"
        )

    # Upsert DB
    place = await _upsert_place(db, detail, existing=place)
    return place


# ─────────────────────────────────────────────
# B-4：預留 Google Maps 連結匯入
# ─────────────────────────────────────────────

class ImportRequest(BaseModel):
    url: str

@router.post("/import-from-maps", response_model=PlaceDetailResponse)
async def import_from_maps_url(
    body: ImportRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    【預留功能】從 Google Maps 分享連結匯入景點

    支援格式：
    - https://maps.app.goo.gl/xxxxxxx    （短網址，自動展開）
    - https://www.google.com/maps/place/  （長網址，直接解析）

    流程：解析 place_id → 走同一套 place_details 流程
    """
    url = body.url.strip()
    google_place_id = await _extract_place_id_from_url(url)

    if not google_place_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="無法從此連結解析景點資訊，請確認連結格式正確",
        )

    # 複用 detail 端點邏輯
    return await get_place_detail(google_place_id, db)


# ─────────────────────────────────────────────
# 內部輔助函式
# ─────────────────────────────────────────────

async def _search_db(q: str, db: AsyncSession) -> list[Place]:
    """查詢 DB 中名稱符合關鍵字的景點（含歇業）"""
    result = await db.execute(
        select(Place).where(Place.name.ilike(f"%{q}%")).limit(20)
    )
    return list(result.scalars().all())


async def _upsert_place(
    db: AsyncSession,
    detail,
    existing: Optional[Place] = None,
) -> Place:
    """將 Google Detail 資料寫入或更新 DB"""
    now = datetime.now(timezone.utc)

    if existing:
        # 更新現有紀錄
        existing.name = detail.name
        existing.address = detail.address
        existing.latitude = detail.latitude
        existing.longitude = detail.longitude
        existing.rating = detail.rating
        existing.google_maps_url = detail.google_maps_url
        existing.last_updated = now
        existing.status = PlaceStatus.ACTIVE  # Google 有回傳 → 標為 ACTIVE
        await db.commit()
        await db.refresh(existing)
        return existing
    else:
        # 新增
        new_place = Place(
            place_id=uuid.uuid4(),
            google_place_id=detail.google_place_id,
            name=detail.name,
            address=detail.address,
            latitude=detail.latitude,
            longitude=detail.longitude,
            rating=detail.rating,
            google_maps_url=detail.google_maps_url,
            status=PlaceStatus.ACTIVE,
            last_updated=now,
        )
        db.add(new_place)
        await db.commit()
        await db.refresh(new_place)
        return new_place


def _is_uuid(value: str) -> bool:
    """判斷字串是否為 UUID 格式"""
    try:
        uuid.UUID(value)
        return True
    except ValueError:
        return False


async def _extract_place_id_from_url(url: str) -> Optional[str]:
    """
    從 Google Maps URL 解析 place_id。

    支援：
    - 長網址：https://www.google.com/maps/place/...  解析 place/ 後的名稱或 CID
    - 短網址：https://maps.app.goo.gl/xxx  先展開再解析
    - 含 place_id 參數：?place_id=ChIJ...
    """
    import re

    # 方法 1：URL 中直接帶 place_id 參數
    match = re.search(r"[?&]place_id=([\w-]+)", url)
    if match:
        return match.group(1)

    # 方法 2：短網址展開
    if "maps.app.goo.gl" in url or "goo.gl" in url:
        try:
            async with httpx.AsyncClient(
                follow_redirects=True, timeout=5.0
            ) as client:
                resp = await client.get(url)
                url = str(resp.url)  # 展開後的長網址
        except Exception:
            return None

    # 方法 3：從長網址解析 /maps/place/{name}/.../@...
    # 用 Autocomplete 以地名再搜一次取得 place_id
    match = re.search(r"/maps/place/([^/@?]+)", url)
    if match:
        place_name = match.group(1).replace("+", " ").replace("%20", " ")
        results = await google_places_service.autocomplete(place_name)
        if results:
            return results[0].place_id

    return None