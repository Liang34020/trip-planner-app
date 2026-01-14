from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, ARRAY
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class SavedPlace(Base):
    """用戶收藏地點 Model（收藏池）"""
    __tablename__ = "user_saved_places"

    saved_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    place_id = Column(UUID(as_uuid=True), ForeignKey("places.place_id", ondelete="CASCADE"), nullable=False)
    notes = Column(String)
    tags = Column(ARRAY(String))
    is_placed = Column(Boolean, default=False)  # 是否已排入行程
    current_itinerary_item_id = Column(UUID(as_uuid=True))  # 關聯的行程項目 ID
    saved_at = Column(DateTime(timezone=True), server_default=func.now())

    # 關聯
    place = relationship("Place", lazy="joined")

    def __repr__(self):
        return f"<SavedPlace user={self.user_id} place={self.place_id}>"