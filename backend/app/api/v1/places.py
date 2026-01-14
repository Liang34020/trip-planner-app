from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.core.database import get_db
from app.models.place import Place
from app.schemas.place import PlaceResponse

router = APIRouter()


@router.get("/", response_model=List[PlaceResponse])
async def get_places(
    search: str = Query(None, description="搜尋關鍵字"),
    place_type: str = Query(None, description="地點類型篩選"),
    limit: int = Query(100, ge=1, le=500, description="返回數量"),
    db: AsyncSession = Depends(get_db)
):
    """
    獲取地點列表
    
    - 支援關鍵字搜尋（地點名稱）
    - 支援類型篩選（restaurant, attraction, hotel...）
    - 暫時返回所有地點（之後整合 Google Places API）
    """
    query = select(Place)
    
    # 關鍵字搜尋
    if search:
        query = query.where(Place.name.ilike(f"%{search}%"))
    
    # 類型篩選
    if place_type:
        query = query.where(Place.place_type == place_type)
    
    # 限制數量
    query = query.limit(limit)
    
    result = await db.execute(query)
    places = result.scalars().all()
    
    return places


@router.get("/{place_id}", response_model=PlaceResponse)
async def get_place(
    place_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    獲取單個地點詳情
    """
    result = await db.execute(
        select(Place).where(Place.place_id == place_id)
    )
    place = result.scalar_one_or_none()
    
    if not place:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="地點不存在"
        )
    
    return place