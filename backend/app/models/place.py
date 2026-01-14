from sqlalchemy import Column, String, DECIMAL, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class Place(Base):
    """地點 Model（全局地點池）"""
    __tablename__ = "places"

    place_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    google_place_id = Column(String(255), unique=True)
    name = Column(String(255), nullable=False)
    address = Column(String)
    latitude = Column(DECIMAL(10, 8))
    longitude = Column(DECIMAL(11, 8))
    place_type = Column(String(50))  # restaurant, attraction, hotel...
    photo_url = Column(String)
    rating = Column(DECIMAL(2, 1))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<Place {self.name}>"