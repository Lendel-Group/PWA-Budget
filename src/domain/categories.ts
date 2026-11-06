import type { Category, Transaction } from '../db/schema'
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
 * Порядок «по умолчанию»: сначала набор из `defaultIds` в его порядке, затем остальные (пользовательские)
 * по возрастанию `order`, а без него — в исходном порядке.
 * Нужен потому, что Dexie отдаёт записи по первичному ключу, то есть по алфавиту id, а не в порядке сида.
 */
export function sortByDefaultOrder<C extends { id: string; order?: number }>(categories: readonly C[], defaultIds: readonly string[]): C[] {
  const position = new Map(defaultIds.map((id, i) => [id, i] as const))
  return categories
    .map((category, index) => ({ category, index, rank: position.get(category.id) ?? defaultIds.length }))
    .sort((a, b) => a.rank - b.rank || (a.category.order ?? 0) - (b.category.order ?? 0) || a.index - b.index)
    .map((x) => x.category)
}

export const CATEGORY_NAME_MAX = 30

export interface CategoryInput {
  name: string
  type: Category['type']
  icon: string
  color: string
  /** Расходы в категории не нарушают «дни без трат» (только для расходных). */
  isExcludedFromNoSpend?: boolean
}

export type CategoryField = 'name' | 'icon' | 'color'

/**
 * Ошибки по полям формы категории. Название — непустое, до 30 символов, уникальное (без учёта регистра)
 * среди категорий того же типа, включая скрытые; `selfId` — редактируемая категория.
 */
export function categoryFieldErrors(
  input: CategoryInput,
  existing: readonly Pick<Category, 'id' | 'name' | 'type' | 'isArchived'>[],
  selfId?: string,
): Partial<Record<CategoryField, string>> {
  const errors: Partial<Record<CategoryField, string>> = {}
  const name = input.name.trim()
  if (!name) errors.name = 'Укажите название категории'
  else if (name.length > CATEGORY_NAME_MAX) errors.name = `Название не длиннее ${CATEGORY_NAME_MAX} символов`
  else {
    const same = existing.find(
      (c) => c.id !== selfId && c.type === input.type && c.name.trim().toLowerCase() === name.toLowerCase(),
    )
    if (same) errors.name = same.isArchived ? 'Категория с таким названием есть среди скрытых' : 'Категория с таким названием уже есть'
  }
  if (!input.icon) errors.icon = 'Выберите иконку'
  if (!/^#[0-9a-f]{6}$/i.test(input.color)) errors.color = 'Выберите цвет'
  return errors
}

/** Первая ошибка (название, иконка, цвет) или undefined. */
export function validateCategoryInput(
  input: CategoryInput,
  existing: readonly Pick<Category, 'id' | 'name' | 'type' | 'isArchived'>[],
  selfId?: string,
): string | undefined {
  return Object.values(categoryFieldErrors(input, existing, selfId))[0]
}

/**
 * Значение `isExcludedFromNoSpend` для новой операции: ручной выбор пользователя (переопределение) важнее,
 * иначе — настройка категории (нет категории или флага — false).
 */
export function resolveExcludedFromNoSpend(
  category: Pick<Category, 'isExcludedFromNoSpend'> | undefined,
  override?: boolean,
): boolean {
  return override ?? !!category?.isExcludedFromNoSpend
}

/** Строка «Категории» в «Настройках»: «Расходы: N · Доходы: M», вместе со скрытыми (spec/05). */
export function categoriesSummary(categories: readonly { type: 'expense' | 'income' }[]): string {
  const count = (type: 'expense' | 'income') => categories.filter((c) => c.type === type).length
  return `Расходы: ${count('expense')} · Доходы: ${count('income')}`
}

/** Список вкладки экрана «Категории»: категории одного типа в порядке по умолчанию, скрытые — в конце. */
export function categoriesOfType<C extends { id: string; type: 'expense' | 'income'; order?: number; isArchived?: boolean }>(
  categories: readonly C[],
  type: C['type'],
  defaultIds: readonly string[],
): C[] {
  const list = sortByDefaultOrder(categories, defaultIds).filter((c) => c.type === type)
  return [...list.filter((c) => !c.isArchived), ...list.filter((c) => c.isArchived)]
}
