from pydantic import BaseModel, ConfigDict
# from datetime import datetime, date, time
from datetime import datetime, date as DateType, time
from typing import Optional, List
from uuid import UUID
from decimal import Decimal

from app.schemas.place import PlaceResponse


class ItineraryItemBase(BaseModel):
    """行程項目基礎 Schema"""
    scheduled_time: Optional[time] = None
    duration_minutes: Optional[int] = None
    notes: Optional[str] = None
    transport_to_next: Optional[str] = None
    transport_duration_minutes: Optional[int] = None


class ItineraryItemResponse(ItineraryItemBase):
    """行程項目回應 Schema"""
    item_id: UUID
    day_id: UUID
    place_id: UUID
    sequence: Decimal
    place: PlaceResponse  # 嵌套地點資訊
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class ItineraryDayBase(BaseModel):
    """行程日基礎 Schema"""
    day_number: int
    date: Optional[DateType] = None
    notes: Optional[str] = None
    default_transport: Optional[str] = "walk"


class ItineraryDayResponse(ItineraryDayBase):
    """行程日回應 Schema"""
    day_id: UUID
    trip_id: UUID
    items: List[ItineraryItemResponse] = []  # 嵌套行程項目

    date: DateType | None = None
    
    model_config = ConfigDict(from_attributes=True)



class TripBase(BaseModel):
    """行程基礎 Schema"""
    trip_name: str
    destination: Optional[str] = None
    start_date: Optional[DateType] = None
    end_date: Optional[DateType] = None
    timezone: str = "UTC"
    cover_image_url: Optional[str] = None


class TripCreate(TripBase):
    """建立行程 Schema"""
    pass


class TripUpdate(BaseModel):
    """更新行程 Schema"""
    trip_name: Optional[str] = None
    destination: Optional[str] = None
    start_date: Optional[DateType] = None
    end_date: Optional[DateType] = None
    timezone: Optional[str] = None
    cover_image_url: Optional[str] = None


class TripListResponse(TripBase):
    """行程列表回應 Schema（不含詳細資料）"""
    trip_id: UUID
    user_id: UUID
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class TripDetailResponse(TripListResponse):
    """行程詳情回應 Schema（含 Days 和 Items）"""
    days: List[ItineraryDayResponse] = []  # 嵌套每日行程
    
    model_config = ConfigDict(from_attributes=True)