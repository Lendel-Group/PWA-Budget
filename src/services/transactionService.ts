import { db, type Transaction } from '../db/schema'
import {
  applyToDebt,
  applyToGoal,
  getBalanceDeltas,
  round2,
  validateNewTransaction,
  type NewTransaction,
} from '../domain/finance'

const TX_TABLES = [db.accounts, db.transactions, db.debts, db.goals, db.config]

async function applyAccountDeltas(deltas: { accountId: string; delta: number }[]) {
  for (const { accountId, delta } of deltas) {
    const account = await db.accounts.get(accountId)
    if (!account) throw new Error(`Счёт не найден: ${accountId}`)
    await db.accounts.update(accountId, { currentBalance: round2(account.currentBalance + delta) })
  }
}

async function applyLinked(tx: Pick<Transaction, 'debtId' | 'goalId' | 'amount'>, sign: 1 | -1) {
  if (tx.debtId) {
    const debt = await db.debts.get(tx.debtId)
    if (!debt) throw new Error(`Долг не найден: ${tx.debtId}`)
    await db.debts.put(applyToDebt(debt, sign * tx.amount))
  }
  if (tx.goalId) {
    const goal = await db.goals.get(tx.goalId)
    if (!goal) throw new Error(`Цель не найдена: ${tx.goalId}`)
    await db.goals.put(applyToGoal(goal, sign * tx.amount))
  }
}

/** Атомарно меняет баланс(ы) и добавляет транзакцию. */
export async function addTransaction(tx: NewTransaction): Promise<string> {
  validateNewTransaction(tx)
  const record: Transaction = { ...tx, id: crypto.randomUUID(), timestamp: Date.now() }
  await db.transaction('rw', TX_TABLES, async () => {
    await applyAccountDeltas(getBalanceDeltas(record))
    await applyLinked(record, 1)
    await db.transactions.add(record)
    await db.config.put({ key: 'last_account_id', value: record.accountId })
  })
  return record.id
}

/** Счёт последней добавленной операции (форма «+» предвыбирает его); `undefined`, если операций ещё не было. */
export async function getLastAccountId(): Promise<string | undefined> {
  const value = (await db.config.get('last_account_id'))?.value
  return typeof value === 'string' ? value : undefined
}

/**
 * Атомарно заменяет содержимое операции: откатывает эффект старой версии (балансы, долг/цель)
 * и применяет новую — всё в одной транзакции БД, при любой ошибке не меняется ничего.
 * id и timestamp сохраняются (порядок внутри дня). Связь с долгом/целью менять нельзя;
 * такие операции остаются расходом со счёта в тенге.
 */
export async function updateTransaction(id: string, next: NewTransaction): Promise<void> {
  validateNewTransaction(next)
  await db.transaction('rw', TX_TABLES, async () => {
    const old = await db.transactions.get(id)
    if (!old) throw new Error('Операция не найдена')
    if (next.debtId !== old.debtId || next.goalId !== old.goalId) {
      throw new Error('Связь с долгом или целью изменить нельзя')
    }
    if (next.debtId || next.goalId) {
      const account = await db.accounts.get(next.accountId)
      if (account && account.currency !== 'KZT') throw new Error('Долги и цели ведутся в тенге — выберите счёт в KZT')
    }
    await applyAccountDeltas(getBalanceDeltas(old, -1))
    await applyLinked(old, -1)
    const record: Transaction = { ...next, id, timestamp: old.timestamp }
    await applyAccountDeltas(getBalanceDeltas(record))
    await applyLinked(record, 1)
    await db.transactions.put(record)
  })
}

/** Атомарно откатывает баланс(ы), долг/цель и удаляет транзакцию; возвращает удалённую запись (для отмены). */
export async function deleteTransaction(id: string): Promise<Transaction | undefined> {
  return db.transaction('rw', TX_TABLES, async () => {
    const tx = await db.transactions.get(id)
    if (!tx) return undefined
    await applyAccountDeltas(getBalanceDeltas(tx, -1))
    await applyLinked(tx, -1)
    await db.transactions.delete(id)
    return tx
  })
}

/**
 * Возвращает удалённую операцию как была (тот же id и timestamp) и заново применяет её эффект
 * к балансам, долгу и цели — в одной транзакции БД. Если операция уже на месте, ничего не делает.
 */
export async function restoreTransaction(tx: Transaction): Promise<void> {
  await db.transaction('rw', TX_TABLES, async () => {
    if (await db.transactions.get(tx.id)) return
    await applyAccountDeltas(getBalanceDeltas(tx))
    await applyLinked(tx, 1)
    await db.transactions.add(tx)
  })
}
