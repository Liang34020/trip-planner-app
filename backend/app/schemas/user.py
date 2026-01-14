from pydantic import BaseModel, EmailStr, ConfigDict
from datetime import datetime
from typing import Optional
from uuid import UUID


class UserBase(BaseModel):
    """用戶基礎 Schema"""
    email: EmailStr
    display_name: Optional[str] = None


class UserCreate(UserBase):
    """用戶註冊 Schema"""
    password: str


class UserLogin(BaseModel):
    """用戶登入 Schema"""
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    """用戶更新 Schema"""
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None


class UserResponse(UserBase):
    """用戶回應 Schema"""
    user_id: UUID
    avatar_url: Optional[str] = None
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)