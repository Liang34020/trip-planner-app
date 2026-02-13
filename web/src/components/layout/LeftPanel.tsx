import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useAppStore } from '../../store/appStore';
import { MapPin, Star } from 'lucide-react';
import type { SavedPlace } from '../../types/models';

export function LeftPanel() {
  const { savedPlaces, isLeftPanelCollapsed, toggleLeftPanel } = useAppStore();

  // ✅ 排序：未排入的在前，已排入的在後
  const sortedPlaces = [...savedPlaces].sort((a, b) => {
    if (a.is_placed === b.is_placed) return 0;
    return a.is_placed ? 1 : -1;
  });

  // ✅ 新增：讓收藏池可以接收拖曳回來的景點
  const { setNodeRef: setLeftPanelRef } = useDroppable({
    id: 'left-panel-droppable',
    data: {
      type: 'left-panel',
    },
  });

  if (isLeftPanelCollapsed) {
    return (
      <button
        onClick={toggleLeftPanel}
        className="fixed left-0 top-1/2 -translate-y-1/2 bg-white shadow-lg rounded-r-lg p-3 z-50 hover:bg-gray-50 transition-colors"
        title="展開收藏池"
      >
        <svg 
          className="w-4 h-4 text-gray-600" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    );
  }

  return (
    <div 
      ref={setLeftPanelRef}
      className="w-80 bg-white/80 backdrop-blur-sm shadow-lg flex flex-col overflow-hidden"
    >
      {/* ✅ Header - 移除星星圖示 */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-100 p-4 flex-shrink-0 shadow-soft">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold text-gradient">
            收藏池
          </h2>
          <button
            onClick={toggleLeftPanel}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            title="收起收藏池"
          >
            <svg 
              className="w-5 h-5" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
        <p className="text-sm text-gray-600">拖曳地點到右側行程</p>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-gray-200">
        <input
          type="text"
          placeholder="搜尋地點..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* ✅ Places List - 使用排序後的陣列，加入 scrollbar-hide */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
        {savedPlaces.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>收藏池是空的</p>
            <p className="text-sm mt-2">請先在 Swagger 加入地點</p>
          </div>
        ) : (
          <>
            {/* ✅ 可用地點區域 */}
            {sortedPlaces.filter(p => !p.is_placed).length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 mb-2">
                  可用地點 ({sortedPlaces.filter(p => !p.is_placed).length})
                </h3>
                {sortedPlaces
                  .filter(p => !p.is_placed)
                  .map((savedPlace) => (
                    <SavedPlaceCard key={savedPlace.saved_id} savedPlace={savedPlace} />
                  ))}
              </div>
            )}

            {/* ✅ 已排入區域 */}
            {sortedPlaces.filter(p => p.is_placed).length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs font-semibold text-gray-500 mb-2">
                  已排入行程 ({sortedPlaces.filter(p => p.is_placed).length})
                </h3>
                {sortedPlaces
                  .filter(p => p.is_placed)
                  .map((savedPlace) => (
                    <SavedPlaceCard key={savedPlace.saved_id} savedPlace={savedPlace} />
                  ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SavedPlaceCard({ savedPlace }: { savedPlace: SavedPlace }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: savedPlace.saved_id,
    data: {
      type: 'saved-place',
      placeId: savedPlace.place_id,
      savedPlace: savedPlace,
    },
    disabled: savedPlace.is_placed,
  });

  // ✅ 地點類型映射
  const getPlaceTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      'tourist_attraction': '景點',
      'place_of_worship': '景點',
      'park': '景點',
      'restaurant': '美食',
      'cafe': '美食',
      'market': '美食',
      'museum': '景點',
      'shopping_mall': '景點',
    };
    return typeMap[type] || '景點';
  };

  const placeTypeLabel = getPlaceTypeLabel(savedPlace.place.place_type || '');

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`
        bg-white rounded-lg shadow-sm border transition-all mb-3
        ${savedPlace.is_placed 
          ? 'border-gray-200 opacity-60 cursor-not-allowed grayscale' 
          : 'border-primary-200 hover:border-primary-400 cursor-move hover:shadow-md'
        }
        ${isDragging ? 'opacity-30 scale-95' : ''}
      `}
    >
      <div className="p-3">
        {/* ✅ 第一行：地點名稱 + 地點類型 + 評分 + 已排入狀態 */}
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h3 className="font-semibold text-gray-800 flex-shrink-0">
            {savedPlace.place.name}
          </h3>
          
          {/* 地點類型標籤 */}
          <span className={`
            text-xs px-2 py-0.5 rounded flex-shrink-0
            ${placeTypeLabel === '美食' 
              ? 'bg-orange-100 text-orange-700' 
              : 'bg-blue-100 text-blue-700'
            }
          `}>
            {placeTypeLabel}
          </span>

          {/* 評分 */}
          {savedPlace.place.rating && (
            <div className="flex items-center gap-1 text-xs flex-shrink-0">
              <Star className="w-3 h-3 text-yellow-500 fill-current" />
              <span className="text-gray-700">{savedPlace.place.rating}</span>
            </div>
          )}
          
          {/* 已排入徽章 */}
          {savedPlace.is_placed && (
            <div className="text-xs text-green-600 flex items-center gap-1 ml-auto flex-shrink-0">
              <span className="inline-block w-1.5 h-1.5 bg-green-600 rounded-full"></span>
              已排入行程
            </div>
          )}
        </div>

        {/* ✅ 第二行：地址 */}
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          <span className="line-clamp-1">{savedPlace.place.address}</span>
        </div>

        {/* 備註 */}
        {savedPlace.notes && (
          <p className="text-xs text-gray-500 italic mt-2 line-clamp-2">
            {savedPlace.notes}
          </p>
        )}
      </div>
    </div>
  );
}