import { db, type Debt, type FinancialGoal } from '../db/schema'
import {
  validateDebtInput, validateGoalInput, type DebtInput, type GoalInput,
} from '../domain/planning'
import { addTransaction } from './transactionService'

const fail = (message: string): never => { throw new Error(message) }

export async function createDebt(input: DebtInput): Promise<string> {
  const error = validateDebtInput(input)
  if (error) fail(error)
  const debt: Debt = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    totalAmount: input.totalAmount,
    remainingAmount: input.remainingAmount,
    monthlyPayment: input.monthlyPayment,
    dueDay: input.dueDay,
    ...(input.interestRate !== undefined ? { interestRate: input.interestRate } : {}),
    createdAt: new Date().toISOString(),
    isClosed: false,
  }
  await db.debts.add(debt)
  return debt.id
}

export async function createGoal(
  input: GoalInput & { icon?: string; color?: string },
  today: string,
): Promise<string> {
  const error = validateGoalInput(input, today)
  if (error) fail(error)
  const goal: FinancialGoal = {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    targetAmount: input.targetAmount,
    currentAmount: 0,
    targetDate: input.targetDate,
    icon: input.icon ?? 'Target',
    color: input.color ?? '#22c55e',
    isAchieved: false,
  }
  await db.goals.add(goal)
  return goal.id
}

async function requireKztAccount(accountId: string) {
  const account = await db.accounts.get(accountId)
  if (!account) fail('Счёт не найден')
  if (account!.currency !== 'KZT') fail('Долги и цели ведутся в тенге — выберите счёт в KZT')
}

/** Платёж по долгу: расход со счёта + уменьшение остатка (одна транзакция БД). */
export async function payDebt(debtId: string, accountId: string, amount: number, date: string): Promise<string> {
  await requireKztAccount(accountId)
  const debt = await db.debts.get(debtId)
  if (!debt) fail('Долг не найден')
  const hasCategory = !!(await db.categories.get('cat-credit'))
  return addTransaction({
    date, type: 'expense', accountId, amount, debtId,
    ...(hasCategory ? { categoryId: 'cat-credit' } : {}),
    comment: `Платёж: ${debt!.name}`,
    isExcludedFromNoSpend: true,
  })
}

/** Пополнение цели: списание со счёта + рост накопленной суммы. */
export async function topUpGoal(goalId: string, accountId: string, amount: number, date: string): Promise<string> {
  await requireKztAccount(accountId)
  const goal = await db.goals.get(goalId)
  if (!goal) fail('Цель не найдена')
  return addTransaction({
    date, type: 'expense', accountId, amount, goalId,
    comment: `Цель: ${goal!.title}`,
    isExcludedFromNoSpend: true,
  })
}

/** Удаление разрешено, только если нет связанных операций (иначе откат операции станет невозможным). */
export async function deleteDebt(id: string): Promise<void> {
  if ((await db.transactions.filter((t) => t.debtId === id).count()) > 0) {
    fail('По долгу есть платежи — сначала удалите их на главном экране')
  }
  await db.debts.delete(id)
}

export async function deleteGoal(id: string): Promise<void> {
  if ((await db.transactions.filter((t) => t.goalId === id).count()) > 0) {
    fail('В цель были пополнения — сначала удалите их на главном экране')
  }
  await db.goals.delete(id)
}
