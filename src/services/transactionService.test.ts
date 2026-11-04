import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, type Account } from '../db/schema'
import { addTransaction, deleteTransaction, getLastAccountId, restoreTransaction, updateTransaction } from './transactionService'

const account = (id: string, balance = 1000, currency: Account['currency'] = 'KZT'): Account => ({
  id, name: id, type: 'card', currency, initialBalance: balance, currentBalance: balance,
  isArchived: false, createdAt: '',
})
const base = { date: '2026-11-04', isExcludedFromNoSpend: false, categoryId: 'cat' }

beforeEach(async () => {
  await Promise.all([db.accounts.clear(), db.transactions.clear(), db.debts.clear(), db.goals.clear(), db.config.clear()])
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

  describe('getLastAccountId', () => {
    it('до первой операции — undefined, потом счёт последней добавленной', async () => {
      expect(await getLastAccountId()).toBeUndefined()
      await addTransaction({ ...base, type: 'expense', accountId: 'a', amount: 10 })
      expect(await getLastAccountId()).toBe('a')
      await addTransaction({ ...base, type: 'income', accountId: 'b', amount: 1 })
      expect(await getLastAccountId()).toBe('b')
    })

    it('для перевода запоминается счёт списания', async () => {
      await addTransaction({ ...base, type: 'transfer', accountId: 'b', toAccountId: 'a', amount: 1, toAmount: 1 })
      expect(await getLastAccountId()).toBe('b')
    })

    it('неудачное добавление не меняет запомненный счёт', async () => {
      await addTransaction({ ...base, type: 'expense', accountId: 'a', amount: 10 })
      await expect(addTransaction({ ...base, type: 'expense', accountId: 'zzz', amount: 1 })).rejects.toThrow()
      expect(await getLastAccountId()).toBe('a')
    })
  })

  describe('restoreTransaction', () => {
    it('возвращает расход: тот же id/timestamp, баланс как до удаления', async () => {
      const id = await addTransaction({ ...base, type: 'expense', accountId: 'a', amount: 250.5 })
      const before = (await db.transactions.get(id))!
      const deleted = (await deleteTransaction(id))!
      expect(deleted).toEqual(before)
      expect(await balance('a')).toBe(1000)
      await restoreTransaction(deleted)
      expect(await balance('a')).toBe(749.5)
      expect(await db.transactions.get(id)).toEqual(before)
    })

    it('возвращает кросс-валютный перевод', async () => {
      const id = await addTransaction({ ...base, type: 'transfer', accountId: 'a', toAccountId: 'b', amount: 500, toAmount: 1 })
      await restoreTransaction((await deleteTransaction(id))!)
      expect([await balance('a'), await balance('b')]).toEqual([500, 1])
    })

    it('возвращает платёж по долгу и пополнение цели', async () => {
      await db.debts.add({ id: 'd', name: 'D', totalAmount: 1000, remainingAmount: 1000, monthlyPayment: 100, dueDay: 5, createdAt: '', isClosed: false })
      await db.goals.add({ id: 'g', title: 'G', targetAmount: 300, currentAmount: 0, targetDate: '2027-01-01', icon: '', color: '', isAchieved: false })
      const d = await addTransaction({ ...base, type: 'expense', accountId: 'a', amount: 400, debtId: 'd', isExcludedFromNoSpend: true })
      const g = await addTransaction({ ...base, type: 'expense', accountId: 'a', amount: 300, goalId: 'g', isExcludedFromNoSpend: true })
      await restoreTransaction((await deleteTransaction(d))!)
      await restoreTransaction((await deleteTransaction(g))!)
      expect(await balance('a')).toBe(300)
      expect((await db.debts.get('d'))!.remainingAmount).toBe(600)
      expect(await db.goals.get('g')).toMatchObject({ currentAmount: 300, isAchieved: true })
    })

    it('повторный вызов не применяет эффект дважды', async () => {
      const id = await addTransaction({ ...base, type: 'expense', accountId: 'a', amount: 100 })
      const deleted = (await deleteTransaction(id))!
      await restoreTransaction(deleted)
      await restoreTransaction(deleted)
      expect(await balance('a')).toBe(900)
      expect(await db.transactions.count()).toBe(1)
    })

    it('если счёта уже нет — ошибка и ничего не меняется', async () => {
      const id = await addTransaction({ ...base, type: 'expense', accountId: 'a', amount: 100 })
      const deleted = (await deleteTransaction(id))!
      await db.accounts.delete('a')
      await expect(restoreTransaction(deleted)).rejects.toThrow(/Счёт/)
      expect(await db.transactions.count()).toBe(0)
    })
  })

  describe('updateTransaction', () => {
    const edit = (patch: Record<string, unknown>) => ({ ...base, type: 'expense' as const, accountId: 'a', amount: 250, ...patch })
    const stored = async (id: string) => (await db.transactions.get(id))!

    it('changes amount, date, category and comment; keeps id and timestamp', async () => {
      const id = await addTransaction({ ...base, type: 'expense', accountId: 'a', amount: 250 })
      const before = await stored(id)
      await updateTransaction(id, edit({ amount: 400.5, date: '2026-11-01', categoryId: 'other', comment: 'исправлено' }))
      const after = await stored(id)
      expect(after).toMatchObject({ id, timestamp: before.timestamp, amount: 400.5, date: '2026-11-01', categoryId: 'other', comment: 'исправлено' })
      expect(await balance('a')).toBe(599.5)
      expect(await db.transactions.count()).toBe(1)
    })

    it('moving to another account restores the old one and charges the new one', async () => {
      await db.accounts.add(account('c', 500))
      const id = await addTransaction({ ...base, type: 'expense', accountId: 'a', amount: 250 })
      await updateTransaction(id, edit({ accountId: 'c' }))
      expect([await balance('a'), await balance('c')]).toEqual([1000, 250])
    })

    it('changing type expense → income flips the effect', async () => {
      const id = await addTransaction({ ...base, type: 'expense', accountId: 'a', amount: 100 })
      await updateTransaction(id, edit({ type: 'income', amount: 100 }))
      expect(await balance('a')).toBe(1100)
    })

    it('cross-currency transfer: changes toAmount and target; transfer → expense drops toAccount', async () => {
      await db.accounts.add(account('c', 0, 'EUR'))
      const id = await addTransaction({ ...base, type: 'transfer', accountId: 'a', toAccountId: 'b', amount: 500, toAmount: 1 })
      await updateTransaction(id, { ...base, type: 'transfer', accountId: 'a', toAccountId: 'c', amount: 600, toAmount: 2 })
      expect([await balance('a'), await balance('b'), await balance('c')]).toEqual([400, 0, 2])
      await updateTransaction(id, edit({ amount: 100 }))
      expect([await balance('a'), await balance('b'), await balance('c')]).toEqual([900, 0, 0])
      const after = await stored(id)
      expect(after.toAccountId).toBeUndefined()
      expect(after.toAmount).toBeUndefined()
    })

    it('debt payment: amount change updates the debt; overpayment is rejected without side effects', async () => {
      await db.debts.add({ id: 'd', name: 'D', totalAmount: 1000, remainingAmount: 1000, monthlyPayment: 100, dueDay: 5, createdAt: '', isClosed: false })
      const id = await addTransaction({ ...base, type: 'expense', accountId: 'a', amount: 400, debtId: 'd', isExcludedFromNoSpend: true })
      const linked = { debtId: 'd', isExcludedFromNoSpend: true }
      await updateTransaction(id, edit({ ...linked, amount: 1000 }))
      expect(await db.debts.get('d')).toMatchObject({ remainingAmount: 0, isClosed: true })
      expect(await balance('a')).toBe(0)
      await updateTransaction(id, edit({ ...linked, amount: 100 }))
      expect(await db.debts.get('d')).toMatchObject({ remainingAmount: 900, isClosed: false })

      await expect(updateTransaction(id, edit({ ...linked, amount: 1001 }))).rejects.toThrow(/превышает/)
      expect((await db.debts.get('d'))!.remainingAmount).toBe(900)
      expect(await balance('a')).toBe(900)
      expect((await stored(id)).amount).toBe(100)
    })

    it('goal top-up: amount change updates progress and the achieved flag', async () => {
      await db.goals.add({ id: 'g', title: 'G', targetAmount: 300, currentAmount: 0, targetDate: '2027-01-01', icon: '', color: '', isAchieved: false })
      const id = await addTransaction({ ...base, type: 'expense', accountId: 'a', amount: 300, goalId: 'g', isExcludedFromNoSpend: true })
      expect((await db.goals.get('g'))!.isAchieved).toBe(true)
      await updateTransaction(id, edit({ goalId: 'g', isExcludedFromNoSpend: true, amount: 100 }))
      expect(await db.goals.get('g')).toMatchObject({ currentAmount: 100, isAchieved: false })
      expect(await balance('a')).toBe(900)
    })

    it('link to a debt or goal cannot be added, removed or switched', async () => {
      await db.goals.add({ id: 'g', title: 'G', targetAmount: 300, currentAmount: 0, targetDate: '2027-01-01', icon: '', color: '', isAchieved: false })
      const plain = await addTransaction({ ...base, type: 'expense', accountId: 'a', amount: 10 })
      const linked = await addTransaction({ ...base, type: 'expense', accountId: 'a', amount: 10, goalId: 'g' })
      await expect(updateTransaction(plain, edit({ goalId: 'g' }))).rejects.toThrow(/Связь/)
      await expect(updateTransaction(linked, edit({}))).rejects.toThrow(/Связь/)
      expect(await balance('a')).toBe(980)
    })

    it('linked operations stay on KZT accounts', async () => {
      await db.goals.add({ id: 'g', title: 'G', targetAmount: 300, currentAmount: 0, targetDate: '2027-01-01', icon: '', color: '', isAchieved: false })
      const id = await addTransaction({ ...base, type: 'expense', accountId: 'a', amount: 10, goalId: 'g' })
      await expect(updateTransaction(id, edit({ goalId: 'g', accountId: 'b', amount: 10 }))).rejects.toThrow(/тенге/)
      expect(await balance('a')).toBe(990)
    })

    it('is all-or-nothing: an unknown target account leaves everything untouched', async () => {
      const id = await addTransaction({ ...base, type: 'expense', accountId: 'a', amount: 250 })
      await expect(updateTransaction(id, edit({ accountId: 'ghost' }))).rejects.toThrow(/Счёт/)
      expect(await balance('a')).toBe(750)
      expect(await stored(id)).toMatchObject({ accountId: 'a', amount: 250 })
    })

    it('validates input and rejects unknown ids', async () => {
      const id = await addTransaction({ ...base, type: 'expense', accountId: 'a', amount: 250 })
      await expect(updateTransaction(id, edit({ amount: 0 }))).rejects.toThrow(/больше нуля/)
      await expect(updateTransaction(id, edit({ categoryId: undefined }))).rejects.toThrow(/категорию/)
      await expect(updateTransaction('nope', edit({}))).rejects.toThrow(/не найдена/)
      expect(await balance('a')).toBe(750)
    })
  })
})
