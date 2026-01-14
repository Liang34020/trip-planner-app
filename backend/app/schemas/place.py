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
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


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
    place: PlaceResponse  # 嵌套地點資訊
    
    model_config = ConfigDict(from_attributes=True)