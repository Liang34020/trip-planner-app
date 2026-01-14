from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from typing import List
import json


class Settings(BaseSettings):
    """應用程式配置"""
    
    # 基本設定
    APP_NAME: str = "Trip Planner API"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    
    # 資料庫
    DATABASE_URL: str = "postgresql://trip_admin:trip_password_2025@postgres:5432/trip_planner"
    
    # Redis
    REDIS_URL: str = "redis://redis:6379/0"
    REDIS_CACHE_TTL: int = 86400
    
    # JWT 認證
    SECRET_KEY: str = "f66ea43e44cfa15784f703e52c6e5d1fe6f2f1300e8e7baa8235f34635a0bfe6"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Google Maps API
    GOOGLE_MAPS_API_KEY: str = ""
    
    # CORS (預設值)
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
    ]
    
    # 分頁設定
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100
    
    # Fractional Indexing
    SEQUENCE_PRECISION: int = 10
    SEQUENCE_REBALANCE_THRESHOLD: float = 0.000001
    
    # ✅ CORS_ORIGINS 驗證器（支援多種格式）
    @field_validator('CORS_ORIGINS', mode='before')
    @classmethod
    def parse_cors_origins(cls, v):
        """
        彈性處理 CORS_ORIGINS 的多種輸入格式：
        1. JSON 字串: '["http://localhost:3000"]'
        2. 逗號分隔: 'http://localhost:3000,http://localhost:5173'
        3. 列表: ["http://localhost:3000"]
        4. 空字串: '' (返回預設值)
        """
        # 如果是字串
        if isinstance(v, str):
            # 處理空字串
            if not v or v.strip() == '':
                return [
                    "http://localhost:5173",
                    "http://localhost:3000",
                ]
            
            # 嘗試解析 JSON
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return parsed
            except (json.JSONDecodeError, ValueError):
                pass
            
            # 當作逗號分隔字串處理
            origins = [origin.strip() for origin in v.split(',') if origin.strip()]
            if origins:
                return origins
        
        # 如果已經是列表
        if isinstance(v, list):
            return v
        
        # 其他情況返回預設值
        return [
            "http://localhost:5173",
            "http://localhost:3000",
        ]
    
    # Pydantic v2 設定
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding='utf-8',
        case_sensitive=True,
        extra="ignore"  # 忽略額外的環境變數
    )


# 建立全域設定實例
settings = Settings()


# ✅ 驗證設定（開發環境警告）
if settings.ENVIRONMENT == "production":
    if settings.SECRET_KEY == "f66ea43e44cfa15784f703e52c6e5d1fe6f2f1300e8e7baa8235f34635a0bfe6":
        raise ValueError("⚠️ 生產環境必須更換 SECRET_KEY！")
    if settings.DEBUG:
        raise ValueError("⚠️ 生產環境不能開啟 DEBUG 模式！")