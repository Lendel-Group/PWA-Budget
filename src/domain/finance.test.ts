import { describe, expect, it } from 'vitest'
import type { Account, BudgetLimit, Debt, FinancialGoal, Transaction } from '../db/schema'
import {
  accountsMissingRates, applyToDebt, applyToGoal, calculateCategoryTotals, calculateDailyAllowance,
  calculateNetWorth, calculateNoSpendStreak, getBalanceDeltas, getDatesWithExpenses, round2,
  MAX_STREAK_DAYS, validateNewTransaction, type NewTransaction, convertToKzt, calculateExpensesKzt,
  sumPlannedLimits, getAllowanceStatus,
} from './finance'

const acc = (o: Partial<Account>): Account => ({
  id: 'a', name: 'A', type: 'card', currency: 'KZT', initialBalance: 0, currentBalance: 0,
  isArchived: false, createdAt: '', ...o,
})
const tx = (o: Partial<Transaction>): Transaction => ({
  id: 't', date: '2026-11-01', timestamp: 0, type: 'expense', accountId: 'a', amount: 1,
  isExcludedFromNoSpend: false, ...o,
})
const ntx = (o: Partial<NewTransaction>): NewTransaction => ({
  date: '2026-11-01', type: 'expense', accountId: 'a', amount: 10, isExcludedFromNoSpend: false, categoryId: 'c', ...o,
})

describe('round2', () => {
  it('fixes float drift', () => expect(round2(0.1 + 0.2)).toBe(0.3))
})

describe('calculateDailyAllowance', () => {
  it('splits remaining budget over days (floored)', () => expect(calculateDailyAllowance(100000, 40000, 20)).toBe(3000))
  it('floors fractions', () => expect(calculateDailyAllowance(100, 0, 3)).toBe(33))
  it('returns 0 when no days left', () => expect(calculateDailyAllowance(1000, 0, 0)).toBe(0))
  it('returns 0 when daysLeft negative', () => expect(calculateDailyAllowance(1000, 0, -2)).toBe(0))
  it('returns 0 on overspend', () => expect(calculateDailyAllowance(1000, 1500, 5)).toBe(0))
  it('returns 0 when exactly spent', () => expect(calculateDailyAllowance(1000, 1000, 5)).toBe(0))
  it('returns 0 for empty budget', () => expect(calculateDailyAllowance(0, 0, 5)).toBe(0))
})

describe('calculateNoSpendStreak', () => {
  it('empty set: whole month clean, streak capped', () => {
    const r = calculateNoSpendStreak(new Set(), '2026-11-04')
    expect(r.cleanDaysThisMonth).toBe(4)
    expect(r.currentStreak).toBe(MAX_STREAK_DAYS)
  })
  it('counts days since last expense', () => {
    const r = calculateNoSpendStreak(new Set(['2026-11-01']), '2026-11-04')
    expect(r).toEqual({ currentStreak: 3, cleanDaysThisMonth: 3 })
  })
  it('expense today resets streak to 0', () => {
    const r = calculateNoSpendStreak(new Set(['2026-11-04']), '2026-11-04')
    expect(r.currentStreak).toBe(0)
  })
  it('streak crosses month boundary', () => {
    const r = calculateNoSpendStreak(new Set(['2026-10-28']), '2026-11-02')
    expect(r.currentStreak).toBe(5)
    expect(r.cleanDaysThisMonth).toBe(2)
  })
  it('earliestDate bounds streak and month count', () => {
    const r = calculateNoSpendStreak(new Set(), '2026-11-04', '2026-11-03')
    expect(r).toEqual({ currentStreak: 2, cleanDaysThisMonth: 2 })
  })
  it('earliestDate before month start does not extend month count', () => {
    const r = calculateNoSpendStreak(new Set(), '2026-11-02', '2026-10-30')
    expect(r).toEqual({ currentStreak: 4, cleanDaysThisMonth: 2 })
  })
})

describe('getDatesWithExpenses', () => {
  it('ignores income, transfers and excluded expenses', () => {
    const set = getDatesWithExpenses([
      tx({ date: '2026-11-01' }),
      tx({ date: '2026-11-02', isExcludedFromNoSpend: true }),
      tx({ date: '2026-11-03', type: 'income' }),
      tx({ date: '2026-11-04', type: 'transfer' }),
    ])
    expect([...set]).toEqual(['2026-11-01'])
  })
  it('empty input', () => expect(getDatesWithExpenses([]).size).toBe(0))
})

describe('calculateCategoryTotals', () => {
  it('empty', () => expect(calculateCategoryTotals([])).toEqual({}))
  it('sums expenses per category, skips others', () => {
    expect(calculateCategoryTotals([
      tx({ categoryId: 'x', amount: 0.1 }),
      tx({ categoryId: 'x', amount: 0.2 }),
      tx({ categoryId: 'y', amount: 5 }),
      tx({ categoryId: 'x', type: 'income', amount: 99 }),
      tx({ amount: 7 }),
    ])).toEqual({ x: 0.3, y: 5 })
  })
})

describe('calculateNetWorth', () => {
  it('empty', () => expect(calculateNetWorth([])).toBe(0))
  it('sums KZT, skips archived', () => {
    expect(calculateNetWorth([acc({ currentBalance: 100 }), acc({ currentBalance: 50, isArchived: true })])).toBe(100)
  })
  it('converts with rates, skips currencies without rate', () => {
    const accounts = [
      acc({ currentBalance: 100 }),
      acc({ currency: 'USD', currentBalance: 2 }),
      acc({ currency: 'EUR', currentBalance: 10 }),
    ]
    expect(calculateNetWorth(accounts, { USD: 500 })).toBe(1100)
    expect(accountsMissingRates(accounts, { USD: 500 }).map((a) => a.currency)).toEqual(['EUR'])
    expect(accountsMissingRates([acc({ currency: 'RUB', isArchived: true })])).toEqual([])
  })
})

describe('validateNewTransaction', () => {
  it('accepts valid', () => expect(() => validateNewTransaction(ntx({}))).not.toThrow())
  it('requires a category for expense and income, not for transfer, debt or goal payments', () => {
    const none = { categoryId: undefined }
    expect(() => validateNewTransaction(ntx(none))).toThrow(/категорию/)
    expect(() => validateNewTransaction(ntx({ ...none, type: 'income' }))).toThrow(/категорию/)
    expect(() => validateNewTransaction(ntx({ ...none, type: 'transfer', toAccountId: 'b' }))).not.toThrow()
    expect(() => validateNewTransaction(ntx({ ...none, debtId: 'd' }))).not.toThrow()
    expect(() => validateNewTransaction(ntx({ ...none, goalId: 'g' }))).not.toThrow()
  })
  it.each([0, -5, NaN, Infinity])('rejects amount %s', (amount) => {
    expect(() => validateNewTransaction(ntx({ amount }))).toThrow()
  })
  it('transfer needs a distinct target', () => {
    expect(() => validateNewTransaction(ntx({ type: 'transfer' }))).toThrow(/зачисления/)
    expect(() => validateNewTransaction(ntx({ type: 'transfer', toAccountId: 'a' }))).toThrow(/различаться/)
    expect(() => validateNewTransaction(ntx({ type: 'transfer', toAccountId: 'b' }))).not.toThrow()
  })
  it('validates toAmount', () => {
    expect(() => validateNewTransaction(ntx({ type: 'transfer', toAccountId: 'b', toAmount: 0 }))).toThrow()
    expect(() => validateNewTransaction(ntx({ type: 'transfer', toAccountId: 'b', toAmount: 5 }))).not.toThrow()
  })
  it('debt/goal link only for expenses', () => {
    expect(() => validateNewTransaction(ntx({ type: 'income', debtId: 'd' }))).toThrow()
    expect(() => validateNewTransaction(ntx({ type: 'income', goalId: 'g' }))).toThrow()
    expect(() => validateNewTransaction(ntx({ debtId: 'd' }))).not.toThrow()
  })
})

describe('getBalanceDeltas', () => {
  it('expense / income', () => {
    expect(getBalanceDeltas(tx({ amount: 10 }))).toEqual([{ accountId: 'a', delta: -10 }])
    expect(getBalanceDeltas(tx({ type: 'income', amount: 10 }))).toEqual([{ accountId: 'a', delta: 10 }])
    expect(getBalanceDeltas(tx({ amount: 10 }), -1)).toEqual([{ accountId: 'a', delta: 10 }])
  })
  it('transfer with and without toAmount', () => {
    const t = tx({ type: 'transfer', toAccountId: 'b', amount: 10 })
    expect(getBalanceDeltas(t)).toEqual([{ accountId: 'a', delta: -10 }, { accountId: 'b', delta: 10 }])
    expect(getBalanceDeltas({ ...t, toAmount: 2 }, -1)).toEqual([
      { accountId: 'a', delta: 10 }, { accountId: 'b', delta: -2 },
    ])
  })
})

const debt = (o: Partial<Debt> = {}): Debt => ({
  id: 'd', name: 'D', totalAmount: 100, remainingAmount: 100, monthlyPayment: 10, dueDay: 1,
  createdAt: '', isClosed: false, ...o,
})
const goal = (o: Partial<FinancialGoal> = {}): FinancialGoal => ({
  id: 'g', title: 'G', targetAmount: 100, currentAmount: 0, targetDate: '2027-01-01', icon: '',
  color: '', isAchieved: false, ...o,
})

describe('applyToDebt', () => {
  it('reduces remaining', () => expect(applyToDebt(debt(), 30)).toMatchObject({ remainingAmount: 70, isClosed: false }))
  it('closes at zero', () => expect(applyToDebt(debt(), 100)).toMatchObject({ remainingAmount: 0, isClosed: true }))
  it('rejects overpayment', () => expect(() => applyToDebt(debt(), 101)).toThrow())
  it('rollback reopens', () => {
    expect(applyToDebt(debt({ remainingAmount: 0, isClosed: true }), -30)).toMatchObject({ remainingAmount: 30, isClosed: false })
  })
})

describe('applyToGoal', () => {
  it('adds', () => expect(applyToGoal(goal(), 40)).toMatchObject({ currentAmount: 40, isAchieved: false }))
  it('achieves at target', () => expect(applyToGoal(goal({ currentAmount: 90 }), 10).isAchieved).toBe(true))
  it('rollback un-achieves', () => {
    expect(applyToGoal(goal({ currentAmount: 100, isAchieved: true }), -10).isAchieved).toBe(false)
  })
})

describe('convertToKzt', () => {
  it('KZT passthrough, converts, or undefined without rate', () => {
    expect(convertToKzt(5, 'KZT')).toBe(5)
    expect(convertToKzt(2, 'USD', { USD: 450 })).toBe(900)
    expect(convertToKzt(2, 'USD')).toBeUndefined()
  })
})

describe('calculateExpensesKzt', () => {
  const accounts = [acc({ id: 'k' }), acc({ id: 'u', currency: 'USD' })]
  it('empty', () => expect(calculateExpensesKzt([], accounts)).toBe(0))
  it('sums expenses with conversion; skips income, transfers, goals, unknown accounts, missing rates', () => {
    const txs = [
      tx({ accountId: 'k', amount: 100 }),
      tx({ accountId: 'u', amount: 2 }),
      tx({ accountId: 'k', type: 'income', amount: 999 }),
      tx({ accountId: 'k', type: 'transfer', amount: 999 }),
      tx({ accountId: 'k', amount: 500, goalId: 'g' }),
      tx({ accountId: 'ghost', amount: 7 }),
    ]
    expect(calculateExpensesKzt(txs, accounts, { USD: 450 })).toBe(1000)
    expect(calculateExpensesKzt(txs, accounts)).toBe(100)
  })
})

describe('sumPlannedLimits', () => {
  it('sums', () => {
    const l = (plannedAmount: number): BudgetLimit => ({ id: 'x', year: 2026, month: 11, categoryId: 'c', plannedAmount })
    expect(sumPlannedLimits([])).toBe(0)
    expect(sumPlannedLimits([l(0.1), l(0.2)])).toBe(0.3)
  })
})

describe('getAllowanceStatus', () => {
  it.each([[5000, 'green'], [2001, 'green'], [2000, 'yellow'], [1, 'yellow'], [0, 'red']])('%s → %s', (v, s) => {
    expect(getAllowanceStatus(v)).toBe(s)
  })
})
