import { useDraggable } from '@dnd-kit/core';
import { useAppStore } from '../../store/appStore';
import { MapPin, Star } from 'lucide-react';
import type { SavedPlace } from '../../types/models';

export function LeftPanel() {
  const { savedPlaces, isLeftPanelCollapsed, toggleLeftPanel } = useAppStore();

  if (isLeftPanelCollapsed) {
    return (
      <button
        onClick={toggleLeftPanel}
        className="fixed left-0 top-1/2 -translate-y-1/2 bg-white shadow-lg rounded-r-lg p-2 z-50"
      >
        →
      </button>
    );
  }

  return (
    <div className="w-80 bg-white/80 backdrop-blur-sm shadow-lg flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-500" />
          收藏池
        </h2>
        <button
          onClick={toggleLeftPanel}
          className="text-gray-500 hover:text-gray-700"
        >
          ←
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
      <div className="flex-1 overflow-y-auto p-4 space-y-3 left-panel-scroll">
        {savedPlaces.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>收藏池是空的</p>
            <p className="text-sm mt-2">請先在 Swagger 加入地點</p>
          </div>
        ) : (
          savedPlaces.map((savedPlace) => (
            <SavedPlaceCard key={savedPlace.saved_id} savedPlace={savedPlace} />
          ))
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
    disabled: savedPlace.is_placed, // 已排入的不能拖曳
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`
        bg-white rounded-lg shadow-sm border-2 transition-all
        ${savedPlace.is_placed 
          ? 'border-gray-300 opacity-50 cursor-not-allowed' 
          : 'border-primary-200 hover:border-primary-400 cursor-move hover:shadow-md'
        }
        ${isDragging ? 'opacity-30 scale-95' : ''}
      `}
    >
      <div className="p-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-800 line-clamp-1">
              {savedPlace.place.name}
            </h3>
            <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
              <MapPin className="w-3 h-3" />
              <span className="line-clamp-1">{savedPlace.place.address}</span>
            </div>
          </div>
          {savedPlace.place.rating && (
            <div className="flex items-center gap-1 text-xs bg-yellow-50 px-2 py-1 rounded">
              <Star className="w-3 h-3 text-yellow-500 fill-current" />
              <span>{savedPlace.place.rating}</span>
            </div>
          )}
        </div>

        {savedPlace.is_placed && (
          <div className="mt-2 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
            ✓ 已排入行程
          </div>
        )}

        {savedPlace.notes && (
          <p className="text-xs text-gray-600 mt-2 line-clamp-2">
            {savedPlace.notes}
          </p>
        )}
      </div>
    </div>
  );
}