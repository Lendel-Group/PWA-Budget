import type { Account, Transaction } from '../db/schema'
import { convertToKzt, round2, type Rates } from './finance'

export interface MonthSummary {
  month: number // 1-12
  income: number
  expense: number
  /** Доходы − расходы (пополнения целей в расходы не входят, т.е. остаются сбережениями). */
  savings: number
}

/** Сводка по 12 месяцам года в KZT. Переводы и операции без курса не учитываются. */
export function calculateYearSummary(
  transactions: Transaction[],
  accounts: Account[],
  rates: Rates,
  year: number,
): MonthSummary[] {
  const currencyById = new Map(accounts.map((a) => [a.id, a.currency]))
  const rows: MonthSummary[] = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1, income: 0, expense: 0, savings: 0,
  }))
  const prefix = `${year}-`
  for (const t of transactions) {
    if (!t.date.startsWith(prefix) || t.type === 'transfer') continue
    if (t.type === 'expense' && t.goalId) continue
    const currency = currencyById.get(t.accountId)
    if (!currency) continue
    const kzt = convertToKzt(t.amount, currency, rates)
    if (kzt === undefined) continue
    const row = rows[Number(t.date.slice(5, 7)) - 1]
    if (t.type === 'income') row.income += kzt
    else row.expense += kzt
  }
  for (const r of rows) {
    r.income = round2(r.income)
    r.expense = round2(r.expense)
    r.savings = round2(r.income - r.expense)
  }
  return rows
}

export function sumYear(rows: MonthSummary[]): Omit<MonthSummary, 'month'> {
  const income = round2(rows.reduce((s, r) => s + r.income, 0))
  const expense = round2(rows.reduce((s, r) => s + r.expense, 0))
  return { income, expense, savings: round2(income - expense) }
}

/** Высоты столбцов в долях 0..1 относительно максимума (все нули → нули). */
export function barFractions(values: number[]): number[] {
  const max = Math.max(0, ...values)
  return values.map((v) => (max > 0 ? Math.max(0, v) / max : 0))
}

/** Компактная подпись суммы для оси графика: 1 500 → «1,5 тыс.», 2 300 000 → «2,3 млн». */
export function compactAmount(n: number): string {
  const abs = Math.abs(n)
  const fmt = (v: number, unit: string) => `${String(Math.round(v * 10) / 10).replace('.', ',')} ${unit}`
  if (abs >= 1_000_000) return fmt(n / 1_000_000, 'млн')
  if (abs >= 1_000) return fmt(n / 1_000, 'тыс.')
  return String(Math.round(n))
}
