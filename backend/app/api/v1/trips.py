from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.core.database import get_db
from app.models.user import User
from app.models.trip import Trip
from app.schemas.trip import TripListResponse, TripDetailResponse, TripCreate, TripUpdate
from app.api.deps import get_current_user

router = APIRouter()


@router.get("/", response_model=List[TripListResponse])
async def get_trips(
    include_archived: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    獲取當前用戶的所有行程
    
    - 預設不包含已封存的行程
    - 按建立時間倒序排列
    """
    query = select(Trip).where(Trip.user_id == current_user.user_id)
    
    if not include_archived:
        query = query.where(Trip.is_archived == False)
    
    query = query.order_by(Trip.created_at.desc())
    
    result = await db.execute(query)
    trips = result.unique().scalars().all()  # 加入 .unique()
    
    return trips


@router.get("/{trip_id}", response_model=TripDetailResponse)
async def get_trip(
    trip_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    獲取行程詳情
    
    - 包含所有 Days 和 Items
    - 景點按 sequence 排序
    - 檢查權限（只能查看自己的行程）
    """
    result = await db.execute(
        select(Trip).where(
            Trip.trip_id == trip_id,
            Trip.user_id == current_user.user_id
        )
    )
    trip = result.unique().scalar_one_or_none()  # 加入 .unique()
    
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="行程不存在"
        )
    
    return trip


@router.post("/", response_model=TripDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_trip(
    trip_data: TripCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    建立新行程
    
    - 建立行程基本資訊
    - 不包含 Days（需要另外新增）
    """
    new_trip = Trip(
        user_id=current_user.user_id,
        trip_name=trip_data.trip_name,
        destination=trip_data.destination,
        start_date=trip_data.start_date,
        end_date=trip_data.end_date,
        timezone=trip_data.timezone,
        cover_image_url=trip_data.cover_image_url,
    )
    
    db.add(new_trip)
    await db.commit()
    await db.refresh(new_trip)
    
    return new_trip


@router.patch("/{trip_id}", response_model=TripDetailResponse)
async def update_trip(
    trip_id: str,
    trip_data: TripUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    更新行程資訊
    
    - 只更新提供的欄位
    - 檢查權限
    """
    result = await db.execute(
        select(Trip).where(
            Trip.trip_id == trip_id,
            Trip.user_id == current_user.user_id
        )
    )
    trip = result.unique().scalar_one_or_none()  # 加入 .unique()
    
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="行程不存在"
        )
    
    # 更新欄位
    update_data = trip_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(trip, field, value)
    
    await db.commit()
    await db.refresh(trip)
    
    return trip


@router.delete("/{trip_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_trip(
    trip_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    刪除行程
    
    - 會連同所有 Days 和 Items 一起刪除（CASCADE）
    - 檢查權限
    """
    result = await db.execute(
        select(Trip).where(
            Trip.trip_id == trip_id,
            Trip.user_id == current_user.user_id
        )
    )
    trip = result.scalar_one_or_none()
    
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="行程不存在"
        )
    
    await db.delete(trip)
    await db.commit()
    
    return None