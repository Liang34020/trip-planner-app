// src/components/layout/LeftPanel.tsx

import { Search, MapPin, Star } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useAppStore } from '../../store/appStore';
import { getPlaceTypeLabel } from '../../types/models';
import type { SavedPlace } from '../../types/models';

export function LeftPanel() {
  const { savedPlaces, isLeftPanelCollapsed } = useAppStore();

  // 篩選未排入的地點
  const availablePlaces = savedPlaces.filter(sp => !sp.is_placed);
  const placedPlaces = savedPlaces.filter(sp => sp.is_placed);

  if (isLeftPanelCollapsed) return null;

  return (
    <div className="w-80 bg-white border-r border-gray-100 flex flex-col h-screen shadow-soft animate-slide-in-left">
      {/* 標題列 */}
      <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-primary-50 to-white">
        <h2 className="text-lg font-bold text-gradient">收藏池</h2>
        <p className="text-sm text-gray-600 mt-1">拖曳地點到右側行程</p>
      </div>

      {/* 搜尋列 */}
      <div className="p-4 border-b border-gray-100">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
          <input
            type="text"
            placeholder="搜尋地點..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* 地點列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* 可用地點 */}
        {availablePlaces.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              可用地點 ({availablePlaces.length})
            </h3>
            {availablePlaces.map(savedPlace => (
              <DraggablePlaceCard
                key={savedPlace.saved_id}
                savedPlace={savedPlace}
              />
            ))}
          </div>
        )}

        {/* 已排入地點 */}
        {placedPlaces.length > 0 && (
          <div className="mt-6">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              已排入行程 ({placedPlaces.length})
            </h3>
            {placedPlaces.map(savedPlace => (
              <PlaceCard
                key={savedPlace.saved_id}
                savedPlace={savedPlace}
                isPlaced
              />
            ))}
          </div>
        )}

        {savedPlaces.length === 0 && (
          <div className="empty-state animate-fade-in">
            <MapPin className="empty-state-icon" />
            <p className="empty-state-title">尚無收藏地點</p>
            <p className="empty-state-description">開始搜尋並加入喜歡的地點</p>
            <button className="btn btn-primary mt-2">
              + 新增地點
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 🆕 可拖曳的地點卡片
 */
function DraggablePlaceCard({ savedPlace }: { savedPlace: SavedPlace }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: savedPlace.saved_id,
      data: {
        type: 'place',
        savedPlace,
      },
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <PlaceCard savedPlace={savedPlace} isDraggable />
    </div>
  );
}

/**
 * 單一地點卡片
 */
function PlaceCard({
  savedPlace,
  isPlaced = false,
  isDraggable = false,
}: {
  savedPlace: SavedPlace;
  isPlaced?: boolean;
  isDraggable?: boolean;
}) {
  const { place } = savedPlace;

  return (
    <div
      className={`card mb-2 transition-all duration-300 ${
        isDraggable ? 'cursor-grab active:cursor-grabbing hover:shadow-medium hover:scale-[1.02] hover:-translate-y-1' : ''
      } ${isPlaced ? 'opacity-60 cursor-not-allowed grayscale' : ''}`}
    >

      {/* 圖片 */}
      {place.photo_url && (
        <img
          src={place.photo_url}
          alt={place.name}
          className="w-full h-32 object-cover rounded-t-lg -mt-4 -mx-4 mb-3"
        />
      )}

      {/* 名稱與評分 */}
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-gray-900 text-sm flex-1">
          {place.name}
        </h4>
        {place.rating && (
          <div className="flex items-center gap-1 text-xs text-yellow-600 ml-2">
            <Star className="w-3 h-3 fill-current" />
            <span>{place.rating}</span>
          </div>
        )}
      </div>

      {/* 類型標籤 */}
      {place.place_type && (
        <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
          {getPlaceTypeLabel(place.place_type)}
        </span>
      )}

      {/* 地址 */}
      {place.address && (
        <p className="text-xs text-gray-500 mt-2 line-clamp-1">
          {place.address}
        </p>
      )}

      {/* 標籤 */}
      {savedPlace.tags && savedPlace.tags.length > 0 && (
        <div className="flex gap-1 mt-2">
          {savedPlace.tags.map((tag: string) => (
            <span
              key={tag}
              className="px-2 py-0.5 bg-primary-50 text-primary-600 text-xs rounded"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* 已排入提示 */}
      {isPlaced && (
        <div className="mt-2 flex items-center gap-1 text-xs text-success-600 font-medium animate-fade-in">
          <span className="w-1.5 h-1.5 bg-success-500 rounded-full"></span>
          已排入行程
        </div>
      )}
    </div>
  );
}