// web/src/components/layout/RightPanel.tsx
import { useEffect, useRef, useMemo } from 'react';
import { Map, X } from 'lucide-react';
import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import type { ItineraryDay, ItineraryItem } from '../../types/models';

// Leaflet 動態 import（避免 SSR 問題）
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ─────────────────────────────────────────────
// 常數
// ─────────────────────────────────────────────

// Day 顏色（最多支援 10 天）
const DAY_COLORS = [
  '#3B82F6', // Day 1 - 藍
  '#EF4444', // Day 2 - 紅
  '#10B981', // Day 3 - 綠
  '#F59E0B', // Day 4 - 橘
  '#8B5CF6', // Day 5 - 紫
  '#EC4899', // Day 6 - 粉
  '#14B8A6', // Day 7 - 青
  '#F97316', // Day 8 - 橙
  '#6366F1', // Day 9 - 靛
  '#84CC16', // Day 10 - 草綠
];

// 灰階圖磚（CartoDB Positron - 簡潔灰階，免費無 API Key）
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';

// 預設中心點（東京）
const DEFAULT_CENTER: [number, number] = [35.6762, 139.6503];
const DEFAULT_ZOOM = 12;

// ─────────────────────────────────────────────
// 建立自訂 Marker 圖示
// ─────────────────────────────────────────────
function createMarkerIcon(color: string, label: string) {
  return L.divIcon({
    className: '',
    html: `
      <div style="
        background: ${color};
        color: white;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        font-size: 11px;
        font-weight: 700;
        font-family: system-ui;
      ">
        <span style="transform: rotate(45deg)">${label}</span>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -34],
  });
}

// ─────────────────────────────────────────────
// 主元件
// ─────────────────────────────────────────────
export function RightPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const polylinesRef = useRef<L.Polyline[]>([]);

  const currentTripDetail = useAppStore(state => state.currentTripDetail);

  // 從 currentTripDetail 取出所有 days
  const days: ItineraryDay[] = useMemo(() => {
    return currentTripDetail?.days ?? [];
  }, [currentTripDetail]);

  // 所有有座標的景點（flat，帶 dayIndex）
  const allPoints = useMemo(() => {
    const points: Array<{
      item: ItineraryItem;
      dayIndex: number;
      itemIndex: number;
      lat: number;
      lng: number;
    }> = [];

    days.forEach((day, dayIndex) => {
      day.items.forEach((item, itemIndex) => {
        const lat = item.place.latitude;
        const lng = item.place.longitude;
        if (lat != null && lng != null) {
          points.push({ item, dayIndex, itemIndex, lat: Number(lat), lng: Number(lng) });
        }
      });
    });

    return points;
  }, [days]);

  // ─────────────────────────────────────────────
  // 初始化地圖（只執行一次）
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTRIBUTION,
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ─────────────────────────────────────────────
  // 地圖 resize（RightPanel 展開/收合時觸發）
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    setTimeout(() => mapRef.current?.invalidateSize(), 300);
  }, [isOpen]);

  // ─────────────────────────────────────────────
  // 更新 Markers + Polylines（行程資料變動時）
  // ─────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // 清除舊 Markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // 清除舊 Polylines
    polylinesRef.current.forEach(p => p.remove());
    polylinesRef.current = [];

    if (allPoints.length === 0) return;

    // 建立各 Day 的 Markers 與 Polylines
    days.forEach((day, dayIndex) => {
      const color = DAY_COLORS[dayIndex % DAY_COLORS.length];
      const dayPoints: [number, number][] = [];

      day.items.forEach((item, itemIndex) => {
        const lat = item.place.latitude;
        const lng = item.place.longitude;
        if (lat == null || lng == null) return;

        const latNum = Number(lat);
        const lngNum = Number(lng);
        dayPoints.push([latNum, lngNum]);

        // 建立 Marker
        const label = `${dayIndex + 1}-${itemIndex + 1}`;
        const marker = L.marker([latNum, lngNum], {
          icon: createMarkerIcon(color, label),
        });

        // Popup：景點名稱 + 地址
        marker.bindPopup(`
          <div style="font-family: system-ui; min-width: 140px;">
            <div style="
              display: inline-block;
              background: ${color};
              color: white;
              font-size: 10px;
              font-weight: 700;
              padding: 2px 6px;
              border-radius: 4px;
              margin-bottom: 6px;
            ">Day ${dayIndex + 1}</div>
            <div style="font-weight: 600; font-size: 13px; color: #1f2937; margin-bottom: 4px;">
              ${item.place.name}
            </div>
            ${item.place.address ? `
              <div style="font-size: 11px; color: #6b7280; line-height: 1.4;">
                ${item.place.address}
              </div>
            ` : ''}
            ${item.place.rating ? `
              <div style="font-size: 11px; color: #f59e0b; margin-top: 4px;">
                ★ ${item.place.rating}
              </div>
            ` : ''}
          </div>
        `, {
          maxWidth: 220,
          className: 'leaflet-popup-custom',
        });

        marker.addTo(map);
        markersRef.current.push(marker);
      });

      // 同一 Day 的景點連線
      if (dayPoints.length >= 2) {
        const polyline = L.polyline(dayPoints, {
          color,
          weight: 2.5,
          opacity: 0.7,
          dashArray: '6, 6',
        }).addTo(map);
        polylinesRef.current.push(polyline);
      }
    });

    // 自動縮放到包含所有景點
    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints.map(p => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [allPoints, days]);

  // ─────────────────────────────────────────────
  // Day 圖例（右下角）
  // ─────────────────────────────────────────────
  const activeDays = days.filter(d => d.items.some(
    i => i.place.latitude != null && i.place.longitude != null
  ));

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  return (
    <>
      {/* 小螢幕地圖開關按鈕 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed bottom-4 right-4 z-40 p-4 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-full shadow-strong hover:shadow-[0_20px_60px_-10px_rgba(59,130,246,0.5)] transition-all duration-300 hover:scale-110 active:scale-95"
        title="開啟地圖"
      >
        <Map className="w-6 h-6" />
      </button>

      {/* 地圖面板 */}
      <div
        className={`
          fixed lg:static
          top-0 right-0 bottom-0
          z-30
          bg-gray-100 border-l border-gray-200
          transition-transform duration-300 ease-in-out
          flex flex-col
          lg:flex lg:h-screen lg:flex-shrink-0 lg:w-80 xl:w-96
          ${isOpen ? 'translate-x-0 w-full sm:w-96' : 'translate-x-full lg:translate-x-0'}
        `}
      >
        {/* 標題列 */}
        <div className="p-4 border-b border-gray-100 bg-white flex-shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Map className="w-4 h-4 text-primary-500" />
            <h3 className="font-bold text-gray-800">地圖預覽</h3>
            {allPoints.length > 0 && (
              <span className="text-xs text-gray-400">{allPoints.length} 個景點</span>
            )}
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-all active:scale-95"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 地圖容器 */}
        <div className="flex-1 relative overflow-hidden">
          {/* Leaflet 掛載點 */}
          <div ref={mapContainerRef} className="absolute inset-0" />

          {/* 空狀態覆蓋層 */}
          {allPoints.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50/90 pointer-events-none">
              <div className="text-center">
                <Map className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">加入景點後地圖會自動顯示</p>
              </div>
            </div>
          )}

          {/* Day 圖例 */}
          {activeDays.length > 0 && (
            <div className="absolute bottom-4 left-3 z-[1000] bg-white/90 backdrop-blur-sm rounded-xl shadow-md px-3 py-2 flex flex-col gap-1.5">
              {activeDays.map((day, i) => {
                const realIndex = days.indexOf(day);
                const color = DAY_COLORS[realIndex % DAY_COLORS.length];
                return (
                  <div key={day.day_id} className="flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                      style={{ background: color }}
                    />
                    <span className="text-xs text-gray-600 font-medium">
                      Day {realIndex + 1}
                    </span>
                    <span className="text-xs text-gray-400">
                      {day.items.filter(i => i.place.latitude != null).length} 點
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 遮罩層（小螢幕） */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-20"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}