from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update
from datetime import date, timedelta

from app.core.database import get_db
from app.models.user import User
from app.models.trip import Trip, ItineraryDay
from app.schemas.trip import ItineraryDayResponse
from app.api.deps import get_current_user

router = APIRouter()


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
        
        # 查詢所有後續的 Days
        later_days_result = await db.execute(
            select(ItineraryDay)
            .where(
                ItineraryDay.trip_id == trip_id,
                ItineraryDay.day_number > deleted_day_number
            )
            .order_by(ItineraryDay.day_number)
        )
        later_days = later_days_result.unique().scalars().all()
        
        # 🔧 解決方案：先將後續天數設為臨時負數，避免 unique constraint 衝突
        for i, later_day in enumerate(later_days):
            later_day.day_number = -(i + 1)  # 設為負數：-1, -2, -3...
        
        await db.flush()  # 執行臨時更新
        
        # 刪除目標 Day
        await db.execute(
            delete(ItineraryDay).where(ItineraryDay.day_id == day_id)
        )
        await db.flush()  # 執行刪除
        
        # 將後續天數調整回正確的值
        for i, later_day in enumerate(later_days):
            later_day.day_number = deleted_day_number + i  # 正確的新編號
            if later_day.date:
                later_day.date -= timedelta(days=1)
        
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