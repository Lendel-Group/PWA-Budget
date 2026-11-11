import type { Account, FinancialGoal, Transaction } from '../db/schema'
import { addDays, clampDueDay, daysInMonth, parseDate } from './dates'
import { round2 } from './finance'

const pad = (n: number) => String(n).padStart(2, '0')

/** Целое число дней между датами YYYY-MM-DD (b − a). */
export function daysBetween(a: string, b: string): number {
  const pa = parseDate(a)
  const pb = parseDate(b)
  return Math.round((Date.UTC(pb.year, pb.month - 1, pb.day) - Date.UTC(pa.year, pa.month - 1, pa.day)) / 86_400_000)
}

/** Ближайшая дата платежа (включая сегодня) для dueDay с учётом длины месяца. */
export function nextDueDate(today: string, dueDay: number): string {
  const { year, month, day } = parseDate(today)
  if (clampDueDay(year, month, dueDay) >= day) return `${year}-${pad(month)}-${pad(clampDueDay(year, month, dueDay))}`
  const ny = month === 12 ? year + 1 : year
  const nm = month === 12 ? 1 : month + 1
  return `${ny}-${pad(nm)}-${pad(clampDueDay(ny, nm, dueDay))}`
}

export interface GoalPlan {
  remaining: number
  daysLeft: number
  /** Сколько откладывать в месяц, чтобы успеть к targetDate. */
  perMonth: number
}

export function calculateGoalPlan(goal: FinancialGoal, today: string): GoalPlan {
  const remaining = Math.max(0, round2(goal.targetAmount - goal.currentAmount))
  const daysLeft = daysBetween(today, goal.targetDate)
  const months = Math.max(1, Math.ceil(daysLeft / 30.44))
  return { remaining, daysLeft, perMonth: remaining === 0 ? 0 : Math.ceil(remaining / months) }
}

export interface DebtInput { name: string; totalAmount: number; remainingAmount: number; monthlyPayment: number; dueDay: number; interestRate?: number }
export interface GoalInput { title: string; targetAmount: number; targetDate: string }

export type DebtField = 'name' | 'totalAmount' | 'remainingAmount' | 'monthlyPayment' | 'dueDay' | 'interestRate'
export type GoalField = 'title' | 'targetAmount' | 'targetDate'

/** Ошибки по полям формы долга (нет ключа — поле в порядке); суммы и ставка — конечные числа (budget-spec, spec/02). Порядок ключей — порядок проверок. */
export function debtFieldErrors(d: DebtInput): Partial<Record<DebtField, string>> {
  const errors: Partial<Record<DebtField, string>> = {}
  if (!d.name.trim()) errors.name = 'Укажите название'
  if (!Number.isFinite(d.totalAmount) || !(d.totalAmount > 0)) errors.totalAmount = 'Сумма долга должна быть больше нуля'
  if (!Number.isFinite(d.remainingAmount) || !(d.remainingAmount > 0) || d.remainingAmount > d.totalAmount) errors.remainingAmount = 'Остаток должен быть больше нуля и не больше суммы долга'
  if (!Number.isFinite(d.monthlyPayment) || !(d.monthlyPayment > 0)) errors.monthlyPayment = 'Укажите обязательный платёж'
  if (!Number.isInteger(d.dueDay) || d.dueDay < 1 || d.dueDay > 31) errors.dueDay = 'День платежа — от 1 до 31'
  if (d.interestRate !== undefined && (!Number.isFinite(d.interestRate) || !(d.interestRate >= 0))) errors.interestRate = 'Ставка не может быть отрицательной'
  return errors
}

/** Первая ошибка или undefined. */
export const validateDebtInput = (d: DebtInput): string | undefined => Object.values(debtFieldErrors(d))[0]

/** Ошибки по полям формы цели. */
export function goalFieldErrors(g: GoalInput, today: string): Partial<Record<GoalField, string>> {
  const errors: Partial<Record<GoalField, string>> = {}
  if (!g.title.trim()) errors.title = 'Укажите название'
  if (!Number.isFinite(g.targetAmount) || !(g.targetAmount > 0)) errors.targetAmount = 'Целевая сумма должна быть больше нуля'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(g.targetDate) || g.targetDate < today) errors.targetDate = 'Выберите дату не раньше сегодняшней'
  return errors
}

export const validateGoalInput = (g: GoalInput, today: string): string | undefined => Object.values(goalFieldErrors(g, today))[0]

/** Сумма пополнения или платежа: конечная, больше нуля, а для платежа по долгу — не больше остатка (`max`). */
export function amountFieldError(amount: number, max?: number): string | undefined {
  if (!Number.isFinite(amount) || !(amount > 0)) return 'Сумма должна быть больше нуля'
  if (max !== undefined && amount > max) return 'Платёж больше остатка долга'
  return undefined
}

/** Первая дата, с которой ведётся учёт (для страйка и календаря). */
export function getFirstTrackedDate(accounts: Account[], transactions: Transaction[], fallback: string): string {
  const dates = [
    ...accounts.map((a) => a.createdAt.slice(0, 10)),
    ...transactions.map((t) => t.date),
  ]
  return dates.length === 0 ? fallback : dates.reduce((min, d) => (d < min ? d : min))
}

export type DayState = 'clean' | 'spent' | 'future' | 'untracked'

export interface CalendarDay { date: string; day: number; state: DayState; isToday: boolean }

/** Сетка месяца: недели с понедельника, null — пустые ячейки. */
export function buildCalendar(
  year: number,
  month: number,
  today: string,
  datesWithExpenses: Set<string>,
  firstTracked: string,
): (CalendarDay | null)[][] {
  const first = `${year}-${pad(month)}-01`
  const { year: fy, month: fm, day: fd } = parseDate(first)
  const offset = (new Date(Date.UTC(fy, fm - 1, fd)).getUTCDay() + 6) % 7
  const cells: (CalendarDay | null)[] = Array(offset).fill(null)
  for (let day = 1; day <= daysInMonth(year, month); day++) {
    const date = addDays(first, day - 1)
    const state: DayState =
      date > today ? 'future' : date < firstTracked ? 'untracked' : datesWithExpenses.has(date) ? 'spent' : 'clean'
    cells.push({ date, day, state, isToday: date === today })
  }
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (CalendarDay | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

/** Открыть можно только день с данными: уже наступивший и после начала учёта. */
export const isCalendarDayInteractive = (state: DayState): boolean => state === 'clean' || state === 'spent'

const CALENDAR_STEPS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }

/**
 * Куда переходит фокус в календаре по клавише: стрелки идут на день/неделю назад или вперёд, неинтерактивные дни
 * (будущие, до начала учёта) пропускаются в том же направлении; Home и End — первый и последний доступный день месяца.
 * Границы — `[first, last]` текущего месяца; если идти некуда или клавиша другая — `undefined`.
 */
export function nextCalendarDate(
  from: string,
  key: string,
  isInteractive: (date: string) => boolean,
  first: string,
  last: string,
): string | undefined {
  if (key === 'Home' || key === 'End') {
    const days: string[] = []
    for (let d = first; d <= last; d = addDays(d, 1)) if (isInteractive(d)) days.push(d)
    return key === 'Home' ? days[0] : days[days.length - 1]
  }
  const step = CALENDAR_STEPS[key]
  if (step === undefined) return undefined
  for (let d = addDays(from, step); d >= first && d <= last; d = addDays(d, step)) {
    if (isInteractive(d)) return d
  }
  return undefined
}
