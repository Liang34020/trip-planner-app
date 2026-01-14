from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status
from typing import Optional
from decimal import Decimal
from datetime import time

from app.models.trip import Trip, ItineraryDay, ItineraryItem
from app.models.saved_place import SavedPlace
from app.utils.fractional_indexing import calculate_new_sequence, get_sequence_for_position


class ItineraryService:
    """行程管理業務邏輯層"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def verify_day_ownership(self, day_id: str, user_id: str) -> ItineraryDay:
        """驗證 Day 是否屬於當前用戶"""
        result = await self.db.execute(
            select(ItineraryDay).where(ItineraryDay.day_id == day_id)
        )
        # day = result.scalar_one_or_none()
        day = result.unique().scalar_one_or_none()
        
        if not day:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Day 不存在"
            )
        
        # 檢查 Trip 的擁有者
        trip_result = await self.db.execute(
            select(Trip).where(
                Trip.trip_id == day.trip_id,
                Trip.user_id == user_id
            )
        )
        trip = trip_result.unique().scalar_one_or_none()  # 加入 .unique()
        
        if not trip:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="無權限操作"
            )
        
        return day
    
    async def verify_item_ownership(self, item_id: str, user_id: str) -> ItineraryItem:
        """驗證 Item 是否屬於當前用戶"""
        result = await self.db.execute(
            select(ItineraryItem).where(ItineraryItem.item_id == item_id)
        )
        item = result.scalar_one_or_none()
        
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="景點不存在"
            )
        
        # 透過 Day 檢查 Trip 的擁有者
        await self.verify_day_ownership(str(item.day_id), user_id)
        
        return item
    
    async def get_day_items(self, day_id: str) -> list[ItineraryItem]:
        """獲取 Day 的所有景點（按 sequence 排序）"""
        result = await self.db.execute(
            select(ItineraryItem)
            .where(ItineraryItem.day_id == day_id)
            .order_by(ItineraryItem.sequence)
        )
        return result.scalars().all()
    
    async def add_item_to_day(
        self,
        day_id: str,
        place_id: str,
        user_id: str,
        position: Optional[int] = None,
        scheduled_time: Optional[time] = None,
        duration_minutes: Optional[int] = None,
        notes: Optional[str] = None
    ) -> ItineraryItem:
        """
        加入景點到 Day
        
        使用 Fractional Indexing 計算 sequence
        """
        # 獲取當前所有景點
        items = await self.get_day_items(day_id)
        sequences = [item.sequence for item in items]
        
        # 計算新的 sequence
        if position is None:
            position = len(items)
        
        new_sequence = get_sequence_for_position(sequences, position)
        
        # 建立新景點
        new_item = ItineraryItem(
            day_id=day_id,
            place_id=place_id,
            sequence=new_sequence,
            scheduled_time=scheduled_time,
            duration_minutes=duration_minutes,
            notes=notes
        )
        
        self.db.add(new_item)
        await self.db.flush()  # 取得 item_id
        
        # 更新收藏池狀態
        await self._update_saved_place_status(
            user_id=user_id,
            place_id=place_id,
            is_placed=True,
            item_id=str(new_item.item_id)
        )
        
        await self.db.commit()
        await self.db.refresh(new_item)
        
        return new_item
    
    async def reorder_item(
        self,
        item_id: str,
        target_day_id: str,
        target_position: int
    ) -> ItineraryItem:
        """
        拖曳重新排序景點（核心功能）
        
        使用 Fractional Indexing，只需更新 1 筆資料
        """
        # 獲取要移動的景點
        item_result = await self.db.execute(
            select(ItineraryItem).where(ItineraryItem.item_id == item_id)
        )
        item = item_result.scalar_one()
        
        source_day_id = str(item.day_id)
        
        # 如果是同一天內移動
        if source_day_id == target_day_id:
            items = await self.get_day_items(target_day_id)
            
            # 移除當前項目來計算正確的 sequence
            current_index = next(i for i, x in enumerate(items) if str(x.item_id) == item_id)
            items.pop(current_index)
            
            # 調整目標位置（因為移除了一個項目）
            if target_position > current_index:
                target_position -= 1
        else:
            # 跨天移動
            items = await self.get_day_items(target_day_id)
        
        # 計算新的 sequence
        sequences = [x.sequence for x in items]
        new_sequence = get_sequence_for_position(sequences, target_position)
        
        # 更新景點
        item.day_id = target_day_id
        item.sequence = new_sequence
        
        # 如果跨天移動，清除交通方式
        if source_day_id != target_day_id:
            item.transport_to_next = None
            item.transport_duration_minutes = None
        
        await self.db.commit()
        await self.db.refresh(item)
        
        return item
    
    async def delete_item(self, item_id: str, user_id: str):
        """
        刪除景點
        
        - 更新收藏池狀態
        - 處理交通方式
        """
        # 獲取景點
        item_result = await self.db.execute(
            select(ItineraryItem).where(ItineraryItem.item_id == item_id)
        )
        item = item_result.scalar_one()
        
        place_id = str(item.place_id)
        
        # 更新收藏池狀態
        await self._update_saved_place_status(
            user_id=user_id,
            place_id=place_id,
            is_placed=False,
            item_id=None
        )
        
        # 刪除景點
        await self.db.delete(item)
        await self.db.commit()
    
    async def _update_saved_place_status(
        self,
        user_id: str,
        place_id: str,
        is_placed: bool,
        item_id: Optional[str]
    ):
        """更新收藏池狀態"""
        result = await self.db.execute(
            select(SavedPlace).where(
                SavedPlace.user_id == user_id,
                SavedPlace.place_id == place_id
            )
        )
        saved_place = result.scalar_one_or_none()
        
        if saved_place:
            saved_place.is_placed = is_placed
            saved_place.current_itinerary_item_id = item_id
            await self.db.flush()