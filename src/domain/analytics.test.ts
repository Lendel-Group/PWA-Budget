import { describe, expect, it } from 'vitest'
import type { Account, Transaction } from '../db/schema'
import { barFractions, calculateYearSummary, compactAmount, sumYear } from './analytics'

const accounts = [{ id: 'k', currency: 'KZT' }, { id: 'u', currency: 'USD' }] as Account[]
const tx = (o: Partial<Transaction>): Transaction => ({
  id: 't', date: '2026-01-15', timestamp: 0, type: 'expense', accountId: 'k', amount: 1,
  isExcludedFromNoSpend: false, ...o,
})

describe('calculateYearSummary', () => {
  it('returns 12 zero rows for no data', () => {
    const rows = calculateYearSummary([], accounts, {}, 2026)
    expect(rows).toHaveLength(12)
    expect(rows.every((r) => r.income === 0 && r.expense === 0 && r.savings === 0)).toBe(true)
    expect(rows[11].month).toBe(12)
  })
  it('aggregates by month, converts currencies, ignores other years / transfers / goals / unknown accounts / missing rates', () => {
    const rows = calculateYearSummary([
      tx({ type: 'income', amount: 1000 }),
      tx({ amount: 300 }),
      tx({ amount: 2, accountId: 'u', date: '2026-01-20' }),
      tx({ type: 'income', amount: 1, accountId: 'u', date: '2026-03-01' }),
      tx({ type: 'transfer', amount: 999 }),
      tx({ amount: 500, goalId: 'g' }),
      tx({ amount: 7, accountId: 'ghost' }),
      tx({ amount: 700, date: '2025-01-15' }),
    ], accounts, { USD: 450 }, 2026)
    expect(rows[0]).toEqual({ month: 1, income: 1000, expense: 1200, savings: -200 })
    expect(rows[2]).toEqual({ month: 3, income: 450, expense: 0, savings: 450 })
    const noRates = calculateYearSummary([tx({ amount: 2, accountId: 'u' })], accounts, {}, 2026)
    expect(noRates[0].expense).toBe(0)
  })
})

describe('sumYear', () => {
  it('totals', () => {
    expect(sumYear([])).toEqual({ income: 0, expense: 0, savings: 0 })
    expect(sumYear([
      { month: 1, income: 100.1, expense: 50.2, savings: 49.9 },
      { month: 2, income: 0.2, expense: 10, savings: -9.8 },
    ])).toEqual({ income: 100.3, expense: 60.2, savings: 40.1 })
  })
})

describe('barFractions', () => {
  it('scales to the max', () => expect(barFractions([0, 50, 100])).toEqual([0, 0.5, 1]))
  it('all zeros / empty / negatives', () => {
    expect(barFractions([0, 0])).toEqual([0, 0])
    expect(barFractions([])).toEqual([])
    expect(barFractions([-5, 10])).toEqual([0, 1])
  })
})

describe('compactAmount', () => {
  it.each([[0, '0'], [999, '999'], [1500, '1,5 тыс.'], [10000, '10 тыс.'], [2_300_000, '2,3 млн'], [-1500, '-1,5 тыс.']])(
    '%s → %s', (n, s) => expect(compactAmount(n)).toBe(s),
  )
})
