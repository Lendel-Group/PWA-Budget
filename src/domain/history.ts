import type { Account, Transaction } from '../db/schema'
import { previousMonth } from './budget'
import { addDays, daysInMonth, monthStart, parseDate } from './dates'
import { convertToKzt, round2, type Rates } from './finance'

export type TypeFilter = Transaction['type'] | 'all'

/** Пустая строка в поле означает «без ограничения». Даты — YYYY-MM-DD, границы включительно. */
export interface HistoryFilter {
  type: TypeFilter
  accountId: string
  categoryId: string
  from: string
  to: string
}

export const EMPTY_FILTER: HistoryFilter = { type: 'all', accountId: '', categoryId: '', from: '', to: '' }

export const isFilterActive = (f: HistoryFilter): boolean =>
  f.type !== 'all' || !!f.accountId || !!f.categoryId || !!f.from || !!f.to

/** Перевод относится к обоим своим счетам: и к списанию, и к зачислению. */
export function filterTransactions(txs: Transaction[], f: HistoryFilter): Transaction[] {
  return txs.filter(
    (t) =>
      (f.type === 'all' || t.type === f.type) &&
      (!f.accountId || t.accountId === f.accountId || t.toAccountId === f.accountId) &&
      (!f.categoryId || t.categoryId === f.categoryId) &&
      (!f.from || t.date >= f.from) &&
      (!f.to || t.date <= f.to),
  )
}

export type PeriodPreset = 'all' | 'month' | 'prev-month' | '30d'

const pad = (n: number) => String(n).padStart(2, '0')
const monthRange = (year: number, month: number) => ({
  from: `${year}-${pad(month)}-01`,
  to: `${year}-${pad(month)}-${pad(daysInMonth(year, month))}`,
})

export function periodRange(preset: PeriodPreset, today: string): { from: string; to: string } {
  switch (preset) {
    case 'all':
      return { from: '', to: '' }
    case 'month': {
      const { year, month } = parseDate(monthStart(today))
      return monthRange(year, month)
    }
    case 'prev-month': {
      const { year, month } = parseDate(monthStart(today))
      const p = previousMonth(year, month)
      return monthRange(p.year, p.month)
    }
    case '30d':
      return { from: addDays(today, -29), to: today }
  }
}

export interface DayGroup {
  date: string
  items: Transaction[]
  /**
   * Чистое изменение денег за день в KZT: доходы − расходы (переводы не считаются,
   * пополнения целей и платежи по долгам — расходы). null, если нечего считать
   * (только переводы или нет курса валюты).
   */
  totalKzt: number | null
}

/** Группировка по дням: дни и операции внутри дня — от новых к старым. */
export function groupByDay(txs: Transaction[], accounts: Account[], rates: Rates = {}): DayGroup[] {
  const currencyById = new Map(accounts.map((a) => [a.id, a.currency]))
  const sorted = [...txs].sort((a, b) => b.date.localeCompare(a.date) || b.timestamp - a.timestamp)
  const groups: DayGroup[] = []
  for (const t of sorted) {
    let g = groups.at(-1)
    if (g?.date !== t.date) {
      g = { date: t.date, items: [], totalKzt: null }
      groups.push(g)
    }
    g.items.push(t)
    if (t.type === 'transfer') continue
    const currency = currencyById.get(t.accountId)
    if (!currency) continue
    const kzt = convertToKzt(t.amount, currency, rates)
    if (kzt === undefined) continue
    g.totalKzt = round2((g.totalKzt ?? 0) + (t.type === 'income' ? kzt : -kzt))
  }
  return groups
}

/** Первые дни целиком, пока не наберётся хотя бы minItems операций (день не обрывается посередине). */
export function takeGroups(groups: DayGroup[], minItems: number): DayGroup[] {
  let count = 0
  const out: DayGroup[] = []
  for (const g of groups) {
    if (count >= minItems) break
    out.push(g)
    count += g.items.length
  }
  return out
}
