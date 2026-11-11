import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/schema'
import { seedIfEmpty } from '../db/seed'
import { createAccount, setAccountArchived, setInitialBalance } from './accountService'
import { addTransaction } from './transactionService'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  await seedIfEmpty()
})

describe('accountService', () => {
  it('creates an account with currentBalance = initialBalance', async () => {
    const id = await createAccount({ name: ' Депозит USD ', type: 'deposit', currency: 'USD', initialBalance: 250 })
    expect(await db.accounts.get(id)).toMatchObject({ name: 'Депозит USD', currentBalance: 250, initialBalance: 250, isArchived: false })
    await expect(createAccount({ name: '', type: 'card', currency: 'KZT', initialBalance: 0 })).rejects.toThrow(/название/)
  })

  it('archives and restores, but never the last active account', async () => {
    const [first] = await db.accounts.toArray()
    await expect(setAccountArchived(first.id, true)).rejects.toThrow(/последний/)
    const id = await createAccount({ name: 'Карта', type: 'card', currency: 'KZT', initialBalance: 0 })
    await setAccountArchived(id, true)
    expect((await db.accounts.get(id))!.isArchived).toBe(true)
    await setAccountArchived(id, false)
    expect((await db.accounts.get(id))!.isArchived).toBe(false)
    await expect(setAccountArchived('nope', true)).rejects.toThrow(/не найден/)
  })

  it('sets the initial balance only while the account has no transactions', async () => {
    const [cash] = await db.accounts.toArray()
    await setInitialBalance(cash.id, 12500.5)
    expect(await db.accounts.get(cash.id)).toMatchObject({ initialBalance: 12500.5, currentBalance: 12500.5 })
    await setInitialBalance(cash.id, -300)
    await expect(setInitialBalance(cash.id, 1e10)).rejects.toThrow('Слишком большая сумма')
    expect(await db.accounts.get(cash.id)).toMatchObject({ initialBalance: -300, currentBalance: -300 })
    await expect(setInitialBalance(cash.id, NaN)).rejects.toThrow('Начальный остаток должен быть числом')
    await expect(setInitialBalance('nope', 1)).rejects.toThrow('Счёт не найден')

    const card = await createAccount({ name: 'Карта', type: 'card', currency: 'KZT', initialBalance: 0 })
    await addTransaction({ date: '2026-11-01', type: 'transfer', accountId: cash.id, toAccountId: card, amount: 100, isExcludedFromNoSpend: false })
    for (const id of [cash.id, card]) {
      await expect(setInitialBalance(id, 1)).rejects.toThrow('По счёту уже есть операции — остаток меняется только ими')
    }
    expect(await db.accounts.get(card)).toMatchObject({ initialBalance: 0, currentBalance: 100 })
  })
})
