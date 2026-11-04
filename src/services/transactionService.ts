import { db, type Transaction } from '../db/schema'
import {
  applyToDebt,
  applyToGoal,
  getBalanceDeltas,
  round2,
  validateNewTransaction,
  type NewTransaction,
} from '../domain/finance'

const TX_TABLES = [db.accounts, db.transactions, db.debts, db.goals]

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
  })
  return record.id
}

/** Атомарно откатывает баланс(ы), долг/цель и удаляет транзакцию. */
export async function deleteTransaction(id: string): Promise<void> {
  await db.transaction('rw', TX_TABLES, async () => {
    const tx = await db.transactions.get(id)
    if (!tx) return
    await applyAccountDeltas(getBalanceDeltas(tx, -1))
    await applyLinked(tx, -1)
    await db.transactions.delete(id)
  })
}
