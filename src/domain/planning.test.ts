import { describe, expect, it } from 'vitest'
import type { Account, FinancialGoal, Transaction } from '../db/schema'
import {
  amountFieldError, buildCalendar, calculateGoalPlan, daysBetween, debtFieldErrors, getFirstTrackedDate, goalFieldErrors,
  isCalendarDayInteractive, nextCalendarDate, nextDueDate, validateDebtInput, validateGoalInput, type DebtInput,
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

describe('isCalendarDayInteractive', () => {
  it('только clean и spent', () => {
    expect(isCalendarDayInteractive('clean')).toBe(true)
    expect(isCalendarDayInteractive('spent')).toBe(true)
    expect(isCalendarDayInteractive('future')).toBe(false)
    expect(isCalendarDayInteractive('untracked')).toBe(false)
  })
})

describe('nextCalendarDate', () => {
  // ноябрь 2026: учёт с 3-го, сегодня 10-е
  const first = '2026-11-01'
  const last = '2026-11-30'
  const ok = (d: string) => d >= '2026-11-03' && d <= '2026-11-10'
  const go = (from: string, key: string) => nextCalendarDate(from, key, ok, first, last)

  it('стрелки влево и вправо — соседний день', () => {
    expect(go('2026-11-05', 'ArrowRight')).toBe('2026-11-06')
    expect(go('2026-11-05', 'ArrowLeft')).toBe('2026-11-04')
  })
  it('вверх и вниз — неделя назад и вперёд', () => {
    expect(go('2026-11-10', 'ArrowUp')).toBe('2026-11-03')
    expect(go('2026-11-03', 'ArrowDown')).toBe('2026-11-10')
  })
  it('на краю доступных дней остаётся на месте (undefined)', () => {
    expect(go('2026-11-10', 'ArrowRight')).toBeUndefined()
    expect(go('2026-11-03', 'ArrowLeft')).toBeUndefined()
    expect(go('2026-11-05', 'ArrowDown')).toBeUndefined() // 12-е — будущее
    expect(go('2026-11-05', 'ArrowUp')).toBeUndefined() // 29 октября — вне месяца
  })
  it('неинтерактивные дни пропускаются в том же направлении', () => {
    const gaps = (d: string) => ok(d) && d !== '2026-11-06'
    expect(nextCalendarDate('2026-11-05', 'ArrowRight', gaps, first, last)).toBe('2026-11-07')
    expect(nextCalendarDate('2026-11-07', 'ArrowLeft', gaps, first, last)).toBe('2026-11-05')
  })
  it('Home и End — первый и последний доступный день месяца', () => {
    expect(go('2026-11-05', 'Home')).toBe('2026-11-03')
    expect(go('2026-11-05', 'End')).toBe('2026-11-10')
    expect(nextCalendarDate('2026-11-05', 'Home', () => false, first, last)).toBeUndefined()
  })
  it('другие клавиши — undefined', () => {
    expect(go('2026-11-05', 'Enter')).toBeUndefined()
    expect(go('2026-11-05', 'a')).toBeUndefined()
  })
})

describe('debtFieldErrors', () => {
  const ok: DebtInput = { name: 'Кредит', totalAmount: 1000, remainingAmount: 800, monthlyPayment: 100, dueDay: 15 }
  it('корректный долг — без ошибок', () => expect(debtFieldErrors(ok)).toEqual({}))
  it('ошибки по полям, все сразу, в порядке проверок', () => {
    const e = debtFieldErrors({ name: '', totalAmount: NaN, remainingAmount: NaN, monthlyPayment: 0, dueDay: 40, interestRate: -1 })
    expect(Object.keys(e)).toEqual(['name', 'totalAmount', 'remainingAmount', 'monthlyPayment', 'dueDay', 'interestRate'])
  })
  it('остаток больше суммы — ошибка у остатка, а не у суммы', () => {
    expect(Object.keys(debtFieldErrors({ ...ok, remainingAmount: 2000 }))).toEqual(['remainingAmount'])
  })
  it('бесконечность — не число (spec/02)', () => {
    const e = debtFieldErrors({ ...ok, totalAmount: Infinity, remainingAmount: Infinity, monthlyPayment: Infinity, interestRate: Infinity })
    expect(Object.keys(e)).toEqual(['totalAmount', 'remainingAmount', 'monthlyPayment', 'interestRate'])
  })
  it('validateDebtInput возвращает первую из них', () => {
    expect(validateDebtInput({ ...ok, name: '', dueDay: 99 })).toBe('Укажите название')
  })
})

describe('goalFieldErrors', () => {
  const g = { title: 'Отпуск', targetAmount: 100000, targetDate: '2027-01-01' }
  it('корректная цель — без ошибок', () => expect(goalFieldErrors(g, '2026-11-04')).toEqual({}))
  it('ошибки по полям', () => {
    expect(Object.keys(goalFieldErrors({ title: ' ', targetAmount: 0, targetDate: '' }, '2026-11-04'))).toEqual(['title', 'targetAmount', 'targetDate'])
    expect(Object.keys(goalFieldErrors({ ...g, targetDate: '2026-11-03' }, '2026-11-04'))).toEqual(['targetDate'])
  })
  it('бесконечная сумма — ошибка', () => expect(Object.keys(goalFieldErrors({ ...g, targetAmount: Infinity }, '2026-11-04'))).toEqual(['targetAmount']))
})

describe('amountFieldError', () => {
  it('сумма должна быть больше нуля', () => {
    expect(amountFieldError(0)).toMatch(/больше нуля/)
    expect(amountFieldError(NaN)).toMatch(/больше нуля/)
    expect(amountFieldError(-5)).toMatch(/больше нуля/)
    expect(amountFieldError(Infinity)).toMatch(/больше нуля/)
    expect(amountFieldError(-Infinity)).toMatch(/больше нуля/)
    expect(amountFieldError(1)).toBeUndefined()
  })
  it('платёж не больше остатка долга', () => {
    expect(amountFieldError(500, 400)).toMatch(/больше остатка/)
    expect(amountFieldError(400, 400)).toBeUndefined()
  })
})
