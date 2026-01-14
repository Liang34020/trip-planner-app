from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import auth, places, saved_places, trips, days, items

# 建立 FastAPI 應用
app = FastAPI(
    title="Trip Planner API",
    description="旅遊規劃 App 後端 API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# CORS 設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 註冊所有路由
app.include_router(auth.router, prefix="/api/v1/auth", tags=["認證"])
app.include_router(places.router, prefix="/api/v1/places", tags=["地點"])
app.include_router(saved_places.router, prefix="/api/v1/saved-places", tags=["收藏池"])
app.include_router(trips.router, prefix="/api/v1/trips", tags=["行程"])
app.include_router(days.router, prefix="/api/v1", tags=["Days"])
app.include_router(items.router, prefix="/api/v1/items", tags=["景點操作"])

# 健康檢查端點
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "environment": "development",
        "version": "1.0.0"
    }

# 根路徑
@app.get("/")
async def root():
    return {
        "message": "🗺️ Trip Planner API",
        "docs": "/api/docs",
        "health": "/health",
        "endpoints": {
            "auth": "/api/v1/auth",
            "places": "/api/v1/places",
            "saved_places": "/api/v1/saved-places",
            "trips": "/api/v1/trips",
            "days": "/api/v1/trips/{trip_id}/days",
            "items": "/api/v1/items"
        }
    }

# 啟動事件
@app.on_event("startup")
async def startup_event():
    print("=" * 70)
    print("🚀 Trip Planner API 啟動成功！")
    print("=" * 70)
    print(f"📍 健康檢查: http://localhost:8000/health")
    print(f"📚 API 文檔: http://localhost:8000/api/docs")
    print("=" * 70)
    print("📋 可用的 API 端點:")
    print("   🔐 認證:")
    print("      POST /api/v1/auth/register")
    print("      POST /api/v1/auth/login")
    print("      GET  /api/v1/auth/me")
    print()
    print("   📍 地點:")
    print("      GET  /api/v1/places")
    print()
    print("   ⭐ 收藏池:")
    print("      GET  /api/v1/saved-places")
    print("      POST /api/v1/saved-places")
    print()
    print("   🗺️  行程:")
    print("      GET  /api/v1/trips")
    print("      POST /api/v1/trips")
    print()
    print("   📅 Days:")
    print("      POST /api/v1/trips/{trip_id}/days")
    print("      DEL  /api/v1/days/{day_id}")
    print()
    print("   🎯 景點操作 (拖曳排序):")
    print("      POST  /api/v1/items              - 加入景點")
    print("      PATCH /api/v1/items/{id}/reorder - 🔥 拖曳排序")
    print("      PATCH /api/v1/items/{id}         - 編輯景點")
    print("      DEL   /api/v1/items/{id}         - 刪除景點")
    print("=" * 70)