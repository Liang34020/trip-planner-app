from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from typing import AsyncGenerator

# 從 config 導入設定
try:
    from app.core.config import settings
    DATABASE_URL = settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
except:
    # 如果 config 載入失敗，使用預設值
    DATABASE_URL = "postgresql+asyncpg://trip_admin:trip_password_2025@postgres:5432/trip_planner"

# 建立異步引擎
engine = create_async_engine(
    DATABASE_URL,
    echo=True,  # 開發模式顯示 SQL
    future=True,
    pool_size=10,
    max_overflow=20,
)

# 建立 Session Factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# 建立 Base Class
Base = declarative_base()


# 資料庫依賴注入
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """獲取資料庫 session"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()