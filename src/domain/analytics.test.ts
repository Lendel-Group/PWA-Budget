import { describe, expect, it } from 'vitest'
import type { Account, Transaction } from '../db/schema'
import { barFractions, calculateCategoryBreakdown, calculateYearSummary, compactAmount, sumYear } from './analytics'

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

describe('calculateCategoryBreakdown', () => {
  const data = [
    tx({ id: '1', date: '2026-03-02', amount: 3000, categoryId: 'food' }),
    tx({ id: '2', date: '2026-03-10', amount: 1000, categoryId: 'food' }),
    tx({ id: '3', date: '2026-03-11', amount: 2000, categoryId: 'fun' }),
    tx({ id: '4', date: '2026-04-01', amount: 4000, categoryId: 'fun' }),
    tx({ id: '5', date: '2026-04-02', amount: 10, accountId: 'u', categoryId: 'food' }), // 10 USD
    tx({ id: '6', date: '2026-04-03', amount: 500 }), // без категории
  ]

  it('пустые данные: нет строк, итог 0, доли не делятся на ноль', () => {
    expect(calculateCategoryBreakdown([], accounts, {}, 2026)).toEqual({ rows: [], total: 0, skippedCurrencies: [] })
  })

  it('год: суммы по категориям по убыванию, итог и доли', () => {
    const r = calculateCategoryBreakdown(data, accounts, { USD: 500 }, 2026)
    expect(r.rows.map((x) => [x.categoryId, x.amount])).toEqual([['food', 9000], ['fun', 6000], [null, 500]])
    expect(r.total).toBe(15500)
    expect(r.rows.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1, 10)
    expect(r.rows[0].share).toBeCloseTo(9000 / 15500, 10)
  })

  it('месяц: только выбранный месяц', () => {
    const r = calculateCategoryBreakdown(data, accounts, { USD: 500 }, 2026, 3)
    expect(r.rows.map((x) => [x.categoryId, x.amount])).toEqual([['food', 4000], ['fun', 2000]])
    expect(r.total).toBe(6000)
    expect(calculateCategoryBreakdown(data, accounts, { USD: 500 }, 2026, 12).rows).toEqual([])
  })

  it('другой год, доходы, переводы, пополнения целей и неизвестные счета не учитываются', () => {
    const noise = [
      tx({ date: '2025-03-02', amount: 99, categoryId: 'food' }),
      tx({ date: '2026-03-02', type: 'income', amount: 99, categoryId: 'food' }),
      tx({ date: '2026-03-02', type: 'transfer', amount: 99, toAccountId: 'u' }),
      tx({ date: '2026-03-02', amount: 99, categoryId: 'food', goalId: 'g' }),
      tx({ date: '2026-03-02', amount: 99, categoryId: 'food', accountId: 'zzz' }),
    ]
    expect(calculateCategoryBreakdown(noise, accounts, {}, 2026)).toEqual({ rows: [], total: 0, skippedCurrencies: [] })
  })

  it('платёж по долгу — это расход и входит в итог', () => {
    const r = calculateCategoryBreakdown([tx({ amount: 700, categoryId: 'credit', debtId: 'd' })], accounts, {}, 2026)
    expect(r.rows).toEqual([{ categoryId: 'credit', amount: 700, share: 1 }])
  })

  it('валюта без курса исключается и перечисляется; с курсом — переводится в KZT', () => {
    const without = calculateCategoryBreakdown(data, accounts, {}, 2026)
    expect(without.skippedCurrencies).toEqual(['USD'])
    expect(without.total).toBe(10500)
    const withRate = calculateCategoryBreakdown(data, accounts, { USD: 500 }, 2026)
    expect(withRate.skippedCurrencies).toEqual([])
    expect(withRate.rows.find((x) => x.categoryId === 'food')!.amount).toBe(9000)
  })

  it('одинаковые суммы — по id, «без категории» в конце', () => {
    const r = calculateCategoryBreakdown(
      [tx({ amount: 100 }), tx({ amount: 100, categoryId: 'b' }), tx({ amount: 100, categoryId: 'a' })],
      accounts, {}, 2026,
    )
    expect(r.rows.map((x) => x.categoryId)).toEqual(['a', 'b', null])
  })

  it('нулевые суммы (из внешнего файла) не ломают доли: итог 0, доли 0', () => {
    const r = calculateCategoryBreakdown([tx({ amount: 0, categoryId: 'a' }), tx({ amount: 0 })], accounts, {}, 2026)
    expect(r.total).toBe(0)
    expect(r.rows.map((x) => [x.categoryId, x.amount, x.share])).toEqual([['a', 0, 0], [null, 0, 0]])
  })

  it('суммы округляются до копеек, итог не расходится с годовой сводкой', () => {
    const many = [
      tx({ date: '2026-05-01', amount: 0.1, categoryId: 'a' }),
      tx({ date: '2026-05-02', amount: 0.2, categoryId: 'a' }),
      tx({ date: '2026-05-03', amount: 33.33, accountId: 'u', categoryId: 'b' }),
      tx({ date: '2026-06-03', amount: 12, categoryId: 'c' }),
    ]
    const rates = { USD: 481.37 }
    const r = calculateCategoryBreakdown(many, accounts, rates, 2026)
    expect(r.rows.find((x) => x.categoryId === 'a')!.amount).toBe(0.3)
    const summaryTotal = sumYear(calculateYearSummary(many, accounts, rates, 2026)).expense
    expect(r.total).toBe(summaryTotal)
    const may = calculateCategoryBreakdown(many, accounts, rates, 2026, 5).total
    expect(may).toBe(calculateYearSummary(many, accounts, rates, 2026)[4].expense)
  })
})
