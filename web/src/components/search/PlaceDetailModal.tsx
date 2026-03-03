/**
 * PlaceDetailModal
 * 點擊 Autocomplete 預測清單後顯示景點詳細資訊
 * 提供「加入收藏」按鈕
 */
import { useState } from 'react';
import { X, MapPin, Star, ExternalLink, Plus, Loader2, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { savedPlaceService } from '../../services/savedPlaceService';
import toast from 'react-hot-toast';
import type { PlaceDetail } from '../../services/placeSearchService';

interface PlaceDetailModalProps {
  place: PlaceDetail;
  onClose: () => void;
}

export function PlaceDetailModal({ place, onClose }: PlaceDetailModalProps) {
  const { savedPlaces, loadSavedPlaces } = useAppStore();
  const [isSaving, setIsSaving] = useState(false);

  // 是否已在收藏池
  const alreadySaved = savedPlaces.some(
    (sp) => sp.place_id === place.place_id || sp.place.google_place_id === place.google_place_id
  );

  const isClosed = place.status === 'CLOSED' || place.status === 'HIDDEN';

  const handleAddToSaved = async () => {
    if (alreadySaved || isSaving) return;
    setIsSaving(true);
    try {
      await savedPlaceService.createSavedPlace({ place_id: place.place_id });
      await loadSavedPlaces();
      toast.success('已加入收藏');
      onClose();
    } catch {
      toast.error('加入收藏失敗，請重試');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    // 遮罩
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between p-5 pb-3">
          <div className="flex-1 pr-3">
            <h2 className="text-lg font-bold text-gray-900 leading-tight">
              {place.name}
            </h2>
            {place.place_type && (
              <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                {PLACE_TYPE_MAP[place.place_type] ?? place.place_type}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 歇業警告 */}
        {isClosed && (
          <div className="mx-5 mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              提示：地圖資訊顯示此處可能已歇業，請出發前再次確認。
            </p>
          </div>
        )}

        {/* 資訊區 */}
        <div className="px-5 pb-4 space-y-2">
          {/* 評分 */}
          {place.rating && (
            <div className="flex items-center gap-1.5">
              <Star className="w-4 h-4 text-yellow-400 fill-current" />
              <span className="text-sm font-medium text-gray-700">{place.rating}</span>
              <span className="text-xs text-gray-400">/ 5</span>
            </div>
          )}

          {/* 地址 */}
          {place.address && (
            <div className="flex items-start gap-1.5">
              <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-gray-600 leading-snug">{place.address}</span>
            </div>
          )}

          {/* Google Maps 連結 */}
          {place.google_maps_url && (
            <a
              href={place.google_maps_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              在 Google Maps 查看
            </a>
          )}
        </div>

        {/* 操作區 */}
        <div className="px-5 pb-5">
          {alreadySaved ? (
            <div className="w-full py-2.5 text-center text-sm text-green-600 bg-green-50 rounded-xl border border-green-200">
              ✓ 已在收藏池
            </div>
          ) : (
            <button
              onClick={handleAddToSaved}
              disabled={isSaving}
              className="w-full py-2.5 flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-300 text-white text-sm font-medium rounded-xl transition-colors"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              加入收藏
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 地點類型中文對照
// ─────────────────────────────────────────────
const PLACE_TYPE_MAP: Record<string, string> = {
  restaurant: '餐廳',
  attraction: '景點',
  tourist_attraction: '景點',
  hotel: '住宿',
  cafe: '咖啡廳',
  shopping: '購物',
  shopping_mall: '購物',
  park: '公園',
  museum: '博物館',
  place_of_worship: '宗教景點',
};