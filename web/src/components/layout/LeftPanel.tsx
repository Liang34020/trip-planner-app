import { useState, useRef, useEffect, useCallback } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useAppStore } from '../../store/appStore';
import { MapPin, Star, Search, Link, X, Loader2, AlertTriangle } from 'lucide-react';
import type { SavedPlace } from '../../types/models';
import {
  autocomplete,
  getPlaceDetail,
  importFromMapsUrl,
  type AutocompleteItem,
  type PlaceDetail,
} from '../../services/placeSearchService';
import { PlaceDetailModal } from '../search/PlaceDetailModal';

// ─────────────────────────────────────────────
// debounce hook
// ─────────────────────────────────────────────
function useDebounce<T extends (...args: Parameters<T>) => void>(fn: T, delay: number): T {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  return useCallback((...args: Parameters<T>) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fnRef.current(...args), delay);
  }, [delay]) as T;
}

// ─────────────────────────────────────────────
// LeftPanel
// ─────────────────────────────────────────────
export function LeftPanel() {
  const { savedPlaces, isLeftPanelCollapsed, toggleLeftPanel } = useAppStore();

  // 搜尋狀態
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<AutocompleteItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // 詳情彈窗狀態
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<PlaceDetail | null>(null);

  // 匯入連結狀態（預留功能）
  const [showImportInput, setShowImportInput] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState('');

  const searchRef = useRef<HTMLDivElement>(null);

  const sortedPlaces = [...savedPlaces].sort((a, b) => {
    if (a.is_placed === b.is_placed) return 0;
    return a.is_placed ? 1 : -1;
  });

  const { setNodeRef: setLeftPanelRef, isOver } = useDroppable({
    id: 'left-panel-droppable',
    data: { type: 'left-panel' },
  });

  // ─────────────────────────────────────────────
  // 搜尋邏輯
  // ─────────────────────────────────────────────
  const fetchPredictions = useCallback(async (q: string) => {
    if (!q.trim()) {
      setPredictions([]);
      setShowDropdown(false);
      return;
    }
    setIsSearching(true);
    try {
      const results = await autocomplete(q);
      setPredictions(results);
      setShowDropdown(results.length > 0);
    } catch {
      setPredictions([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const debouncedFetch = useDebounce(fetchPredictions, 300);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    debouncedFetch(val);
  };

  const handleClearSearch = () => {
    setQuery('');
    setPredictions([]);
    setShowDropdown(false);
  };

  // 點擊預測清單某筆 → 取得詳情
  const handleSelectPrediction = async (item: AutocompleteItem) => {
    setShowDropdown(false);
    setLoadingDetailId(item.place_id);
    try {
      const detail = await getPlaceDetail(item.place_id);
      setSelectedPlace(detail);
    } catch {
      // 靜默失敗
    } finally {
      setLoadingDetailId(null);
    }
  };

  // 點擊外部關閉下拉
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ─────────────────────────────────────────────
  // 匯入連結（預留功能）
  // ─────────────────────────────────────────────
  const handleImport = async () => {
    if (!importUrl.trim()) return;
    setIsImporting(true);
    setImportError('');
    try {
      const detail = await importFromMapsUrl(importUrl.trim());
      setSelectedPlace(detail);
      setImportUrl('');
      setShowImportInput(false);
    } catch {
      setImportError('無法解析此連結，請確認格式正確');
    } finally {
      setIsImporting(false);
    }
  };

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  return (
    <>
      <div
        ref={setLeftPanelRef}
        className={`
          flex-shrink-0 bg-white/80 backdrop-blur-sm shadow-lg flex flex-col overflow-hidden
          transition-all duration-300 ease-in-out
          ${isLeftPanelCollapsed ? 'w-0' : 'w-80'}
          ${isOver ? 'bg-blue-50/60' : ''}
        `}
      >
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
              <h2 className="text-2xl font-bold text-gradient mb-2">收藏池</h2>
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

          {/* 搜尋框 */}
          <div className="p-4 border-b border-gray-200 flex-shrink-0">
            <div ref={searchRef} className="relative">
              {/* 搜尋 input + 匯入按鈕 */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={query}
                    onChange={handleQueryChange}
                    onFocus={() => predictions.length > 0 && setShowDropdown(true)}
                    placeholder="搜尋景點..."
                    className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  {isSearching ? (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                  ) : query ? (
                    <button
                      onClick={handleClearSearch}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  ) : null}
                </div>

                {/* 匯入連結按鈕 */}
                <button
                  onClick={() => { setShowImportInput(v => !v); setImportError(''); }}
                  className={`flex-shrink-0 p-2 rounded-lg border transition-colors ${
                    showImportInput
                      ? 'border-primary-400 bg-primary-50 text-primary-600'
                      : 'border-gray-300 text-gray-400 hover:text-gray-600 hover:border-gray-400'
                  }`}
                  title="匯入 Google Maps 連結"
                >
                  <Link className="w-4 h-4" />
                </button>
              </div>

              {/* 匯入連結輸入框 */}
              {showImportInput && (
                <div className="mt-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={importUrl}
                      onChange={(e) => setImportUrl(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleImport()}
                      placeholder="貼上 Google Maps 連結..."
                      className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <button
                      onClick={handleImport}
                      disabled={isImporting || !importUrl.trim()}
                      className="px-3 py-1.5 text-sm bg-primary-600 hover:bg-primary-700 disabled:bg-primary-300 text-white rounded-lg transition-colors flex items-center gap-1"
                    >
                      {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '匯入'}
                    </button>
                  </div>
                  {importError && (
                    <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {importError}
                    </p>
                  )}
                </div>
              )}

              {/* Autocomplete 下拉清單 */}
              {showDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden">
                  {predictions.map((item) => (
                    <button
                      key={item.place_id}
                      onClick={() => handleSelectPrediction(item)}
                      disabled={loadingDetailId === item.place_id}
                      className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-100 last:border-0"
                    >
                      <MapPin className={`w-4 h-4 flex-shrink-0 mt-0.5 ${item.is_closed ? 'text-amber-400' : 'text-gray-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-800 truncate">
                            {item.display_name}
                          </span>
                          {item.is_closed && (
                            <span className="flex-shrink-0 text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                              可能歇業
                            </span>
                          )}
                          {loadingDetailId === item.place_id && (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">{item.secondary_text}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 收藏池清單 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
            {savedPlaces.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <p>收藏池是空的</p>
                <p className="text-sm mt-2">搜尋景點並加入收藏</p>
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

      {/* 景點詳情彈窗 */}
      {selectedPlace && (
        <PlaceDetailModal
          place={selectedPlace}
          onClose={() => setSelectedPlace(null)}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────
// SavedPlaceCard（原有，保持不變）
// ─────────────────────────────────────────────
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
      tourist_attraction: '景點',
      place_of_worship: '景點',
      park: '景點',
      restaurant: '美食',
      cafe: '美食',
      market: '美食',
      museum: '景點',
      shopping_mall: '景點',
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
            ${placeTypeLabel === '美食' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}
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