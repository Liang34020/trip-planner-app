// web/src/components/layout/RightPanel.tsx
import { useEffect, useRef, useMemo, useCallback } from 'react';
import { Map, X, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import type { ItineraryDay, ItineraryItem } from '../../types/models';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ─────────────────────────────────────────────
// 常數
// ─────────────────────────────────────────────

const DAY_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
];

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';
const DEFAULT_CENTER: [number, number] = [35.6762, 139.6503];
const DEFAULT_ZOOM = 12;

// OSRM 公開路由服務（免費，無需 API Key）
const OSRM_BASE = 'https://router.project-osrm.org/route/v1';

// ─────────────────────────────────────────────
// 交通方式對應 OSRM profile
// ─────────────────────────────────────────────
type TransportMode = 'walk' | 'subway' | 'taxi' | 'drive' | 'bus' | undefined;

function getOsrmProfile(transport: TransportMode): 'foot' | 'driving' {
  if (transport === 'walk') return 'foot';
  return 'driving'; // subway / taxi / drive / bus → driving
}

// ─────────────────────────────────────────────
// OSRM 路由請求
// ─────────────────────────────────────────────
async function fetchRoute(
  from: [number, number],
  to: [number, number],
  profile: 'foot' | 'driving'
): Promise<[number, number][] | null> {
  try {
    // OSRM 格式：lng,lat（注意順序）
    const url = `${OSRM_BASE}/${profile}/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.code !== 'Ok' || !data.routes?.[0]) return null;
    // GeoJSON 座標是 [lng, lat]，轉成 Leaflet 用的 [lat, lng]
    return data.routes[0].geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
    );
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// 自訂 Marker 圖示
// ─────────────────────────────────────────────
function createMarkerIcon(color: string, label: string) {
  return L.divIcon({
    className: '',
    html: `
      <div style="
        background:${color};color:white;
        border-radius:50% 50% 50% 0;transform:rotate(-45deg);
        width:32px;height:32px;display:flex;align-items:center;justify-content:center;
        border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);
        font-size:11px;font-weight:700;font-family:system-ui;
      ">
        <span style="transform:rotate(45deg)">${label}</span>
      </div>`,
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
  const [isRoutingLoading, setIsRoutingLoading] = useState(false);

  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const polylinesRef = useRef<L.Polyline[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const currentTripDetail = useAppStore(state => state.currentTripDetail);

  const days: ItineraryDay[] = useMemo(
    () => currentTripDetail?.days ?? [],
    [currentTripDetail]
  );

  const allPoints = useMemo(() => {
    const pts: Array<{ item: ItineraryItem; dayIndex: number; itemIndex: number; lat: number; lng: number }> = [];
    days.forEach((day, di) => {
      day.items.forEach((item, ii) => {
        const lat = item.place.latitude;
        const lng = item.place.longitude;
        if (lat != null && lng != null)
          pts.push({ item, dayIndex: di, itemIndex: ii, lat: Number(lat), lng: Number(lng) });
      });
    });
    return pts;
  }, [days]);

  // ─────────────────────────────────────────────
  // 初始化地圖
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM,
      zoomControl: true, attributionControl: true,
    });
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // resize
  useEffect(() => {
    if (!mapRef.current) return;
    setTimeout(() => mapRef.current?.invalidateSize(), 300);
  }, [isOpen]);

  // ─────────────────────────────────────────────
  // 清除地圖層
  // ─────────────────────────────────────────────
  const clearLayers = useCallback(() => {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    polylinesRef.current.forEach(p => p.remove());
    polylinesRef.current = [];
  }, []);

  // ─────────────────────────────────────────────
  // 更新 Markers + OSRM 路徑
  // ─────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // 取消上一次未完成的路徑請求
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    clearLayers();
    if (allPoints.length === 0) return;

    // ── Step 1：先畫所有 Markers（立即顯示）──
    days.forEach((day, dayIndex) => {
      const color = DAY_COLORS[dayIndex % DAY_COLORS.length];
      day.items.forEach((item, itemIndex) => {
        const lat = item.place.latitude;
        const lng = item.place.longitude;
        if (lat == null || lng == null) return;

        const marker = L.marker([Number(lat), Number(lng)], {
          icon: createMarkerIcon(color, `${dayIndex + 1}-${itemIndex + 1}`),
        });

        marker.bindPopup(`
          <div style="font-family:system-ui;min-width:140px;">
            <div style="
              display:inline-block;background:${color};color:white;
              font-size:10px;font-weight:700;padding:2px 6px;
              border-radius:4px;margin-bottom:6px;
            ">Day ${dayIndex + 1}</div>
            <div style="font-weight:600;font-size:13px;color:#1f2937;margin-bottom:4px;">
              ${item.place.name}
            </div>
            ${item.place.address
              ? `<div style="font-size:11px;color:#6b7280;line-height:1.4;">${item.place.address}</div>`
              : ''}
            ${item.place.rating
              ? `<div style="font-size:11px;color:#f59e0b;margin-top:4px;">★ ${item.place.rating}</div>`
              : ''}
            ${item.transport_to_next
              ? `<div style="font-size:10px;color:#9ca3af;margin-top:4px;">→ ${TRANSPORT_LABEL[item.transport_to_next]}</div>`
              : ''}
          </div>
        `, { maxWidth: 220 });

        marker.addTo(map);
        markersRef.current.push(marker);
      });
    });

    // 自動縮放
    const bounds = L.latLngBounds(allPoints.map(p => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });

    // ── Step 2：非同步取得 OSRM 路徑 ──
    const signal = abortRef.current.signal;
    setIsRoutingLoading(true);

    const fetchAllRoutes = async () => {
      for (const [dayIndex, day] of days.entries()) {
        if (signal.aborted) break;

        const color = DAY_COLORS[dayIndex % DAY_COLORS.length];
        const validItems = day.items.filter(
          item => item.place.latitude != null && item.place.longitude != null
        );

        // 每兩個相鄰景點之間取得路徑
        for (let i = 0; i < validItems.length - 1; i++) {
          if (signal.aborted) break;

          const from = validItems[i];
          const to = validItems[i + 1];
          const profile = getOsrmProfile(from.transport_to_next);

          const coords = await fetchRoute(
            [Number(from.place.latitude), Number(from.place.longitude)],
            [Number(to.place.latitude), Number(to.place.longitude)],
            profile
          );

          if (signal.aborted) break;

          if (coords && coords.length > 1) {
            // OSRM 成功：畫實際道路
            const polyline = L.polyline(coords, {
              color,
              weight: 3,
              opacity: 0.8,
            }).addTo(map);
            polylinesRef.current.push(polyline);
          } else {
            // OSRM 失敗（離線/逾時）：fallback 直線虛線
            const fallback = L.polyline(
              [
                [Number(from.place.latitude), Number(from.place.longitude)],
                [Number(to.place.latitude), Number(to.place.longitude)],
              ],
              { color, weight: 2, opacity: 0.5, dashArray: '6, 6' }
            ).addTo(map);
            polylinesRef.current.push(fallback);
          }
        }
      }

      if (!signal.aborted) setIsRoutingLoading(false);
    };

    fetchAllRoutes();

    return () => { abortRef.current?.abort(); };
  }, [allPoints, days, clearLayers]);

  // ─────────────────────────────────────────────
  // Day 圖例
  // ─────────────────────────────────────────────
  const activeDays = days.filter(d =>
    d.items.some(i => i.place.latitude != null && i.place.longitude != null)
  );

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed bottom-4 right-4 z-40 p-4 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-full shadow-strong transition-all duration-300 hover:scale-110 active:scale-95"
        title="開啟地圖"
      >
        <Map className="w-6 h-6" />
      </button>

      <div className={`
        fixed lg:static top-0 right-0 bottom-0 z-30
        bg-gray-100 border-l border-gray-200
        transition-transform duration-300 ease-in-out
        flex flex-col
        lg:flex lg:h-screen lg:flex-shrink-0 lg:w-80 xl:w-96
        ${isOpen ? 'translate-x-0 w-full sm:w-96' : 'translate-x-full lg:translate-x-0'}
      `}>
        {/* 標題列 */}
        <div className="p-4 border-b border-gray-100 bg-white flex-shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Map className="w-4 h-4 text-primary-500" />
            <h3 className="font-bold text-gray-800">地圖預覽</h3>
            {allPoints.length > 0 && (
              <span className="text-xs text-gray-400">{allPoints.length} 個景點</span>
            )}
            {isRoutingLoading && (
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                路徑規劃中
              </div>
            )}
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-all"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 地圖容器 */}
        <div className="flex-1 relative overflow-hidden">
          <div ref={mapContainerRef} className="absolute inset-0" />

          {/* 空狀態 */}
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
              {activeDays.map((day) => {
                const realIndex = days.indexOf(day);
                const color = DAY_COLORS[realIndex % DAY_COLORS.length];
                return (
                  <div key={day.day_id} className="flex items-center gap-2">
                    <span className="inline-block w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="text-xs text-gray-600 font-medium">Day {realIndex + 1}</span>
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

      {isOpen && (
        <div className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-20" onClick={() => setIsOpen(false)} />
      )}
    </>
  );
}

// ─────────────────────────────────────────────
// 交通方式中文對照
// ─────────────────────────────────────────────
const TRANSPORT_LABEL: Record<string, string> = {
  walk: '步行',
  subway: '地鐵',
  taxi: '計程車',
  drive: '開車',
  bus: '公車',
};