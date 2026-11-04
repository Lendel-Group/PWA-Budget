import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, type Account } from '../db/schema'
import { addTransaction, deleteTransaction } from './transactionService'

const account = (id: string, balance = 1000, currency: Account['currency'] = 'KZT'): Account => ({
  id, name: id, type: 'card', currency, initialBalance: balance, currentBalance: balance,
  isArchived: false, createdAt: '',
})
const base = { date: '2026-11-04', isExcludedFromNoSpend: false, categoryId: 'cat' }

beforeEach(async () => {
  await Promise.all([db.accounts.clear(), db.transactions.clear(), db.debts.clear(), db.goals.clear()])
  await db.accounts.bulkAdd([account('a'), account('b', 0, 'USD')])
})

const balance = async (id: string) => (await db.accounts.get(id))!.currentBalance

describe('transactionService', () => {
  it('expense + delete round-trip', async () => {
    const id = await addTransaction({ ...base, type: 'expense', accountId: 'a', amount: 250.5 })
    expect(await balance('a')).toBe(749.5)
    await deleteTransaction(id)
    expect(await balance('a')).toBe(1000)
    expect(await db.transactions.count()).toBe(0)
  })

  it('income increases balance', async () => {
    await addTransaction({ ...base, type: 'income', accountId: 'a', amount: 100 })
    expect(await balance('a')).toBe(1100)
  })

  it('cross-currency transfer uses toAmount', async () => {
    const id = await addTransaction({ ...base, type: 'transfer', accountId: 'a', toAccountId: 'b', amount: 500, toAmount: 1 })
    expect([await balance('a'), await balance('b')]).toEqual([500, 1])
    await deleteTransaction(id)
    expect([await balance('a'), await balance('b')]).toEqual([1000, 0])
  })

  it('has no lost updates under concurrency', async () => {
    await Promise.all(Array.from({ length: 50 }, () => addTransaction({ ...base, type: 'expense', accountId: 'a', amount: 10 })))
    expect(await balance('a')).toBe(500)
    expect(await db.transactions.count()).toBe(50)
  })

  it('rolls back everything if a step fails', async () => {
    await expect(addTransaction({ ...base, type: 'expense', accountId: 'a', amount: 10, debtId: 'missing' })).rejects.toThrow()
    expect(await balance('a')).toBe(1000)
    expect(await db.transactions.count()).toBe(0)
  })

  it('rejects expense and income without a category, without touching balances', async () => {
    const noCategory = { date: base.date, isExcludedFromNoSpend: false, accountId: 'a', amount: 10 }
    await expect(addTransaction({ ...noCategory, type: 'expense' })).rejects.toThrow(/категорию/)
    await expect(addTransaction({ ...noCategory, type: 'income' })).rejects.toThrow(/категорию/)
    expect(await balance('a')).toBe(1000)
    expect(await db.transactions.count()).toBe(0)
  })

  it('rejects unknown account', async () => {
    await expect(addTransaction({ ...base, type: 'expense', accountId: 'zzz', amount: 1 })).rejects.toThrow(/Счёт/)
  })

  it('debt payment reduces account and debt atomically; delete reverts', async () => {
    await db.debts.add({ id: 'd', name: 'D', totalAmount: 1000, remainingAmount: 1000, monthlyPayment: 100, dueDay: 5, createdAt: '', isClosed: false })
    const id = await addTransaction({ ...base, type: 'expense', accountId: 'a', amount: 400, debtId: 'd', isExcludedFromNoSpend: true })
    expect(await balance('a')).toBe(600)
    expect((await db.debts.get('d'))!.remainingAmount).toBe(600)
    await deleteTransaction(id)
    expect((await db.debts.get('d'))!.remainingAmount).toBe(1000)
    await expect(addTransaction({ ...base, type: 'expense', accountId: 'a', amount: 1001, debtId: 'd' })).rejects.toThrow()
    expect(await balance('a')).toBe(1000)
  })

  it('goal top-up', async () => {
    await db.goals.add({ id: 'g', title: 'G', targetAmount: 300, currentAmount: 0, targetDate: '2027-01-01', icon: '', color: '', isAchieved: false })
    await addTransaction({ ...base, type: 'expense', accountId: 'a', amount: 300, goalId: 'g', isExcludedFromNoSpend: true })
    expect(await db.goals.get('g')).toMatchObject({ currentAmount: 300, isAchieved: true })
    expect(await balance('a')).toBe(700)
  })

  it('missing goal fails; deleting unknown id is a no-op', async () => {
    await expect(addTransaction({ ...base, type: 'expense', accountId: 'a', amount: 1, goalId: 'nope' })).rejects.toThrow(/Цель/)
    await expect(deleteTransaction('nope')).resolves.toBeUndefined()
  })
})
