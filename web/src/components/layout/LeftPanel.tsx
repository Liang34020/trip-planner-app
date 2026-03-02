import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useAppStore } from '../../store/appStore';
import { MapPin, Star } from 'lucide-react';
import type { SavedPlace } from '../../types/models';

export function LeftPanel() {
  const { savedPlaces, isLeftPanelCollapsed, toggleLeftPanel } = useAppStore();

  const sortedPlaces = [...savedPlaces].sort((a, b) => {
    if (a.is_placed === b.is_placed) return 0;
    return a.is_placed ? 1 : -1;
  });

  const { setNodeRef: setLeftPanelRef, isOver } = useDroppable({
    id: 'left-panel-droppable',
    data: { type: 'left-panel' },
  });

  return (
    // ✅ 動畫：w-80 ↔ w-0 滑入滑出，overflow-hidden 裁切內容
    <div
      ref={setLeftPanelRef}
      className={`
        flex-shrink-0 bg-white/80 backdrop-blur-sm shadow-lg flex flex-col overflow-hidden
        transition-all duration-300 ease-in-out
        ${isLeftPanelCollapsed ? 'w-0' : 'w-80'}
        ${isOver ? 'bg-blue-50/60' : ''}
      `}
    >
      {/* ✅ min-w 固定內容寬度，避免收起時文字被擠壓換行 */}
      {/* ✅ opacity 比寬度提前 150ms 淡出，視覺更乾淨 */}
      <div
        className={`
          flex flex-col flex-1 overflow-hidden min-w-[320px]
          transition-opacity duration-150
          ${isLeftPanelCollapsed ? 'opacity-0' : 'opacity-100'}
        `}
      >
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-sm border-b border-gray-100 p-4 flex-shrink-0 shadow-soft flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gradient mb-2">
              收藏池
            </h2>
            <p className="text-sm text-gray-600 transition-all duration-150">
              {isOver ? '放開以移回收藏池' : '拖曳地點到右側行程'}
            </p>
          </div>
          <button
            onClick={toggleLeftPanel}
            className="self-stretch flex items-center px-1 text-gray-400 hover:text-gray-600 transition-colors"
            title="收起收藏池"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-200">
          <input
            type="text"
            placeholder="搜尋地點..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Places List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
          {savedPlaces.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <p>收藏池是空的</p>
              <p className="text-sm mt-2">請先在 Swagger 加入地點</p>
            </div>
          ) : (
            <>
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
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h3 className="font-semibold text-gray-800 flex-shrink-0">
            {savedPlace.place.name}
          </h3>
          <span className={`
            text-xs px-2 py-0.5 rounded flex-shrink-0
            ${placeTypeLabel === '美食'
              ? 'bg-orange-100 text-orange-700'
              : 'bg-blue-100 text-blue-700'
            }
          `}>
            {placeTypeLabel}
          </span>
          {savedPlace.place.rating && (
            <div className="flex items-center gap-1 text-xs flex-shrink-0">
              <Star className="w-3 h-3 text-yellow-500 fill-current" />
              <span className="text-gray-700">{savedPlace.place.rating}</span>
            </div>
          )}
          {savedPlace.is_placed && (
            <div className="text-xs text-green-600 flex items-center gap-1 ml-auto flex-shrink-0">
              <span className="inline-block w-1.5 h-1.5 bg-green-600 rounded-full"></span>
              已排入行程
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          <span className="line-clamp-1">{savedPlace.place.address}</span>
        </div>
        {savedPlace.notes && (
          <p className="text-xs text-gray-500 italic mt-2 line-clamp-2">
            {savedPlace.notes}
          </p>
        )}
      </div>
    </div>
  );
}