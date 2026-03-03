from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional, List
from uuid import UUID
from decimal import Decimal


class PlaceBase(BaseModel):
    """地點基礎 Schema"""
    name: str
    address: Optional[str] = None
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    place_type: Optional[str] = None
    photo_url: Optional[str] = None
    rating: Optional[Decimal] = None


class PlaceCreate(PlaceBase):
    """建立地點 Schema"""
    google_place_id: Optional[str] = None


class PlaceResponse(PlaceBase):
    """地點回應 Schema"""
    place_id: UUID
    google_place_id: Optional[str] = None
    # ✅ 新增欄位
    google_maps_url: Optional[str] = None
    status: Optional[str] = "ACTIVE"
    last_updated: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─────────────────────────────────────────────
# 搜尋功能專用 Schema
# ─────────────────────────────────────────────

class AutocompleteItem(BaseModel):
    """Autocomplete 預測清單單筆（回傳給前端）"""
    place_id: str               # Google place_id（點擊後用來查詳細）
    display_name: str           # 主要名稱
    secondary_text: str         # 副標題（城市/地區）
    is_closed: bool = False     # 是否為歇業警告景點
    warning: Optional[str] = None  # 歇業提示文字


class PlaceDetailResponse(PlaceBase):
    """景點詳情回應（點擊後顯示，決定是否加入收藏）"""
    place_id: UUID
    google_place_id: Optional[str] = None
    google_maps_url: Optional[str] = None
    status: Optional[str] = "ACTIVE"
    last_updated: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─────────────────────────────────────────────
# 收藏池 Schema（原有，保持不變）
# ─────────────────────────────────────────────

class SavedPlaceBase(BaseModel):
    """收藏地點基礎 Schema"""
    notes: Optional[str] = None
    tags: Optional[List[str]] = None


class SavedPlaceCreate(SavedPlaceBase):
    """建立收藏地點 Schema"""
    place_id: UUID


class SavedPlaceResponse(SavedPlaceBase):
    """收藏地點回應 Schema"""
    saved_id: UUID
    user_id: UUID
    place_id: UUID
    is_placed: bool
    current_itinerary_item_id: Optional[UUID] = None
    saved_at: datetime
    place: PlaceResponse

    model_config = ConfigDict(from_attributes=True)