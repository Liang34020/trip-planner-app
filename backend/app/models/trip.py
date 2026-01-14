from sqlalchemy import Column, String, Integer, Boolean, Date, DateTime, ForeignKey, DECIMAL, Time
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class Trip(Base):
    """旅遊專案 Model"""
    __tablename__ = "trips"

    trip_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    trip_name = Column(String(255), nullable=False)
    destination = Column(String(100))
    start_date = Column(Date)
    end_date = Column(Date)
    timezone = Column(String(50), default="UTC")
    cover_image_url = Column(String)
    is_archived = Column(Boolean, default=False)
    version = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # 關聯
    days = relationship("ItineraryDay", back_populates="trip", lazy="joined", order_by="ItineraryDay.day_number")

    def __repr__(self):
        return f"<Trip {self.trip_name}>"


class ItineraryDay(Base):
    """每日行程 Model"""
    __tablename__ = "itinerary_days"

    day_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trip_id = Column(UUID(as_uuid=True), ForeignKey("trips.trip_id", ondelete="CASCADE"), nullable=False)
    day_number = Column(Integer, nullable=False)
    date = Column(Date)
    notes = Column(String)
    default_transport = Column(String(50), default="walk")

    # 關聯
    trip = relationship("Trip", back_populates="days")
    items = relationship("ItineraryItem", back_populates="day", lazy="joined", order_by="ItineraryItem.sequence")

    def __repr__(self):
        return f"<Day {self.day_number} of Trip {self.trip_id}>"


class ItineraryItem(Base):
    """行程景點 Model（使用 Fractional Indexing）"""
    __tablename__ = "itinerary_items"

    item_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    day_id = Column(UUID(as_uuid=True), ForeignKey("itinerary_days.day_id", ondelete="CASCADE"), nullable=False)
    place_id = Column(UUID(as_uuid=True), ForeignKey("places.place_id", ondelete="CASCADE"), nullable=False)
    sequence = Column(DECIMAL(20, 10), nullable=False)  # Fractional Indexing
    scheduled_time = Column(Time)
    duration_minutes = Column(Integer)
    notes = Column(String)
    transport_to_next = Column(String(50))  # walk, subway, taxi, drive
    transport_duration_minutes = Column(Integer)
    transport_cache_key = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # 關聯
    day = relationship("ItineraryDay", back_populates="items")
    place = relationship("Place", lazy="joined")

    def __repr__(self):
        return f"<Item {self.item_id} at Day {self.day_id}>"