import { describe, expect, it } from 'vitest'
import type { Account, BudgetLimit, Transaction } from '../db/schema'
import {
  calculateCategoryTotalsKzt, calculateUncategorizedKzt, limitId, monthBalance, monthLabel, nextMonth, parsePlanInput, planCopy, previousMonth,
} from './budget'

const lim = (categoryId: string, plannedAmount: number, year = 2026, month = 10): BudgetLimit => ({
  id: limitId(year, month, categoryId), year, month, categoryId, plannedAmount,
})

describe('month helpers', () => {
  it('labels and ids', () => {
    expect(monthLabel(2026, 11)).toBe('Ноябрь 2026')
    expect(limitId(2026, 3, 'cat-food')).toBe('2026-3-cat-food')
  })
  it('previous / next wrap years', () => {
    expect(previousMonth(2026, 1)).toEqual({ year: 2025, month: 12 })
    expect(previousMonth(2026, 5)).toEqual({ year: 2026, month: 4 })
    expect(nextMonth(2026, 12)).toEqual({ year: 2027, month: 1 })
    expect(nextMonth(2026, 5)).toEqual({ year: 2026, month: 6 })
  })
})

describe('planCopy', () => {
  it('copies to the target month, skipping existing categories and zero plans', () => {
    const result = planCopy(
      [lim('a', 100), lim('b', 200), lim('c', 0)],
      [lim('b', 999, 2026, 11)],
      2026, 11,
    )
    expect(result).toEqual([{ id: '2026-11-a', year: 2026, month: 11, categoryId: 'a', plannedAmount: 100 }])
  })
  it('handles empty inputs', () => {
    expect(planCopy([], [], 2026, 11)).toEqual([])
  })
})

describe('parsePlanInput', () => {
  it.each([
    ['', 0], ['  ', 0], ['1500', 1500], ['1 500,5', 1500.5], ['0', 0], ['10.456', 10.46],
  ])('%j → %s', (input, expected) => expect(parsePlanInput(input)).toBe(expected))
  it.each(['abc', '-5', '1e999'])('rejects %j', (input) => expect(parsePlanInput(input)).toBeNull())
})

describe('calculateCategoryTotalsKzt', () => {
  const accounts = [
    { id: 'k', currency: 'KZT' }, { id: 'u', currency: 'USD' },
  ] as Account[]
  const tx = (o: Partial<Transaction>): Transaction => ({
    id: 't', date: '2026-11-01', timestamp: 0, type: 'expense', accountId: 'k', amount: 1,
    categoryId: 'food', isExcludedFromNoSpend: false, ...o,
  })
  it('empty', () => expect(calculateCategoryTotalsKzt([], accounts)).toEqual({}))
  it('converts and sums, skipping non-expenses, goals, uncategorized, unknown accounts and missing rates', () => {
    const txs = [
      tx({ amount: 100 }), tx({ amount: 2, accountId: 'u' }), tx({ amount: 5, categoryId: 'fun' }),
      tx({ type: 'income' }), tx({ goalId: 'g' }), tx({ categoryId: undefined }),
      tx({ accountId: 'ghost' }),
    ]
    expect(calculateCategoryTotalsKzt(txs, accounts, { USD: 450 })).toEqual({ food: 1000, fun: 5 })
    expect(calculateCategoryTotalsKzt(txs, accounts)).toEqual({ food: 100, fun: 5 })
  })
})

describe('calculateUncategorizedKzt', () => {
  const accounts = [{ id: 'k', currency: 'KZT' }, { id: 'u', currency: 'USD' }] as Account[]
  const tx = (o: Partial<Transaction>): Transaction => ({
    id: 't', date: '2026-11-01', timestamp: 0, type: 'expense', accountId: 'k', amount: 1,
    isExcludedFromNoSpend: false, ...o,
  })
  it('empty', () => expect(calculateUncategorizedKzt([], accounts)).toBe(0))
  it('sums only uncategorized expenses (debt payments count, goals, income and categorized do not)', () => {
    const txs = [
      tx({ amount: 100 }), tx({ amount: 2, accountId: 'u' }), tx({ amount: 5, debtId: 'd' }),
      tx({ categoryId: 'food' }), tx({ goalId: 'g' }), tx({ type: 'income' }), tx({ accountId: 'ghost' }),
    ]
    expect(calculateUncategorizedKzt(txs, accounts, { USD: 450 })).toBe(1005)
    expect(calculateUncategorizedKzt(txs, accounts)).toBe(105)
  })
})

describe('monthBalance', () => {
  it('остаток: план больше трат', () => {
    expect(monthBalance(50000, 12000)).toEqual({ amount: 38000, over: false })
  })
  it('ровно по плану — остаток 0, не перерасход', () => {
    expect(monthBalance(1000, 1000)).toEqual({ amount: 0, over: false })
  })
  it('перерасход: сумма превышения положительная', () => {
    expect(monthBalance(1000, 1500.5)).toEqual({ amount: 500.5, over: true })
  })
  it('копейки не дрейфуют', () => {
    expect(monthBalance(0.3, 0.1 + 0.2)).toEqual({ amount: 0, over: false })
  })
  it('без плана сравнивать не с чем', () => {
    expect(monthBalance(0, 500)).toBeUndefined()
    expect(monthBalance(NaN, 500)).toBeUndefined()
  })
})
