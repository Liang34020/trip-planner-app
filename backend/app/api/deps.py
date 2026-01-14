from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import decode_token, verify_token_type
from app.models.user import User

# HTTP Bearer Token 認證
security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    獲取當前登入用戶
    
    從 JWT Token 中解析用戶 ID，然後從資料庫查詢用戶
    """
    # 解碼 Token
    token = credentials.credentials
    payload = decode_token(token)
    
    # 驗證 Token 類型
    verify_token_type(payload, "access")
    
    # 獲取用戶 ID
    user_id: str = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無效的認證憑證",
        )
    
    # 從資料庫查詢用戶
    result = await db.execute(
        select(User).where(User.user_id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用戶不存在",
        )
    
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    獲取當前活躍用戶
    
    未來可以加入用戶狀態檢查（是否被禁用等）
    """
    # 這裡可以加入額外的檢查，例如：
    # if current_user.is_disabled:
    #     raise HTTPException(status_code=400, detail="用戶已被禁用")
    
    return current_user