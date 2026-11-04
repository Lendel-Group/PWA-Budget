import type { Transaction } from '../db/schema'
import { addDays } from './dates'

/** За какой период считается частота использования категорий. */
export const USAGE_WINDOW_DAYS = 90

/**
 * Категории по убыванию частоты использования за последние `windowDays` дней (включая сегодня);
 * при равной частоте (в том числе у неиспользованных) сохраняется исходный порядок.
 */
export function sortCategoriesByUsage<C extends { id: string }>(
  categories: readonly C[],
  transactions: readonly Pick<Transaction, 'categoryId' | 'date'>[],
  today: string,
  windowDays: number = USAGE_WINDOW_DAYS,
): C[] {
  const from = addDays(today, -windowDays)
  const counts = new Map<string, number>()
  for (const t of transactions) {
    if (t.categoryId && t.date >= from) counts.set(t.categoryId, (counts.get(t.categoryId) ?? 0) + 1)
  }
  return categories
    .map((category, index) => ({ category, index, count: counts.get(category.id) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.index - b.index)
    .map((x) => x.category)
}

/**
 * Порядок «по умолчанию»: как в списке `defaultIds` (набор из сида), остальные — после него в исходном порядке.
 * Нужен потому, что Dexie отдаёт записи по первичному ключу, то есть по алфавиту id, а не в порядке сида.
 */
export function sortByDefaultOrder<C extends { id: string }>(categories: readonly C[], defaultIds: readonly string[]): C[] {
  const position = new Map(defaultIds.map((id, i) => [id, i] as const))
  return categories
    .map((category, index) => ({ category, index, rank: position.get(category.id) ?? defaultIds.length }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((x) => x.category)
}
