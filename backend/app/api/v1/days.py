from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update
from datetime import date, timedelta
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.models.user import User
from app.models.trip import Trip, ItineraryDay, ItineraryItem
from app.models.saved_place import SavedPlace
from app.schemas.trip import ItineraryDayResponse
from app.api.deps import get_current_user
from app.services.itinerary_service import ItineraryService

router = APIRouter()


class UpdateDayRequest(BaseModel):
    """更新 Day 的請求"""
    notes: Optional[str] = None
    default_transport: Optional[str] = None


@router.post("/trips/{trip_id}/days", response_model=ItineraryDayResponse, status_code=status.HTTP_201_CREATED)
async def add_day(
    trip_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    新增一天到行程
    
    - 自動計算 day_number（最後一天 + 1）
    - 根據 start_date 自動計算日期
    - 檢查權限
    """
    # 查詢行程
    trip_result = await db.execute(
        select(Trip).where(
            Trip.trip_id == trip_id,
            Trip.user_id == current_user.user_id
        )
    )
    trip = trip_result.unique().scalar_one_or_none()
    
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="行程不存在"
        )
    
    # 查詢最後一天
    days_result = await db.execute(
        select(ItineraryDay)
        .where(ItineraryDay.trip_id == trip_id)
        .order_by(ItineraryDay.day_number.desc())
    )
    last_day = days_result.scalars().first()
    
    # 計算新的 day_number
    new_day_number = 1 if not last_day else last_day.day_number + 1
    
    # 計算日期
    new_date = None
    if trip.start_date:
        new_date = trip.start_date + timedelta(days=new_day_number - 1)
    
    # 建立新的 Day
    new_day = ItineraryDay(
        trip_id=trip_id,
        day_number=new_day_number,
        date=new_date,
    )
    
    db.add(new_day)
    await db.commit()
    await db.refresh(new_day)
    
    return new_day


@router.patch("/days/{day_id}", response_model=ItineraryDayResponse)
async def update_day(
    day_id: str,
    update_data: UpdateDayRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    更新 Day 資訊
    
    - 更新備註
    - 更新預設交通方式
    - 檢查權限
    """
    try:
        # 查詢 Day
        day_result = await db.execute(
            select(ItineraryDay).where(ItineraryDay.day_id == day_id)
        )
        day = day_result.unique().scalar_one_or_none()
        
        if not day:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Day 不存在"
            )
        
        # 檢查權限
        trip_result = await db.execute(
            select(Trip).where(
                Trip.trip_id == day.trip_id,
                Trip.user_id == current_user.user_id
            )
        )
        trip = trip_result.unique().scalar_one_or_none()
        
        if not trip:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="無權限操作"
            )
        
        # 更新欄位
        if update_data.notes is not None:
            day.notes = update_data.notes
        if update_data.default_transport is not None:
            day.default_transport = update_data.default_transport
        
        await db.commit()
        await db.refresh(day)
        
        return day
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        print(f"❌ 更新 Day 失敗: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新 Day 失敗: {str(e)}"
        )


@router.delete("/days/{day_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_day(
    day_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    刪除一天
    
    - 會連同所有 Items 一起刪除（CASCADE）
    - 自動重新編號後續的 Day
    - 檢查權限
    """
    try:
        # 查詢 Day
        day_result = await db.execute(
            select(ItineraryDay).where(ItineraryDay.day_id == day_id)
        )
        day = day_result.unique().scalar_one_or_none()
        
        if not day:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Day 不存在"
            )
        
        # 檢查權限
        trip_result = await db.execute(
            select(Trip).where(
                Trip.trip_id == day.trip_id,
                Trip.user_id == current_user.user_id
            )
        )
        trip = trip_result.unique().scalar_one_or_none()
        
        if not trip:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="無權限操作"
            )
        
        deleted_day_number = day.day_number
        trip_id = day.trip_id
        
        # ✅ 修復：先查詢並手動刪除所有 Items（這樣會更新 saved_places）
        items_result = await db.execute(
            select(ItineraryItem).where(ItineraryItem.day_id == day_id)
        )
        items = items_result.scalars().all()
        
        # 使用 ItineraryService 逐一刪除 Items（會觸發收藏池更新）
        service = ItineraryService(db)
        for item in items:
            await service.delete_item(str(item.item_id), current_user.user_id)
        
        # ✅ 解決方案：先將後續的 Days 臨時設為很大的數字，避免 unique constraint 衝突
        # Step 1: 查詢所有後續的 Days
        later_days_result = await db.execute(
            select(ItineraryDay)
            .where(
                ItineraryDay.trip_id == trip_id,
                ItineraryDay.day_number > deleted_day_number
            )
            .order_by(ItineraryDay.day_number)
        )
        later_days = later_days_result.unique().scalars().all()
        
        # Step 2: 先將後續 Days 的 day_number 設為臨時值（加 1000），避免衝突
        for idx, later_day in enumerate(later_days):
            later_day.day_number = 1000 + idx
        
        await db.flush()  # 立即執行，避免 unique constraint 錯誤
        
        # Step 3: 刪除目標 Day
        await db.execute(
            delete(ItineraryDay).where(ItineraryDay.day_id == day_id)
        )
        
        await db.flush()  # 立即執行刪除
        
        # Step 4: 將後續 Days 設為正確的 day_number
        for idx, later_day in enumerate(later_days):
            later_day.day_number = deleted_day_number + idx
            if later_day.date and trip.start_date:
                later_day.date = trip.start_date + timedelta(days=deleted_day_number + idx - 1)
        
        await db.commit()
        
        return None
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        print(f"❌ 刪除 Day 失敗: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"刪除 Day 失敗: {str(e)}"
        )



class ReorderDayRequest(BaseModel):
    """拖曳 Day 排序的請求"""
    target_position: int  # 目標位置（0-based，在所有 Day 中的位置）


@router.patch("/days/{day_id}/reorder")
async def reorder_day(
    day_id: str,
    reorder_data: ReorderDayRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    拖曳重新排序 Day（整天移動）

    策略：直接重新分配所有 Day 的 day_number（1-based）
    - Day 數量通常 <= 14，批次更新成本極低
    - 比 Fractional Indexing 更直覺，day_number 永遠連續
    """
    try:
        service = ItineraryService(db)

        # 驗證權限（確認此 Day 屬於當前使用者）
        day = await service.verify_day_ownership(day_id, current_user.user_id)

        # 取得該行程的所有 Day，按 day_number 排序
        # ✅ 使用 unique() 避免 SQLAlchemy 2.0 的 relationship 重複問題
        result = await db.execute(
            select(ItineraryDay)
            .where(ItineraryDay.trip_id == day.trip_id)
            .order_by(ItineraryDay.day_number)
        )
        all_days = list(result.unique().scalars().all())

        # 從列表中移除要移動的 Day
        moving_day = next(d for d in all_days if str(d.day_id) == day_id)
        all_days.remove(moving_day)

        # 插入到目標位置
        target_pos = max(0, min(reorder_data.target_position, len(all_days)))
        all_days.insert(target_pos, moving_day)

        # ✅ 先設為臨時值（加 1000），避免更新過程中 unique constraint 衝突
        for i, d in enumerate(all_days):
            d.day_number = 1000 + i
        await db.flush()

        # 再設為正確值
        for i, d in enumerate(all_days):
            d.day_number = i + 1

        await db.commit()

        return {"success": True, "message": f"Day 已移動到第 {target_pos + 1} 天"}

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        print(f"❌ Day 重新排序失敗: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Day 重新排序失敗: {str(e)}"
        )