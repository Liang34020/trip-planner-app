"""
測試資料初始化腳本
執行方式：python -m app.scripts.init_test_data
"""
import asyncio
from datetime import date, timedelta
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models.user import User
from app.models.place import Place
from app.models.trip import Trip, ItineraryDay
from app.models.saved_place import SavedPlace
from app.core.security import get_password_hash


async def init_test_data():
    """初始化測試資料"""
    
    # 建立資料庫連線
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        print("=" * 70)
        print("🚀 開始初始化測試資料...")
        print("=" * 70)
        
        # ==================== 1. 建立測試用戶 ====================
        print("\n📝 建立測試用戶...")
        
        test_user = User(
            email="demo@test.com",
            password_hash=get_password_hash("demo123456"),
            display_name="Demo User"
        )
        session.add(test_user)
        await session.flush()
        print(f"✅ 用戶建立成功: {test_user.email}")
        
        # ==================== 2. 建立測試地點 ====================
        print("\n📍 建立測試地點...")
        
        places_data = [
            {
                "google_place_id": "ChIJ3dS0xC6LGGAR8fqCHCgKb3U",
                "name": "東京鐵塔",
                "address": "日本東京都港區芝公園4-2-8",
                "latitude": 35.6586,
                "longitude": 139.7454,
                "place_type": "tourist_attraction",
                "rating": 4.5
            },
            {
                "google_place_id": "ChIJpd_tKoGOGGAR6fACYNL9UsE",
                "name": "淺草寺",
                "address": "日本東京都台東區淺草2-3-1",
                "latitude": 35.7148,
                "longitude": 139.7967,
                "place_type": "place_of_worship",
                "rating": 4.6
            },
            {
                "google_place_id": "ChIJp-kLRCKLGGARv0VGDVMx8ZY",
                "name": "明治神宮",
                "address": "日本東京都澀谷區代代木神園町1-1",
                "latitude": 35.6764,
                "longitude": 139.6993,
                "place_type": "place_of_worship",
                "rating": 4.7
            },
            {
                "google_place_id": "ChIJ5SZMmLWLGGAR5FJl5Kl-kzU",
                "name": "上野公園",
                "address": "日本東京都台東區上野公園",
                "latitude": 35.7153,
                "longitude": 139.7737,
                "place_type": "park",
                "rating": 4.4
            },
            {
                "google_place_id": "ChIJ3z1vDQSMGGARJWRvyZhHjBk",
                "name": "築地市場",
                "address": "日本東京都中央區築地5-2-1",
                "latitude": 35.6654,
                "longitude": 139.7707,
                "place_type": "market",
                "rating": 4.3
            },
            {
                "google_place_id": "ChIJp0xQxxyLGGARl9l7jw6FRo0",
                "name": "新宿御苑",
                "address": "日本東京都新宿區內藤町11",
                "latitude": 35.6852,
                "longitude": 139.7100,
                "place_type": "park",
                "rating": 4.6
            }
        ]
        
        places = []
        for place_data in places_data:
            place = Place(**place_data)
            session.add(place)
            places.append(place)
        
        await session.flush()
        print(f"✅ 建立 {len(places)} 個地點")
        for place in places:
            print(f"   - {place.name}")
        
        # ==================== 3. 建立測試行程 ====================
        print("\n🗺️  建立測試行程...")
        
        start_date = date(2026, 3, 15)
        end_date = date(2026, 3, 19)
        
        test_trip = Trip(
            user_id=test_user.user_id,
            trip_name="東京五日遊",
            destination="日本東京",
            start_date=start_date,
            end_date=end_date,
            description="春季東京自由行"
        )
        session.add(test_trip)
        await session.flush()
        print(f"✅ 行程建立成功: {test_trip.trip_name}")
        print(f"   日期: {test_trip.start_date} ~ {test_trip.end_date}")
        
        # ==================== 4. 建立 5 天 ====================
        print("\n📅 建立 Days...")
        
        num_days = (end_date - start_date).days + 1
        for day_num in range(1, num_days + 1):
            day = ItineraryDay(
                trip_id=test_trip.trip_id,
                day_number=day_num,
                date=start_date + timedelta(days=day_num - 1)
            )
            session.add(day)
        
        await session.flush()
        print(f"✅ 建立 {num_days} 天")
        
        # ==================== 5. 加入地點到收藏池 ====================
        print("\n⭐ 加入地點到收藏池...")
        
        for place in places:
            saved_place = SavedPlace(
                user_id=test_user.user_id,
                place_id=place.place_id,
                is_placed=False
            )
            session.add(saved_place)
        
        await session.flush()
        print(f"✅ 加入 {len(places)} 個地點到收藏池")
        
        # ==================== 6. 提交所有變更 ====================
        await session.commit()
        
        print("\n" + "=" * 70)
        print("✅ 測試資料初始化完成！")
        print("=" * 70)
        print("\n📋 測試帳號:")
        print(f"   Email: {test_user.email}")
        print(f"   Password: demo123456")
        print(f"\n🗺️  行程 ID: {test_trip.trip_id}")
        print(f"   請將此 ID 儲存到前端 localStorage:")
        print(f"   localStorage.setItem('current_trip_id', '{test_trip.trip_id}')")
        print("\n" + "=" * 70)


if __name__ == "__main__":
    asyncio.run(init_test_data())