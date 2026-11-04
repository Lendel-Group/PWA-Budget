import { describe, expect, it } from 'vitest'
import type { Account, FinancialGoal, Transaction } from '../db/schema'
import {
  buildCalendar, calculateGoalPlan, daysBetween, getFirstTrackedDate, nextDueDate, validateDebtInput,
  validateGoalInput, type DebtInput,
} from './planning'

describe('daysBetween / nextDueDate', () => {
  it('daysBetween', () => {
    expect(daysBetween('2026-11-04', '2026-11-10')).toBe(6)
    expect(daysBetween('2026-11-04', '2026-11-01')).toBe(-3)
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1)
  })
  it('due later this month, today, or next month', () => {
    expect(nextDueDate('2026-11-04', 15)).toBe('2026-11-15')
    expect(nextDueDate('2026-11-04', 4)).toBe('2026-11-04')
    expect(nextDueDate('2026-11-04', 2)).toBe('2026-12-02')
  })
  it('clamps day 31 and wraps the year', () => {
    expect(nextDueDate('2026-02-10', 31)).toBe('2026-02-28')
    expect(nextDueDate('2026-02-28', 31)).toBe('2026-02-28')
    expect(nextDueDate('2026-12-20', 5)).toBe('2027-01-05')
    expect(nextDueDate('2026-04-30', 31)).toBe('2026-04-30')
    expect(nextDueDate('2026-01-31', 15)).toBe('2026-02-15')
  })
})

const goal = (o: Partial<FinancialGoal> = {}): FinancialGoal => ({
  id: 'g', title: 'G', targetAmount: 120000, currentAmount: 0, targetDate: '2027-11-04', icon: '', color: '', isAchieved: false, ...o,
})

describe('calculateGoalPlan', () => {
  it('splits the remainder over months', () => {
    const p = calculateGoalPlan(goal(), '2026-11-04')
    expect(p).toMatchObject({ remaining: 120000, daysLeft: 365 })
    expect(p.perMonth).toBe(10000)
  })
  it('treats less than a month as one month', () => {
    expect(calculateGoalPlan(goal({ targetDate: '2026-11-10' }), '2026-11-04').perMonth).toBe(120000)
  })
  it('past deadline still asks for the whole remainder', () => {
    expect(calculateGoalPlan(goal({ targetDate: '2026-10-01' }), '2026-11-04').perMonth).toBe(120000)
  })
  it('achieved goal needs nothing', () => {
    expect(calculateGoalPlan(goal({ currentAmount: 130000 }), '2026-11-04')).toMatchObject({ remaining: 0, perMonth: 0 })
  })
})

const debt = (o: Partial<DebtInput> = {}): DebtInput => ({
  name: 'Кредит', totalAmount: 1000, remainingAmount: 800, monthlyPayment: 100, dueDay: 15, ...o,
})

describe('validateDebtInput', () => {
  it('accepts valid (with optional rate)', () => {
    expect(validateDebtInput(debt())).toBeUndefined()
    expect(validateDebtInput(debt({ interestRate: 0 }))).toBeUndefined()
  })
  it.each([
    [{ name: ' ' }, /название/],
    [{ totalAmount: 0 }, /Сумма долга/],
    [{ remainingAmount: 0 }, /Остаток/],
    [{ remainingAmount: 1001 }, /Остаток/],
    [{ monthlyPayment: 0 }, /платёж/],
    [{ dueDay: 0 }, /День/],
    [{ dueDay: 32 }, /День/],
    [{ dueDay: 1.5 }, /День/],
    [{ interestRate: -1 }, /Ставка/],
  ])('rejects %j', (o, re) => expect(validateDebtInput(debt(o))).toMatch(re))
})

describe('validateGoalInput', () => {
  const g = { title: 'Отпуск', targetAmount: 100, targetDate: '2026-12-01' }
  it('accepts valid, today included', () => {
    expect(validateGoalInput(g, '2026-11-04')).toBeUndefined()
    expect(validateGoalInput({ ...g, targetDate: '2026-11-04' }, '2026-11-04')).toBeUndefined()
  })
  it.each([
    [{ title: '' }, /название/],
    [{ targetAmount: 0 }, /сумма/],
    [{ targetDate: '' }, /дату/],
    [{ targetDate: '2026-11-03' }, /дату/],
  ])('rejects %j', (o, re) => expect(validateGoalInput({ ...g, ...o }, '2026-11-04')).toMatch(re))
})

describe('getFirstTrackedDate', () => {
  const acc = (createdAt: string) => ({ createdAt }) as Account
  const tx = (date: string) => ({ date }) as Transaction
  it('fallback when empty', () => expect(getFirstTrackedDate([], [], '2026-11-04')).toBe('2026-11-04'))
  it('earliest of accounts and transactions', () => {
    expect(getFirstTrackedDate([acc('2026-11-02T10:00:00Z')], [tx('2026-10-30'), tx('2026-11-03')], 'x')).toBe('2026-10-30')
    expect(getFirstTrackedDate([acc('2026-10-01T00:00:00Z')], [tx('2026-11-03')], 'x')).toBe('2026-10-01')
  })
})

describe('buildCalendar', () => {
  it('Nov 2026 starts on Sunday (6 empty cells), pads to full weeks', () => {
    const weeks = buildCalendar(2026, 11, '2026-11-10', new Set(['2026-11-08']), '2026-11-03')
    expect(weeks[0].slice(0, 6).every((c) => c === null)).toBe(true)
    expect(weeks[0][6]).toMatchObject({ date: '2026-11-01', state: 'untracked' })
    expect(weeks.every((w) => w.length === 7)).toBe(true)
    const days = weeks.flat().filter((c) => c !== null)
    expect(days).toHaveLength(30)
    const by = (d: number) => days.find((c) => c.day === d)!
    expect(by(3).state).toBe('clean')
    expect(by(8).state).toBe('spent')
    expect(by(10)).toMatchObject({ state: 'clean', isToday: true })
    expect(by(11).state).toBe('future')
  })
  it('month starting on Monday has no leading blanks', () => {
    const weeks = buildCalendar(2026, 6, '2026-06-30', new Set(), '2026-01-01')
    expect(weeks[0][0]).toMatchObject({ day: 1 })
    expect(weeks.at(-1)!.at(-1)).toBeNull()
  })
})
