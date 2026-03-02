// src/components/layout/MiddlePanel.tsx

import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Calendar, Clock, MapPin, Trash2, Edit2, Plus, Copy, Trash, Navigation, GripVertical } from 'lucide-react';
import { useDroppable, useDraggable, useDndMonitor } from '@dnd-kit/core';
import { useAppStore } from '../../store/appStore';
import { getTransportLabel } from '../../types/models';
import type { ItineraryItem, ItineraryDay } from '../../types/models';
import { EditItemModal } from '../itinerary/EditItemModal';
import { EditDayModal } from '../itinerary/EditDayModal';
import { CopyItemModal } from '../itinerary/CopyItemModal';
import { EditTransportModal } from '../itinerary/EditTransportModal';
import { setGlobalInsertInfo, getGlobalMouseY, setGlobalDayInsertIndex } from './AppLayout';
import { getDroppedItemId, clearDroppedItemId, getFadingOutItemId, clearFadingOutItemId, consumePendingFlip, registerSnapshotCallback, unregisterSnapshotCallback } from '../../utils/animationState';

// ✅ 注入 dropIn keyframes（只執行一次）
if (typeof document !== 'undefined' && !document.getElementById('flip-keyframes')) {
  const style = document.createElement('style');
  style.id = 'flip-keyframes';
  style.textContent = `
    @keyframes dropIn {
      from { opacity: 0; transform: scale(0.97); }
      to   { opacity: 1; transform: scale(1); }
    }
    @keyframes fadeOut {
      from { opacity: 1; transform: scale(1); }
      to   { opacity: 0; transform: scale(0.97); }
    }
  `;
  document.head.appendChild(style);
}

// ─────────────────────────────────────────────
// useFlipChildren
// FLIP 動畫 hook：讓子元素在重新排序後有滑動動畫
// 使用方式：ref 掛在列表容器上，items 傳入目前的 key 陣列
// ─────────────────────────────────────────────

function useFlipChildren() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const prevRectsRef = useRef<Map<string, DOMRect>>(new Map());
  const excludeIdRef = useRef<string | null>(null);
  const shouldFlipRef = useRef(false); // ✅ 只有 snapshotRects 呼叫後的第一次 render 才 FLIP

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const children = container.querySelectorAll<HTMLElement>('[data-flip-id]');

    // ✅ 兩個觸發來源：
    // 1. snapshotRects 呼叫（reorder / 拖回收藏池）
    // 2. consumePendingFlip（addItemToDay）
    const shouldRun = shouldFlipRef.current || consumePendingFlip();

    if (shouldRun) {
      shouldFlipRef.current = false;

      const prevRects = prevRectsRef.current;
      const excludeId = excludeIdRef.current;

      children.forEach((el) => {
        const id = el.dataset.flipId!;
        if (id === excludeId) return;

        const prev = prevRects.get(id);
        if (!prev) return;

        const curr = el.getBoundingClientRect();
        const dy = prev.top - curr.top;
        if (Math.abs(dy) < 1) return;

        el.style.transition = 'none';
        el.style.transform = `translateY(${dy}px)`;

        requestAnimationFrame(() => {
          el.style.transition = 'transform 250ms cubic-bezier(0.25, 0.46, 0.45, 0.94)';
          el.style.transform = 'translateY(0)';
        });
      });

      excludeIdRef.current = null;
    }
    const newRects = new Map<string, DOMRect>();
    children.forEach((el) => {
      newRects.set(el.dataset.flipId!, el.getBoundingClientRect());
    });
    prevRectsRef.current = newRects;
  });  // ✅ 無依賴陣列：每次 render 後都執行，但只有 shouldFlipRef=true 時才播動畫

  const snapshotRects = useCallback((activeId: string | null) => {
    const container = containerRef.current;
    if (!container) return;
    excludeIdRef.current = activeId;
    shouldFlipRef.current = true; // ✅ 標記：下一次 render 要 FLIP
    const children = container.querySelectorAll<HTMLElement>('[data-flip-id]');
    const rects = new Map<string, DOMRect>();
    children.forEach((el) => {
      rects.set(el.dataset.flipId!, el.getBoundingClientRect());
    });
    prevRectsRef.current = rects;
  }, []);

  return { containerRef, snapshotRects };
}

// ─────────────────────────────────────────────
// MiddlePanel
// ─────────────────────────────────────────────

export function MiddlePanel() {
  const currentTrip = useAppStore(state => state.currentTrip);
  const itineraryDays = useAppStore(state => state.itineraryDays);
  const isLeftPanelCollapsed = useAppStore(state => state.isLeftPanelCollapsed);
  const toggleLeftPanel = useAppStore(state => state.toggleLeftPanel);

  const [editingItem, setEditingItem] = useState<ItineraryItem | null>(null);
  const [editingDay, setEditingDay] = useState<ItineraryDay | null>(null);
  const [copyingItem, setCopyingItem] = useState<ItineraryItem | null>(null);
  const [editingTransport, setEditingTransport] = useState<{
    itemId: string;
    currentMode?: string;
  } | null>(null);

  if (!currentTrip) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50">
        <div className="empty-state animate-scale-in">
          <Calendar className="empty-state-icon animate-pulse-soft" />
          <h3 className="empty-state-title">尚未選擇行程</h3>
          <p className="empty-state-description">建立或選擇一個旅遊專案開始規劃</p>
          <button className="btn btn-primary">+ 建立新行程</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-br from-gray-50 via-blue-50/20 to-gray-50 h-screen overflow-hidden">
      {/* 行程標題列 */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-100 pl-3 pr-4 py-4 flex-shrink-0 shadow-soft flex items-center gap-3">
        {/* 收藏池收起時顯示展開按鈕 */}
        {isLeftPanelCollapsed && (
          <button
            onClick={toggleLeftPanel}
            className="flex-shrink-0 -ml-1 mr-1 text-gray-400 hover:text-gray-600 transition-colors"
            title="展開收藏池"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
        <div>
          <h1 className="text-2xl font-bold text-gradient mb-2 animate-fade-in">
            {currentTrip.trip_name}
          </h1>
          <div className="flex items-center gap-3 text-sm text-gray-600 animate-fade-in animation-delay-100">
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-primary-500" />
              {currentTrip.destination}
            </span>
            <span className="text-gray-300">·</span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-primary-500" />
              {currentTrip.start_date} ~ {currentTrip.end_date}
            </span>
          </div>
        </div>
      </div>

      {/* 每日行程卡片 */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
        <DayReorderContainer
          days={itineraryDays}
          onEditItem={setEditingItem}
          onEditDay={setEditingDay}
          onCopyItem={setCopyingItem}
          onEditTransport={(itemId, currentMode) =>
            setEditingTransport({ itemId, currentMode })
          }
        />
      </div>

      {/* 彈窗 */}
      {editingItem && (
        <EditItemModal
          item={editingItem}
          isOpen={!!editingItem}
          onClose={() => setEditingItem(null)}
          onSave={(updates: Partial<ItineraryItem>) => {
            useAppStore.getState().updateItineraryItem(editingItem.item_id, updates);
            setEditingItem(null);
          }}
        />
      )}
      {editingDay && (
        <EditDayModal
          day={editingDay}
          isOpen={!!editingDay}
          onClose={() => setEditingDay(null)}
          onSave={(notes: string, defaultTransport?: ItineraryDay['default_transport']) => {
            useAppStore.getState().updateDayNotes(editingDay.day_id, notes);
            if (defaultTransport !== undefined) {
              useAppStore.getState().updateDayDefaultTransport(editingDay.day_id, defaultTransport);
            }
            setEditingDay(null);
          }}
        />
      )}
      {copyingItem && (
        <CopyItemModal
          item={copyingItem}
          allDays={itineraryDays}
          isOpen={!!copyingItem}
          onClose={() => setCopyingItem(null)}
          onCopy={(targetDayId: string) => {
            useAppStore.getState().copyItemToDay(copyingItem.item_id, targetDayId);
            setCopyingItem(null);
          }}
        />
      )}
      {editingTransport && (
        <EditTransportModal
          itemId={editingTransport.itemId}
          currentMode={editingTransport.currentMode}
          isOpen={!!editingTransport}
          onClose={() => setEditingTransport(null)}
          onSave={(mode: string) => {
            useAppStore.getState().updateItineraryItem(editingTransport.itemId, {
              transport_to_next: mode as ItineraryItem['transport_to_next'],
            });
            setEditingTransport(null);
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// DayColumn
// ─────────────────────────────────────────────

function DayColumn({
  day,
  onEditItem,
  onEditDay,
  onCopyItem,
  onEditTransport,
}: {
  day: any;
  onEditItem: (item: ItineraryItem) => void;
  onEditDay: (day: ItineraryDay) => void;
  onCopyItem: (item: ItineraryItem) => void;
  onEditTransport: (itemId: string, currentMode?: string) => void;
}) {
  const { removeDay, clearDay } = useAppStore();

  const [itemOverIndex, setItemOverIndex] = useState<number | null>(null);

  // 插入線座標（渲染到 body portal，完全脫離文件流）
  const [insertLineStyle, setInsertLineStyle] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  // Day 容器 ref（用來判斷滑鼠是否在此 Day 範圍內）
  const containerRef = useRef<HTMLDivElement | null>(null);

  // 每個景點卡片的 ref
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // 正在被拖曳的 item id
  const activeItemIdRef = useRef<string | null>(null);

  // ✅ FLIP 動畫：記錄拖曳結束前的位置，render 後計算位移播放動畫
  const { containerRef: flipContainerRef, snapshotRects } = useFlipChildren();

  // ✅ 註冊 snapshot callback，讓 AppLayout 可以直接呼叫
  useEffect(() => {
    registerSnapshotCallback(day.day_id, snapshotRects);
    return () => unregisterSnapshotCallback(day.day_id);
  }, [day.day_id, snapshotRects]);

  // 是否正在拖曳整天（拖 Day 時不顯示縱向插入線）
  const isDraggingDayRef = useRef(false);

  // 整合：Day 拖曳狀態 + FLIP snapshot
  useDndMonitor({
    onDragStart(event) {
      if (event.active.data.current?.type === 'day') {
        isDraggingDayRef.current = true;
      }
    },
    onDragEnd() {
      isDraggingDayRef.current = false;
      activeItemIdRef.current = null;
    },
    onDragCancel() {
      isDraggingDayRef.current = false;
      activeItemIdRef.current = null;
    },
  });

  // ✅ Day 本身的 draggable（手柄拖曳整天）
  const {
    attributes: dayDragAttributes,
    listeners: dayDragListeners,
    setNodeRef: setDayDragRef,
    isDragging: isDayDragging,
  } = useDraggable({
    id: day.day_id,
    data: { type: 'day', dayId: day.day_id, dayNumber: day.day_number },
  });

  // dnd-kit droppable（讓 AppLayout 的 handleDragEnd 能拿到 overData）
  const { setNodeRef, isOver } = useDroppable({
    id: `${day.day_id}-droppable`,
    data: {
      type: 'day-droppable',
      dayId: day.day_id,
      day,
    },
  });

  // 合併 droppable、draggable ref 和 containerRef
  const setRefs = (node: HTMLDivElement | null) => {
    setNodeRef(node);
    setDayDragRef(node);
    containerRef.current = node;
  };

  // ─────────────────────────────────────────────
  // RAF loop：持續判斷滑鼠是否在此 Day 容器內
  //
  // 為什麼不用 isOver：
  //   closestCenter 碰撞偵測在滑鼠移到景點卡片上時，
  //   可能把 over 指向景點元素而非 Day 容器，
  //   導致 isOver 為 false，RAF loop 停止，插入線消失。
  //
  // 解法：直接用 containerRef.getBoundingClientRect() 判斷
  //   滑鼠是否在 Day 容器範圍內，完全不依賴 dnd-kit 的 over 狀態。
  //
  // 為什麼插入線用 createPortal 到 body：
  //   DayColumn 有 overflow-hidden，fixed 子元素仍可能被裁切。
  //   Portal 到 body 才能確保線在任何層疊/裁切情境下都顯示。
  // ─────────────────────────────────────────────
  useEffect(() => {
    // 只有拖曳中才需要 loop（用 globalMouseY !== null 判斷）
    let rafId: number;

    const tick = () => {
      const mouseY = getGlobalMouseY();
      const container = containerRef.current;

      // 沒在拖曳、正在拖曳整天、或沒有景點 → 清除插入線
      if (mouseY === null || isDraggingDayRef.current || !container || day.items.length === 0) {
        setItemOverIndex(null);
        setInsertLineStyle(null);
        rafId = requestAnimationFrame(tick);
        return;
      }

      // 判斷滑鼠是否在此 Day 容器範圍內
      // ✅ 修復滾動問題：containerRect 的 top/bottom 可能超出視窗，
      //    用 clamp 到視窗邊界後再比對，確保滾動後判斷仍正確。
      const containerRect = container.getBoundingClientRect();
      const mouseX = getGlobalMouseX();
      const visibleTop = Math.max(containerRect.top, 0);
      const visibleBottom = Math.min(containerRect.bottom, window.innerHeight);
      const inContainer =
        mouseY >= visibleTop &&
        mouseY <= visibleBottom &&
        mouseX >= containerRect.left &&
        mouseX <= containerRect.right;

      if (!inContainer) {
        setItemOverIndex(null);
        setInsertLineStyle(null);
        rafId = requestAnimationFrame(tick);
        return;
      }

      // 收集景點 rect
      const points: {
        index: number;
        top: number;
        bottom: number;
        left: number;
        width: number;
        middle: number;
        distance: number;
        absDistance: number;
      }[] = [];

      // ✅ 截斷殘留 ref：跨天移動後 day.items 長度縮短，
      //    但 itemRefs.current 是 mutable ref 不會自動清除，
      //    多出的舊 ref 仍指向已卸載的 DOM，會導致 rect 計算錯誤。
      itemRefs.current.length = day.items.length;

      itemRefs.current.forEach((ref, index) => {
        if (!ref) return;
        const itemId = (day.items as ItineraryItem[])[index]?.item_id;
        if (itemId && itemId === activeItemIdRef.current) return; // 排除自身
        const rect = ref.getBoundingClientRect();
        if (rect.height === 0) return;
        const middle = rect.top + rect.height / 2;
        const distance = mouseY - middle;
        points.push({
          index,
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          width: rect.width,
          middle,
          distance,
          absDistance: Math.abs(distance),
        });
      });

      if (points.length === 0) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      // 找最近的景點
      let closest = points[0];
      for (const p of points) {
        if (p.absDistance < closest.absDistance) {
          closest = p;
        } else if (p.absDistance === closest.absDistance && p.distance > 0) {
          closest = p;
        }
      }

      // 決定插入 index（基於 DOM index，可能有洞）
      const insertIndex = closest.distance >= 0
        ? closest.index + 1
        : closest.index;

      // ─────────────────────────────────────────
      // 計算插入線 Y
      //
      // 關鍵修正：不能用 insertIndex >= points.length 判斷「是否為末尾」
      // 因為 points 的 index 有洞（被拖曳的自身被排除後跳號），
      // 例如：景點1被拖走，points = [{index:1},{index:2},{index:3}]
      //        length=3，但最大 index=3，用 length 會提早觸發末尾分支。
      //
      // 正確做法：找 points 中 DOM position（陣列順序）而非 index 值。
      //   points 已按 DOM 順序排列（forEach 保證），直接用陣列位置。
      // ─────────────────────────────────────────

      // closest 在 points 陣列中的位置（非 DOM index）
      const closestPos = points.indexOf(closest);
      const isLast = closestPos === points.length - 1;
      const isFirst = closestPos === 0;

      let lineY: number;

      if (closest.distance < 0 && isFirst) {
        // 滑鼠在第一個景點上方
        lineY = closest.top - 4;
      } else if (closest.distance >= 0 && isLast) {
        // 滑鼠在最後一個景點下方
        lineY = closest.bottom + 4;
      } else if (closest.distance >= 0) {
        // 滑鼠在景點下方，線畫在此景點與下一個景點之間
        const next = points[closestPos + 1];
        lineY = (closest.bottom + next.top) / 2;
      } else {
        // 滑鼠在景點上方，線畫在上一個景點與此景點之間
        const prev = points[closestPos - 1];
        lineY = (prev.bottom + closest.top) / 2;
      }

      const refPoint = points[0];
      const roundedY = Math.round(lineY);

      setItemOverIndex(prev => prev !== insertIndex ? insertIndex : prev);
      setInsertLineStyle(prev => {
        if (
          prev?.top === roundedY &&
          prev?.left === refPoint.left &&
          prev?.width === refPoint.width
        ) return prev;
        return { top: roundedY, left: refPoint.left, width: refPoint.width };
      });

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day.items]);

  // 同步 globalInsertInfo 給 AppLayout.handleDragEnd
  useEffect(() => {
    if (itemOverIndex !== null) {
      setGlobalInsertInfo({ dayId: day.day_id, insertIndex: itemOverIndex });
    } else {
      setGlobalInsertInfo(null);
    }
  }, [itemOverIndex, day.day_id]);

  useEffect(() => {
    if (!isOver) setGlobalInsertInfo(null);
  }, [isOver]);

  const shouldHighlightDay = isOver && day.items.length === 0 && !isDraggingDayRef.current;

  return (
    <div
      ref={setRefs}
      style={{ opacity: isDayDragging ? 0.4 : 1 }}
      className={`bg-white/90 backdrop-blur-sm rounded-xl overflow-hidden border transition-all duration-150 flex flex-col animate-fade-in
        ${shouldHighlightDay
          ? 'border-primary-400 border-2 ring-4 ring-primary-100 shadow-medium scale-[1.02]'
          : 'border-gray-200 shadow-soft'
        }`}
    >
      {/* 日期標題（含拖曳手柄） */}
      <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-primary-50/50 to-white group relative">
        <div className="flex items-center gap-2">
          {/* ✅ 拖曳手柄：只有手柄區域觸發 Day 拖曳，避免誤觸 */}
          <div
            {...dayDragAttributes}
            {...dayDragListeners}
            className="cursor-grab active:cursor-grabbing p-0.5 -ml-1 rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors flex-shrink-0"
            title="拖曳移動此天"
          >
            <GripVertical className="w-4 h-4" />
          </div>
          <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse-soft"></div>
          <h3 className="font-bold text-gray-900">Day {day.day_number}</h3>
        </div>
        {day.date && (
          <p className="text-sm text-gray-600 mt-1.5 ml-4">
            {new Date(day.date).toLocaleDateString('zh-TW', {
              month: 'long',
              day: 'numeric',
              weekday: 'short',
            })}
          </p>
        )}
        <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEditDay(day)}
            className="p-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
            title="編輯此天"
          >
            <Edit2 className="w-3 h-3" />
          </button>
          {day.items.length > 0 && (
            <button
              onClick={() => {
                if (confirm(`確定要清空 Day ${day.day_number} 的所有景點嗎?`)) {
                  clearDay(day.day_id);
                }
              }}
              className="p-1 bg-orange-50 text-orange-600 rounded hover:bg-orange-100"
              title="清空此天"
            >
              <Trash className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={() => {
              if (confirm(`確定要刪除 Day ${day.day_number} 嗎?\n此天的所有景點將被移除。`)) {
                removeDay(day.day_id);
              }
            }}
            className="p-1 bg-red-50 text-red-600 rounded hover:bg-red-100"
            title="刪除此天"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* 景點清單（不含任何插入線 DOM，佈局永遠穩定） */}
      <div className="flex-1 p-3 overflow-y-auto scrollbar-hide min-h-[400px]">
        {day.items.length === 0 ? (
          <div
            className={[
              'h-full flex items-center justify-center text-sm transition-all duration-200 rounded-lg',
              isOver && !isDraggingDayRef.current
                ? 'bg-blue-50 border-2 border-blue-400 border-dashed text-blue-500'
                : 'text-gray-400',
            ].join(' ')}
          >
            <div className="text-center">
              <MapPin
                className={[
                  'w-8 h-8 mx-auto mb-2 transition-all duration-200',
                  isOver && !isDraggingDayRef.current
                    ? 'opacity-80 scale-110 text-blue-400'
                    : 'opacity-50',
                ].join(' ')}
              />
              <p className="font-medium">
                {isOver && !isDraggingDayRef.current ? '放開以加入此天' : '將地點拖曳至此'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2" ref={flipContainerRef}>
            {day.items.map((item: ItineraryItem, idx: number) => (
              <React.Fragment key={item.item_id}>
                <div data-flip-id={item.item_id}>
                  <DraggablePlaceItem
                    item={item}
                    onEdit={onEditItem}
                    onCopy={onCopyItem}
                    onDragStart={() => { activeItemIdRef.current = item.item_id; }}
                    onDragEnd={() => { activeItemIdRef.current = null; }}
                    ref={(el) => { if (el) itemRefs.current[idx] = el; }}
                  />
                </div>
                {idx < day.items.length - 1 && (
                  <TransportConnector
                    item={item}
                    dayDefaultTransport={day.default_transport}
                    onEdit={() => onEditTransport(item.item_id, item.transport_to_next)}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* ✅ 插入線：Portal 到 body，完全脫離所有 overflow/stacking context
          - 不受 DayColumn 的 overflow-hidden 裁切
          - 不佔文件流空間，景點位置零影響
          - pointerEvents: none，不攔截任何拖曳事件
      */}
      {insertLineStyle !== null &&
        ReactDOM.createPortal(
          <div
            style={{
              position: 'fixed',
              top: insertLineStyle.top - 2,
              left: insertLineStyle.left,
              width: insertLineStyle.width,
              height: 3,
              zIndex: 9999,
              pointerEvents: 'none',
              borderRadius: 9999,
              background:
                'linear-gradient(to right, transparent, rgba(59,130,246,0.45) 15%, rgba(59,130,246,0.45) 85%, transparent)',
              boxShadow: '0 0 6px rgba(59, 130, 246, 0.3)',
            }}
          />,
          document.body
        )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 全局 X 座標（與 AppLayout 的 globalMouseY 同步）
// 用於判斷滑鼠是否在 Day 容器左右邊界內
// ─────────────────────────────────────────────
let _globalMouseX: number | null = null;

export function setGlobalMouseX(x: number | null) {
  _globalMouseX = x;
}

function getGlobalMouseX(): number {
  // 無法取得 X 時，回傳一個保證在畫面內的值（讓判斷退化成只靠 Y）
  return _globalMouseX ?? window.innerWidth / 2;
}

// ─────────────────────────────────────────────
// DayReorderContainer
// 負責橫向排列所有 Day 卡片，並實作 Day 拖曳排序的插入線
// ─────────────────────────────────────────────

function DayReorderContainer({
  days,
  onEditItem,
  onEditDay,
  onCopyItem,
  onEditTransport,
}: {
  days: ItineraryDay[];
  onEditItem: (item: ItineraryItem) => void;
  onEditDay: (day: ItineraryDay) => void;
  onCopyItem: (item: ItineraryItem) => void;
  onEditTransport: (itemId: string, currentMode?: string) => void;
}) {
  // 橫向插入線位置（在第幾個 Day 之前插入）
  const [dayInsertIndex, setDayInsertIndex] = useState<number | null>(null);
  const [insertLineX, setInsertLineX] = useState<number | null>(null);
  const [insertLineTop, setInsertLineTop] = useState<number>(0);
  const [insertLineHeight, setInsertLineHeight] = useState<number>(0);

  // 是否正在拖曳 Day（只有 day 類型才需要橫向插入線）
  const isDraggingDayRef = useRef(false);
  // 正在被拖曳的 day id（排除自身）
  const activeDayIdRef = useRef<string | null>(null);
  // 每個 Day 卡片的 wrapper ref
  const dayRefs = useRef<(HTMLDivElement | null)[]>([]);
  // 容器 ref（判斷滑鼠是否在橫向列表內）
  const containerRef = useRef<HTMLDivElement | null>(null);

  // 監聽 DnD 狀態：只有拖曳 day 類型時才啟動橫向插入線
  useDndMonitor({
    onDragStart(event) {
      if (event.active.data.current?.type === 'day') {
        isDraggingDayRef.current = true;
        activeDayIdRef.current = event.active.id as string;
      }
    },
    onDragEnd() {
      isDraggingDayRef.current = false;
      activeDayIdRef.current = null;
      setDayInsertIndex(null);
      setInsertLineX(null);
      setGlobalDayInsertIndex(null);
    },
    onDragCancel() {
      isDraggingDayRef.current = false;
      activeDayIdRef.current = null;
      setDayInsertIndex(null);
      setInsertLineX(null);
      setGlobalDayInsertIndex(null);
    },
  });

  // RAF loop：計算橫向插入位置
  useEffect(() => {
    let rafId: number;

    const tick = () => {
      if (!isDraggingDayRef.current || !containerRef.current || days.length === 0) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      const mouseX = getGlobalMouseX();
      const mouseY = getGlobalMouseY();
      if (mouseX === null || mouseY === null) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      // 判斷滑鼠是否在容器內
      const containerRect = containerRef.current.getBoundingClientRect();
      const visibleLeft = Math.max(containerRect.left, 0);
      const visibleRight = Math.min(containerRect.right, window.innerWidth);
      const visibleTop = Math.max(containerRect.top, 0);
      const visibleBottom = Math.min(containerRect.bottom, window.innerHeight);

      if (
        mouseX < visibleLeft || mouseX > visibleRight ||
        mouseY < visibleTop || mouseY > visibleBottom
      ) {
        setDayInsertIndex(null);
        setInsertLineX(null);
        setGlobalDayInsertIndex(null);
        rafId = requestAnimationFrame(tick);
        return;
      }

      // 收集所有非自身的 Day 中點 X 座標
      const points: {
        index: number;    // 在 days 陣列中的位置
        left: number;
        right: number;
        top: number;
        height: number;
        midX: number;
        distance: number;
        absDistance: number;
      }[] = [];

      dayRefs.current.forEach((ref, index) => {
        if (!ref) return;
        const dayId = days[index]?.day_id;
        if (dayId && dayId === activeDayIdRef.current) return; // 排除自身

        const rect = ref.getBoundingClientRect();
        if (rect.width === 0) return;

        const midX = rect.left + rect.width / 2;
        const distance = mouseX - midX;
        points.push({
          index,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          height: rect.height,
          midX,
          distance,
          absDistance: Math.abs(distance),
        });
      });

      if (points.length === 0) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      // 找距離滑鼠最近的 Day
      let closest = points[0];
      for (const p of points) {
        if (p.absDistance < closest.absDistance) closest = p;
      }

      const closestPos = points.indexOf(closest);
      const isFirst = closestPos === 0;
      const isLast = closestPos === points.length - 1;

      // 決定插入 index（基於 days 陣列）
      const insertIndex = closest.distance >= 0
        ? closest.index + 1
        : closest.index;

      // 計算插入線 X 座標（畫在兩個 Day 卡片之間）
      let lineX: number;
      if (closest.distance < 0 && isFirst) {
        lineX = closest.left - 8;
      } else if (closest.distance >= 0 && isLast) {
        lineX = closest.right + 8;
      } else if (closest.distance >= 0) {
        const next = points[closestPos + 1];
        lineX = (closest.right + next.left) / 2;
      } else {
        const prev = points[closestPos - 1];
        lineX = (prev.right + closest.left) / 2;
      }

      // 插入線高度取最高的 Day 卡片
      const maxHeight = Math.max(...points.map(p => p.height));
      const minTop = Math.min(...points.map(p => p.top));

      setDayInsertIndex(prev => prev !== insertIndex ? insertIndex : prev);
      setInsertLineX(Math.round(lineX));
      setInsertLineTop(minTop);
      setInsertLineHeight(maxHeight);
      setGlobalDayInsertIndex(insertIndex);

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  return (
    <div ref={containerRef} className="flex gap-4">
      {days.map((day: ItineraryDay, idx: number) => (
        <div
          key={day.day_id}
          className="flex-shrink-0 w-64"
          ref={(el) => { dayRefs.current[idx] = el; }}
        >
          <DayColumn
            day={day}
            onEditItem={onEditItem}
            onEditDay={onEditDay}
            onCopyItem={onCopyItem}
            onEditTransport={onEditTransport}
          />
        </div>
      ))}
      <div className="flex-shrink-0 w-64">
        <AddDayCard />
      </div>

      {/* ✅ 橫向插入線：position:fixed，Portal 到 body
          畫在兩個 Day 卡片中間，寬 3px，高度覆蓋最高卡片
      */}
      {dayInsertIndex !== null && insertLineX !== null &&
        ReactDOM.createPortal(
          <div
            style={{
              position: 'fixed',
              left: insertLineX - 1,
              top: insertLineTop,
              width: 3,
              height: insertLineHeight,
              zIndex: 9999,
              pointerEvents: 'none',
              borderRadius: 9999,
              background:
                'linear-gradient(to bottom, transparent, rgba(59,130,246,0.45) 15%, rgba(59,130,246,0.45) 85%, transparent)',
              boxShadow: '0 0 6px rgba(59, 130, 246, 0.3)',
            }}
          />,
          document.body
        )}
    </div>
  );
}

// ─────────────────────────────────────────────
// AddDayCard
// ─────────────────────────────────────────────

function AddDayCard() {
  const addNewDay = useAppStore(state => state.addDay);
  return (
    <button
      onClick={addNewDay}
      className="bg-white/50 backdrop-blur-sm border-2 border-dashed border-gray-300 rounded-xl hover:border-primary-400 hover:bg-primary-50/50 transition-all duration-300 w-full min-h-[400px] flex flex-col items-center justify-center gap-3 text-gray-500 hover:text-primary-600 group animate-fade-in hover:shadow-soft hover:scale-[1.02]"
    >
      <div className="p-4 bg-white rounded-full shadow-soft group-hover:shadow-medium transition-all">
        <Plus className="w-8 h-8 group-hover:rotate-90 transition-transform duration-300" />
      </div>
      <span className="font-semibold text-lg">新增一天</span>
    </button>
  );
}

// ─────────────────────────────────────────────
// DraggablePlaceItem
// ─────────────────────────────────────────────

const DraggablePlaceItem = React.forwardRef<HTMLDivElement, {
  item: ItineraryItem;
  onEdit: (item: ItineraryItem) => void;
  onCopy: (item: ItineraryItem) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}>(({ item, onEdit, onCopy, onDragStart, onDragEnd }, ref) => {
  const removeItemFromDay = useAppStore(state => state.removeItemFromDay);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.item_id,
    data: { type: 'itinerary-item', item },
  });

  const prevIsDraggingRef = useRef(false);
  const [isDropIn, setIsDropIn] = useState(false);
  const [isFadeOut, setIsFadeOut] = useState(false);

  useEffect(() => {
    if (isDragging && !prevIsDraggingRef.current) {
      onDragStart?.();
    } else if (!isDragging && prevIsDraggingRef.current) {
      onDragEnd?.();
    }
    prevIsDraggingRef.current = isDragging;
  }, [isDragging, onDragStart, onDragEnd]);

  // ✅ 淡入：reorder 放開 或 從收藏池新增
  // ✅ 淡出：拖回收藏池
  useEffect(() => {
    const check = () => {
      if (getDroppedItemId() === item.item_id) {
        clearDroppedItemId();
        setIsDropIn(true);
        setTimeout(() => setIsDropIn(false), 350);
      }
      if (getFadingOutItemId() === item.item_id) {
        clearFadingOutItemId();
        setIsFadeOut(true);
      }
    };
    const id = setTimeout(check, 0);
    return () => clearTimeout(id);
  });

  const combinedRef = (node: HTMLDivElement | null) => {
    setNodeRef(node);
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (confirm(`確定要刪除「${item.place.name}」嗎?`)) {
        removeItemFromDay(item.item_id);
      }
    }
  };

  const formatTime = (time24: string) => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const period = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${period}`;
  };

  return (
    <div
      ref={combinedRef}
      style={{
        opacity: isDragging ? 0.3 : 1,
        animation: isFadeOut
          ? 'fadeOut 250ms ease-out forwards'
          : isDropIn
          ? 'dropIn 300ms ease-out forwards'
          : undefined,
      }}
      className="bg-white border border-gray-200 rounded-xl p-3 cursor-grab active:cursor-grabbing relative group hover:border-primary-300 hover:shadow-soft"
      onKeyDown={handleKeyDown}
      {...attributes}
      {...listeners}
    >
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button
          onClick={e => { e.stopPropagation(); onCopy(item); }}
          className="p-1 bg-green-50 text-green-600 rounded hover:bg-green-100"
          title="複製到其他天"
        >
          <Copy className="w-3 h-3" />
        </button>
        <button
          onClick={e => { e.stopPropagation(); onEdit(item); }}
          className="p-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
          title="編輯此景點"
        >
          <Edit2 className="w-3 h-3" />
        </button>
        <button
          onClick={e => { e.stopPropagation(); removeItemFromDay(item.item_id); }}
          className="p-1 bg-red-50 text-red-600 rounded hover:bg-red-100"
          title="移除此景點"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {item.scheduled_time && (
        <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
          <Clock className="w-3 h-3" />
          <span>{formatTime(item.scheduled_time)}</span>
          {item.duration_minutes && (
            <span className="text-gray-400">({item.duration_minutes} 分鐘)</span>
          )}
        </div>
      )}

      <h4 className="font-medium text-gray-900 text-sm mb-1">{item.place.name}</h4>

      {item.notes && (
        <p className="text-xs text-gray-600 italic mt-1">{item.notes}</p>
      )}
    </div>
  );
});

DraggablePlaceItem.displayName = 'DraggablePlaceItem';

// ─────────────────────────────────────────────
// TransportConnector
// ─────────────────────────────────────────────

function TransportConnector({
  item,
  dayDefaultTransport,
  onEdit,
}: {
  item: ItineraryItem;
  dayDefaultTransport?: string;
  onEdit: () => void;
}) {
  const transportMode = item.transport_to_next || dayDefaultTransport;
  const hasTransport = !!transportMode;

  return (
    <div
      className="group relative flex items-center justify-center py-1.5 cursor-pointer"
      onClick={onEdit}
    >
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-px h-full bg-gray-200 group-hover:bg-primary-300 transition-colors" />
      </div>
      <div className="relative z-10 flex items-center gap-2 px-3 py-1 bg-white border border-gray-200 rounded-lg group-hover:border-primary-400 group-hover:shadow-soft transition-all">
        {hasTransport ? (
          <>
            <Navigation className="w-3 h-3 text-gray-500 group-hover:text-primary-600 transition-colors" />
            <span className="text-xs text-gray-600 group-hover:text-primary-700 font-medium">
              {getTransportLabel(transportMode as ItineraryItem['transport_to_next'])}
            </span>
            {item.transport_duration_minutes && (
              <span className="text-xs text-gray-400">
                ({item.transport_duration_minutes} 分鐘)
              </span>
            )}
          </>
        ) : (
          <>
            <Plus className="w-3 h-3 text-gray-400 group-hover:text-primary-600 transition-colors" />
            <span className="text-xs text-gray-400 group-hover:text-primary-700 font-medium">
              點擊設定交通方式
            </span>
          </>
        )}
      </div>
    </div>
  );
}