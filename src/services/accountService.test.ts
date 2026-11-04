import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/schema'
import { seedIfEmpty } from '../db/seed'
import { createAccount, setAccountArchived } from './accountService'

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
})
