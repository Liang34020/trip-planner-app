// src/utils/validation.ts

import type { ItineraryItem } from '../types/models';

/**
 * 驗證時間格式 (HH:mm)
 */
export function isValidTime(time: string): boolean {
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return timeRegex.test(time);
}

/**
 * 驗證停留時間（必須為正數且合理）
 */
export function isValidDuration(minutes: number): boolean {
  return minutes > 0 && minutes <= 1440; // 最多 24 小時
}

/**
 * 驗證 sequence 精度
 */
export function checkSequencePrecision(items: ItineraryItem[]): {
  needsRebalance: boolean;
  minDifference: number;
} {
  if (items.length < 2) {
    return { needsRebalance: false, minDifference: Infinity };
  }

  let minDiff = Infinity;
  for (let i = 0; i < items.length - 1; i++) {
    const diff = items[i + 1].sequence - items[i].sequence;
    minDiff = Math.min(minDiff, diff);
  }

  return {
    needsRebalance: minDiff < 0.0001,
    minDifference: minDiff,
  };
}

/**
 * 驗證是否有重複的 item_id
 */
export function hasDuplicateIds(items: ItineraryItem[]): boolean {
  const ids = items.map(item => item.item_id);
  return new Set(ids).size !== ids.length;
}

/**
 * 驗證日期格式 (YYYY-MM-DD)
 */
export function isValidDate(dateString: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) return false;

  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

/**
 * 計算兩個日期之間的天數
 */
export function daysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = end.getTime() - start.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}