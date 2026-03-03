"""
Google Places Service
封裝兩個 Google Places API 呼叫：
  1. Autocomplete  - 輕量，取得搜尋預測清單（含 place_id）
  2. Place Details - 中價位，取得景點完整資料（只在點擊時呼叫）
"""
import httpx
from typing import Optional
from pydantic import BaseModel
from decimal import Decimal

from app.core.config import settings


# ─────────────────────────────────────────────
# Response 資料結構
# ─────────────────────────────────────────────

class AutocompleteResult(BaseModel):
    """Autocomplete 預測清單的單筆結果"""
    place_id: str
    display_name: str       # 主要名稱，例如「淺草寺」
    secondary_text: str     # 副標題，例如「日本東京都台東區」


class PlaceDetail(BaseModel):
    """Place Details API 回傳的景點完整資料"""
    google_place_id: str
    name: str
    address: Optional[str] = None
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    rating: Optional[Decimal] = None
    google_maps_url: Optional[str] = None


# ─────────────────────────────────────────────
# Google Places Service
# ─────────────────────────────────────────────

class GooglePlacesService:

    BASE_URL = "https://places.googleapis.com/v1"
    AUTOCOMPLETE_URL = f"{BASE_URL}/places:autocomplete"
    DETAILS_URL = f"{BASE_URL}/places"

    def __init__(self):
        self.api_key = settings.GOOGLE_MAPS_API_KEY

    # ─────────────────────────────────────────────
    # Autocomplete
    # ─────────────────────────────────────────────

    async def autocomplete(self, query: str) -> list[AutocompleteResult]:
        """
        呼叫 Google Autocomplete API，取得搜尋預測清單。

        計費：Session-based（同一 session 多次呼叫只算一次）
        回傳：最多 5 筆預測，每筆含 place_id + 顯示文字
        """
        if not self.api_key:
            return []

        payload = {
            "input": query,
            "languageCode": "zh-TW",
        }
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": self.api_key,
        }

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(
                    self.AUTOCOMPLETE_URL,
                    json=payload,
                    headers=headers,
                )
                resp.raise_for_status()
                data = resp.json()
        except (httpx.HTTPError, Exception):
            return []

        results: list[AutocompleteResult] = []
        for suggestion in data.get("suggestions", []):
            place_prediction = suggestion.get("placePrediction", {})
            place_id = place_prediction.get("placeId", "")
            if not place_id:
                continue

            # 主要名稱
            structured = place_prediction.get("structuredFormat", {})
            main_text = structured.get("mainText", {}).get("text", "")
            secondary_text = structured.get("secondaryText", {}).get("text", "")

            if not main_text:
                main_text = place_prediction.get("text", {}).get("text", "")

            results.append(AutocompleteResult(
                place_id=place_id,
                display_name=main_text,
                secondary_text=secondary_text,
            ))

        return results

    # ─────────────────────────────────────────────
    # Place Details
    # ─────────────────────────────────────────────

    async def place_details(self, google_place_id: str) -> Optional[PlaceDetail]:
        """
        呼叫 Google Place Details API，取得景點完整資料。

        計費：每次呼叫 $0.017（Basic Data SKU）
        Field mask：只抓必要欄位，排除照片與評論以省錢
        """
        if not self.api_key:
            return None

        # Field mask：只抓需要的欄位
        field_mask = ",".join([
            "id",
            "displayName",
            "formattedAddress",
            "location",
            "rating",
            "googleMapsUri",
        ])
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": self.api_key,
            "X-Goog-FieldMask": field_mask,
        }

        url = f"{self.DETAILS_URL}/{google_place_id}"

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(url, headers=headers)
                resp.raise_for_status()
                data = resp.json()
        except (httpx.HTTPError, Exception):
            return None

        location = data.get("location", {})
        lat = location.get("latitude")
        lng = location.get("longitude")
        rating = data.get("rating")

        return PlaceDetail(
            google_place_id=data.get("id", google_place_id),
            name=data.get("displayName", {}).get("text", ""),
            address=data.get("formattedAddress"),
            latitude=Decimal(str(lat)) if lat is not None else None,
            longitude=Decimal(str(lng)) if lng is not None else None,
            rating=Decimal(str(rating)) if rating is not None else None,
            google_maps_url=data.get("googleMapsUri"),
        )


# 全域單例
google_places_service = GooglePlacesService()