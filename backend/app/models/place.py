from sqlalchemy import Column, String, DECIMAL, DateTime, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
import enum

from app.core.database import Base


class PlaceStatus(str, enum.Enum):
    """景點狀態"""
    ACTIVE = "ACTIVE"    # 正常營業
    CLOSED = "CLOSED"    # 已歇業（Google 地圖已無此點）
    HIDDEN = "HIDDEN"    # 隱藏（不顯示在搜尋結果，但保留歷史紀錄）


class Place(Base):
    """地點 Model（全局地點池）"""
    __tablename__ = "places"

    place_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    google_place_id = Column(String(255), unique=True, index=True)
    name = Column(String(255), nullable=False)
    address = Column(String)
    latitude = Column(DECIMAL(10, 8))
    longitude = Column(DECIMAL(11, 8))
    place_type = Column(String(50))  # restaurant, attraction, hotel...
    photo_url = Column(String)
    rating = Column(DECIMAL(2, 1))

    # ✅ 新增：Google Maps 官方連結
    google_maps_url = Column(String)

    # ✅ 新增：景點狀態（預設 ACTIVE）
    status = Column(
        SAEnum(PlaceStatus, name="place_status_enum", create_type=True),
        nullable=False,
        default=PlaceStatus.ACTIVE,
        server_default=PlaceStatus.ACTIVE.value,
    )

    # ✅ 新增：上次從 Google 同步的時間（None 代表從未同步，為手動建立的種子資料）
    last_updated = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<Place {self.name} [{self.status}]>"