from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.core.database import get_db
from app.models.user import User
from app.models.saved_place import SavedPlace
from app.models.place import Place
from app.schemas.place import SavedPlaceResponse, SavedPlaceCreate
from app.api.deps import get_current_user

router = APIRouter()


@router.get("/", response_model=List[SavedPlaceResponse])
async def get_saved_places(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    獲取當前用戶的收藏池
    
    - 返回所有收藏的地點
    - 包含 is_placed 狀態（是否已排入行程）
    """
    result = await db.execute(
        select(SavedPlace)
        .where(SavedPlace.user_id == current_user.user_id)
        .order_by(SavedPlace.saved_at.desc())
    )
    saved_places = result.unique().scalars().all()  # 加入 .unique()
    
    return saved_places


@router.post("/", response_model=SavedPlaceResponse, status_code=status.HTTP_201_CREATED)
async def add_saved_place(
    saved_place_data: SavedPlaceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    加入地點到收藏池
    
    - 檢查地點是否存在
    - 檢查是否已收藏
    - 建立收藏記錄
    """
    # 檢查地點是否存在
    place_result = await db.execute(
        select(Place).where(Place.place_id == saved_place_data.place_id)
    )
    place = place_result.scalar_one_or_none()
    
    if not place:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="地點不存在"
        )
    
    # 檢查是否已收藏
    existing_result = await db.execute(
        select(SavedPlace).where(
            SavedPlace.user_id == current_user.user_id,
            SavedPlace.place_id == saved_place_data.place_id
        )
    )
    existing = existing_result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="此地點已在收藏池中"
        )
    
    # 建立收藏記錄
    new_saved_place = SavedPlace(
        user_id=current_user.user_id,
        place_id=saved_place_data.place_id,
        notes=saved_place_data.notes,
        tags=saved_place_data.tags,
    )
    
    db.add(new_saved_place)
    await db.commit()
    await db.refresh(new_saved_place)
    
    return new_saved_place


@router.delete("/{saved_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_saved_place(
    saved_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    從收藏池移除地點
    
    - 檢查權限（只能刪除自己的收藏）
    - 刪除收藏記錄
    """
    result = await db.execute(
        select(SavedPlace).where(
            SavedPlace.saved_id == saved_id,
            SavedPlace.user_id == current_user.user_id
        )
    )
    saved_place = result.scalar_one_or_none()
    
    if not saved_place:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="收藏記錄不存在"
        )
    
    await db.delete(saved_place)
    await db.commit()
    
    return None