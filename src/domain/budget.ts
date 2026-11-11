import type { Account, BudgetLimit, Transaction } from '../db/schema'
import { convertToKzt, MAX_AMOUNT, round2, type Rates } from './finance'

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

export const monthLabel = (year: number, month: number): string => `${MONTHS[month - 1]} ${year}`

export const limitId = (year: number, month: number, categoryId: string): string =>
  `${year}-${month}-${categoryId}`

export function previousMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
}

export function nextMonth(year: number, month: number): { year: number; month: number } {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }
}

/**
 * Лимиты прошлого месяца, которых ещё нет в текущем (уже заданные не перезаписываются),
 * перенесённые на (year, month).
 */
export function planCopy(
  previous: BudgetLimit[],
  current: BudgetLimit[],
  year: number,
  month: number,
): BudgetLimit[] {
  const existing = new Set(current.map((l) => l.categoryId))
  return previous
    .filter((l) => !existing.has(l.categoryId) && l.plannedAmount > 0)
    .map((l) => ({ ...l, id: limitId(year, month, l.categoryId), year, month }))
}

/** Ввод лимита: '' → 0 (удалить), число ≥ 0 → округлённая сумма, мусор/отрицательное → null. */
export function parsePlanInput(input: string): number | null {
  const trimmed = input.trim().replace(/\s/g, '').replace(',', '.')
  if (trimmed === '') return 0
  const n = Number(trimmed)
  return Number.isFinite(n) && n >= 0 && n <= MAX_AMOUNT ? round2(n) : null
}

/**
 * Расходы без категории в KZT (операции, созданные до обязательности категории).
 * Платежи по долгам входят в общие расходы месяца, пополнения целей — нет.
 */
export function calculateUncategorizedKzt(
  transactions: Transaction[],
  accounts: Account[],
  rates: Rates = {},
): number {
  const currencyById = new Map(accounts.map((a) => [a.id, a.currency]))
  let total = 0
  for (const t of transactions) {
    if (t.type !== 'expense' || t.goalId || t.categoryId) continue
    const currency = currencyById.get(t.accountId)
    if (!currency) continue
    total += convertToKzt(t.amount, currency, rates) ?? 0
  }
  return round2(total)
}

/** Расходы по категориям в KZT (пополнения целей и операции без курса не учитываются). */
export function calculateCategoryTotalsKzt(
  transactions: Transaction[],
  accounts: Account[],
  rates: Rates = {},
): Record<string, number> {
  const currencyById = new Map(accounts.map((a) => [a.id, a.currency]))
  const totals: Record<string, number> = {}
  for (const t of transactions) {
    if (t.type !== 'expense' || t.goalId || !t.categoryId) continue
    const currency = currencyById.get(t.accountId)
    if (!currency) continue
    const kzt = convertToKzt(t.amount, currency, rates)
    if (kzt === undefined) continue
    totals[t.categoryId] = round2((totals[t.categoryId] ?? 0) + kzt)
  }
  return totals
}

export interface MonthBalance {
  /** Сколько осталось (если не превышен) или на сколько превышен план — всегда неотрицательное. */
  amount: number
  over: boolean
}

/**
 * Итог месяца относительно плана: остаток или перерасход. Без плана (0) сравнивать не с чем — `undefined`,
 * иначе любые траты выглядели бы перерасходом.
 */
export function monthBalance(planned: number, spent: number): MonthBalance | undefined {
  if (!(planned > 0)) return undefined
  const diff = round2(planned - spent)
  return { amount: Math.abs(diff), over: diff < 0 }
}
