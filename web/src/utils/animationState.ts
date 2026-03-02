/**
 * animationState.ts
 * 跨元件的動畫狀態，用 module-level 變數共享
 * 不使用 React state，避免觸發不必要的 re-render
 */

/** 剛放開/新增的 item id，DraggablePlaceItem 讀取後播淡入動畫 */
let droppedItemId: string | null = null;

export function setDroppedItemId(id: string | null) {
  droppedItemId = id;
}

export function getDroppedItemId(): string | null {
  return droppedItemId;
}

export function clearDroppedItemId() {
  droppedItemId = null;
}

/** AppLayout 確認有效移動後設為 true，DayColumn onDragEnd 才執行 snapshot */
let shouldSnapshot = false;

export function triggerSnapshot() {
  shouldSnapshot = true;
}

export function consumeSnapshot(): boolean {
  const val = shouldSnapshot;
  shouldSnapshot = false;
  return val;
}

/** DayColumn 註冊的 snapshotRects callback，供 AppLayout 直接呼叫 */
const snapshotCallbacks = new Map<string, (activeId: string | null) => void>();

export function registerSnapshotCallback(dayId: string, fn: (activeId: string | null) => void) {
  snapshotCallbacks.set(dayId, fn);
}

export function unregisterSnapshotCallback(dayId: string) {
  snapshotCallbacks.delete(dayId);
}

export function snapshotAllDays(activeId: string | null) {
  snapshotCallbacks.forEach(fn => fn(activeId));
}
let pendingFlip = false;

export function setPendingFlip(val: boolean) {
  pendingFlip = val;
}

export function consumePendingFlip(): boolean {
  const val = pendingFlip;
  pendingFlip = false;
  return val;
}

let fadingOutItemId: string | null = null;

export function setFadingOutItemId(id: string | null) {
  fadingOutItemId = id;
}

export function getFadingOutItemId(): string | null {
  return fadingOutItemId;
}

export function clearFadingOutItemId() {
  fadingOutItemId = null;
}