from pydantic import BaseModel
from app.schemas.user import UserResponse


class Token(BaseModel):
    """JWT Token Schema"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Token 解析後的資料"""
    user_id: str


class LoginResponse(BaseModel):
    """登入回應 Schema"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class RefreshTokenRequest(BaseModel):
    """刷新 Token 請求"""
    refresh_token: str
    