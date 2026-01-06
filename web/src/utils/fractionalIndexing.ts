// src/utils/fractionalIndexing.ts

/**
 * Fractional Indexing 演算法
 * 用於高效能的拖曳排序，只需更新一筆記錄
 */

/**
 * 計算新的 sequence 值
 * @param prevSequence 前一個項目的 sequence（null 表示插入到最前面）
 * @param nextSequence 後一個項目的 sequence（null 表示插入到最後面）
 * @returns 新的 sequence 值
 */
export function calculateNewSequence(
  prevSequence: number | null,
  nextSequence: number | null
): number {
  // Case 1: 插入到最前面
  if (prevSequence === null && nextSequence === null) {
    return 1.0;
  }

  // Case 2: 插入到最前面（有後續項目）
  if (prevSequence === null && nextSequence !== null) {
    return nextSequence / 2;
  }

  // Case 3: 插入到最後面
  if (prevSequence !== null && nextSequence === null) {
    return prevSequence + 1.0;
  }

  // Case 4: 插入到中間
  if (prevSequence !== null && nextSequence !== null) {
    return (prevSequence + nextSequence) / 2;
  }

  // 預設值（不應該到這裡）
  return 1.0;
}

/**
 * 檢查是否需要重整 sequence
 * 當精度過低時（小於 0.0001）需要重新分配 sequence
 */
export function needsRebalance(items: { sequence: number }[]): boolean {
  for (let i = 0; i < items.length - 1; i++) {
    const diff = items[i + 1].sequence - items[i].sequence;
    if (diff < 0.0001) {
      return true;
    }
  }
  return false;
}

/**
 * 重新分配 sequence（1.0, 2.0, 3.0...）
 */
export function rebalanceSequences<T extends { sequence: number }>(
  items: T[]
): T[] {
  return items.map((item, index) => ({
    ...item,
    sequence: (index + 1) * 1.0,
  }));
}

/**
 * 測試範例
 */
export function testFractionalIndexing() {
  console.log('=== Fractional Indexing 測試 ===');

  // 測試 1: 插入到 A 和 B 之間
  const seq1 = calculateNewSequence(1.0, 2.0);
  console.log('插入到 A(1.0) 和 B(2.0) 之間:', seq1); // 1.5

  // 測試 2: 插入到最前面
  const seq2 = calculateNewSequence(null, 1.0);
  console.log('插入到最前面:', seq2); // 0.5

  // 測試 3: 插入到最後面
  const seq3 = calculateNewSequence(3.0, null);
  console.log('插入到最後面:', seq3); // 4.0

  // 測試 4: 連續插入會導致精度耗盡
  let prevSeq = 1.0;
  let nextSeq = 2.0;
  for (let i = 0; i < 20; i++) {
    const newSeq = calculateNewSequence(prevSeq, nextSeq);
    console.log(`第 ${i + 1} 次插入:`, newSeq);
    prevSeq = newSeq;
  }

  // 測試 5: 檢測是否需要重整
  const testItems = [
    { sequence: 1.0 },
    { sequence: 1.00005 },
    { sequence: 2.0 },
  ];
  console.log('需要重整？', needsRebalance(testItems)); // true
}