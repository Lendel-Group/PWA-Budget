import type { Account, BudgetLimit, Currency, Debt, FinancialGoal, Transaction } from '../db/schema'
import { addDays, monthStart } from './dates'

export type Rates = Partial<Record<Currency, number>>
export type NewTransaction = Omit<Transaction, 'id' | 'timestamp'>

/** Округление денежных величин до 2 знаков (защита от float-дрейфа). */
export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

/** Свободный остаток на день. Перерасход или нет дней → 0. */
export function calculateDailyAllowance(budget: number, spent: number, daysLeft: number): number {
  if (daysLeft <= 0) return 0
  const remaining = budget - spent
  if (remaining <= 0) return 0
  return Math.floor(remaining / daysLeft)
}

/** Максимальная глубина подсчёта страйка, если нет границы earliestDate. */
export const MAX_STREAK_DAYS = 366

/**
 * Страйк дней без трат: подряд идущие дни до currentDate включительно
 * (сегодняшний день считается чистым, пока в нём нет трат).
 * earliestDate — первая дата, с которой ведётся учёт (не считаем дни до неё).
 */
export function calculateNoSpendStreak(
  datesWithExpenses: Set<string>,
  currentDate: string,
  earliestDate?: string,
): { currentStreak: number; cleanDaysThisMonth: number } {
  let currentStreak = 0
  let d = currentDate
  while (currentStreak < MAX_STREAK_DAYS && !datesWithExpenses.has(d)) {
    if (earliestDate !== undefined && d < earliestDate) break
    currentStreak++
    d = addDays(d, -1)
  }

  let cleanDaysThisMonth = 0
  const first = monthStart(currentDate)
  const lowerBound = earliestDate !== undefined && earliestDate > first ? earliestDate : first
  for (let day = lowerBound; day <= currentDate; day = addDays(day, 1)) {
    if (!datesWithExpenses.has(day)) cleanDaysThisMonth++
  }
  return { currentStreak, cleanDaysThisMonth }
}

/** Операция нарушает «день без трат»: расход без отметки «Исключить». Доходы и переводы день не нарушают. */
export const breaksNoSpendDay = (t: Pick<Transaction, 'type' | 'isExcludedFromNoSpend'>): boolean =>
  t.type === 'expense' && !t.isExcludedFromNoSpend

/** День без трат: нет расходов с isExcludedFromNoSpend === false. */
export function getDatesWithExpenses(transactions: Transaction[]): Set<string> {
  const set = new Set<string>()
  for (const t of transactions) {
    if (breaksNoSpendDay(t)) set.add(t.date)
  }
  return set
}

/** Суммы расходов по категориям. */
export function calculateCategoryTotals(transactions: Transaction[]): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const t of transactions) {
    if (t.type !== 'expense' || !t.categoryId) continue
    totals[t.categoryId] = round2((totals[t.categoryId] ?? 0) + t.amount)
  }
  return totals
}

/** Капитал в KZT. Архивные счета и счета без курса не учитываются. */
export function calculateNetWorth(accounts: Account[], rates: Rates = {}): number {
  let total = 0
  for (const a of accounts) {
    if (a.isArchived) continue
    const rate = a.currency === 'KZT' ? 1 : rates[a.currency]
    if (rate === undefined) continue
    total += a.currentBalance * rate
  }
  return round2(total)
}

/** Активные счета, для которых нет курса (их баланс не вошёл в капитал). */
export function accountsMissingRates(accounts: Account[], rates: Rates = {}): Account[] {
  return accounts.filter((a) => !a.isArchived && a.currency !== 'KZT' && rates[a.currency] === undefined)
}

/** Предел суммы по модулю (budget-spec, spec/02 «Предельные значения»): 10 цифр в целой части, как у цифровой клавиатуры. */
export const MAX_AMOUNT = 9_999_999_999.99
/** Предел курса, тенге за единицу (spec/02 «Предельные значения»). */
export const MAX_RATE = 1_000_000
export const TOO_LARGE_AMOUNT = 'Слишком большая сумма'

export function validateNewTransaction(tx: NewTransaction): void {
  if (!Number.isFinite(tx.amount) || tx.amount <= 0) throw new Error('Сумма должна быть больше нуля')
  if (tx.amount > MAX_AMOUNT) throw new Error(TOO_LARGE_AMOUNT)
  if (tx.type === 'transfer') {
    if (!tx.toAccountId) throw new Error('Не выбран счёт зачисления')
    if (tx.toAccountId === tx.accountId) throw new Error('Счета перевода должны различаться')
    if (tx.toAmount !== undefined && (!Number.isFinite(tx.toAmount) || tx.toAmount <= 0)) {
      throw new Error('Сумма зачисления должна быть больше нуля')
    }
    if (tx.toAmount !== undefined && tx.toAmount > MAX_AMOUNT) throw new Error(TOO_LARGE_AMOUNT)
  }
  if ((tx.debtId || tx.goalId) && tx.type !== 'expense') {
    throw new Error('Платёж по долгу или цели должен быть расходом')
  }
  if (tx.type !== 'transfer' && !tx.categoryId && !tx.debtId && !tx.goalId) {
    throw new Error('Выберите категорию')
  }
}

/** Изменения балансов счетов от транзакции (sign = -1 для отката). */
export function getBalanceDeltas(
  tx: Pick<Transaction, 'type' | 'accountId' | 'toAccountId' | 'amount' | 'toAmount'>,
  sign: 1 | -1 = 1,
): { accountId: string; delta: number }[] {
  if (tx.type === 'income') return [{ accountId: tx.accountId, delta: sign * tx.amount }]
  if (tx.type === 'expense') return [{ accountId: tx.accountId, delta: -sign * tx.amount }]
  return [
    { accountId: tx.accountId, delta: -sign * tx.amount },
    { accountId: tx.toAccountId as string, delta: sign * (tx.toAmount ?? tx.amount) },
  ]
}

/** Применяет платёж (amount>0) или его откат (amount<0) к долгу. */
export function applyToDebt(debt: Debt, amount: number): Debt {
  const remainingAmount = round2(debt.remainingAmount - amount)
  if (remainingAmount < 0) throw new Error('Платёж превышает остаток долга')
  return { ...debt, remainingAmount, isClosed: remainingAmount === 0 }
}

/** Применяет пополнение (amount>0) или его откат (amount<0) к цели. */
export function applyToGoal(goal: FinancialGoal, amount: number): FinancialGoal {
  const currentAmount = round2(goal.currentAmount + amount)
  return { ...goal, currentAmount, isAchieved: currentAmount >= goal.targetAmount }
}


/** Сумма в KZT; undefined, если для валюты нет курса. */
export function convertToKzt(amount: number, currency: Currency, rates: Rates = {}): number | undefined {
  if (currency === 'KZT') return amount
  const rate = rates[currency]
  return rate === undefined ? undefined : amount * rate
}

/**
 * Расходы за период в KZT. Пополнения целей — это накопления, а не траты,
 * поэтому не учитываются; платежи по долгам учитываются.
 * Операции в валюте без курса пропускаются.
 */
export function calculateExpensesKzt(
  transactions: Transaction[],
  accounts: Account[],
  rates: Rates = {},
): number {
  const currencyById = new Map(accounts.map((a) => [a.id, a.currency]))
  let total = 0
  for (const t of transactions) {
    if (t.type !== 'expense' || t.goalId) continue
    const currency = currencyById.get(t.accountId)
    if (!currency) continue
    total += convertToKzt(t.amount, currency, rates) ?? 0
  }
  return round2(total)
}

export function sumPlannedLimits(limits: BudgetLimit[]): number {
  return round2(limits.reduce((sum, l) => sum + l.plannedAmount, 0))
}

export type AllowanceStatus = 'green' | 'yellow' | 'red'
export const ALLOWANCE_GREEN_THRESHOLD = 2000

/** Зелёный > 2 000 ₸, жёлтый 1–2 000 ₸, красный — лимит исчерпан. */
export function getAllowanceStatus(allowance: number): AllowanceStatus {
  if (allowance > ALLOWANCE_GREEN_THRESHOLD) return 'green'
  return allowance >= 1 ? 'yellow' : 'red'
}
