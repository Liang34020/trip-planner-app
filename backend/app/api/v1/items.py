from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from decimal import Decimal
from datetime import time

from app.core.database import get_db
from app.models.user import User
from app.models.trip import Trip, ItineraryDay, ItineraryItem
from app.models.place import Place
from app.models.saved_place import SavedPlace
from app.schemas.trip import ItineraryItemResponse
from app.api.deps import get_current_user
from app.services.itinerary_service import ItineraryService

router = APIRouter()


class AddItemRequest(BaseModel):
    """加入景點到 Day 的請求"""
    day_id: str
    place_id: str
    position: Optional[int] = None  # 插入位置（0-based），None 表示插入到最後
    scheduled_time: Optional[time] = None
    duration_minutes: Optional[int] = None
    notes: Optional[str] = None


class ReorderItemRequest(BaseModel):
    """拖曳重新排序的請求"""
    target_day_id: str
    target_position: int  # 目標位置（0-based）
    client_timestamp: Optional[int] = None  # 客戶端時間戳（用於衝突檢測）


class UpdateItemRequest(BaseModel):
    """更新景點資訊的請求"""
    scheduled_time: Optional[time] = None
    duration_minutes: Optional[int] = None
    notes: Optional[str] = None
    transport_to_next: Optional[str] = None


@router.post("/", response_model=ItineraryItemResponse, status_code=status.HTTP_201_CREATED)
async def add_item_to_day(
    item_data: AddItemRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    從收藏池加入景點到 Day
    
    - 檢查 Day 是否屬於當前用戶
    - 檢查地點是否存在
    - 使用 Fractional Indexing 計算 sequence
    - 更新收藏池狀態（is_placed = True）
    """
    service = ItineraryService(db)
    
    # 驗證權限
    await service.verify_day_ownership(item_data.day_id, current_user.user_id)
    
    # 驗證地點存在
    place_result = await db.execute(
        select(Place).where(Place.place_id == item_data.place_id)
    )
    place = place_result.scalar_one_or_none()
    if not place:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="地點不存在"
        )
    
    # 加入景點
    new_item = await service.add_item_to_day(
        day_id=item_data.day_id,
        place_id=item_data.place_id,
        user_id=current_user.user_id,
        position=item_data.position,
        scheduled_time=item_data.scheduled_time,
        duration_minutes=item_data.duration_minutes,
        notes=item_data.notes
    )
    
    return new_item


@router.patch("/{item_id}/reorder", response_model=ItineraryItemResponse)
async def reorder_item(
    item_id: str,
    reorder_data: ReorderItemRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    拖曳重新排序景點（核心功能）
    
    支援：
    - 同一天內重新排序
    - 跨天移動景點
    - 使用 Fractional Indexing（只更新 1 筆資料）
    - 自動更新收藏池狀態
    - 交通方式處理
    """
    service = ItineraryService(db)
    
    # 驗證權限
    await service.verify_item_ownership(item_id, current_user.user_id)
    await service.verify_day_ownership(reorder_data.target_day_id, current_user.user_id)
    
    # 執行重新排序
    updated_item = await service.reorder_item(
        item_id=item_id,
        target_day_id=reorder_data.target_day_id,
        target_position=reorder_data.target_position
    )
    
    return updated_item


@router.patch("/{item_id}", response_model=ItineraryItemResponse)
async def update_item(
    item_id: str,
    update_data: UpdateItemRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    更新景點資訊
    
    - 更新時間、停留時間、備註
    - 更新到下一個景點的交通方式
    """
    service = ItineraryService(db)
    
    # 驗證權限
    item = await service.verify_item_ownership(item_id, current_user.user_id)
    
    # 更新欄位
    if update_data.scheduled_time is not None:
        item.scheduled_time = update_data.scheduled_time
    if update_data.duration_minutes is not None:
        item.duration_minutes = update_data.duration_minutes
    if update_data.notes is not None:
        item.notes = update_data.notes
    if update_data.transport_to_next is not None:
        item.transport_to_next = update_data.transport_to_next
    
    await db.commit()
    await db.refresh(item)
    
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(
    item_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    刪除景點
    
    - 景點從行程中移除
    - 更新收藏池狀態（is_placed = False）
    - 交通方式轉移給前一個景點
    """
    service = ItineraryService(db)
    
    # 驗證權限
    item = await service.verify_item_ownership(item_id, current_user.user_id)
    
    # 刪除景點
    await service.delete_item(item_id, current_user.user_id)
    
    return None