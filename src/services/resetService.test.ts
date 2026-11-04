import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { db } from '../db/schema'
import { seedIfEmpty } from '../db/seed'
import { createAccount } from './accountService'
import { resetApplication } from './resetService'

describe('resetApplication', () => {
  it('wipes user data and the backup handle, then re-seeds defaults', async () => {
    await seedIfEmpty()
    await createAccount({ name: 'Лишний', type: 'card', currency: 'KZT', initialBalance: 5 })
    await db.config.put({ key: 'auto_backup_handle', value: 'h' })
    await db.budgetLimits.put({ id: 'x', year: 2026, month: 1, categoryId: 'c', plannedAmount: 1 })

    await resetApplication()

    expect(await db.accounts.count()).toBe(1)
    expect((await db.accounts.toArray())[0].name).toBe('Наличные KZT')
    expect(await db.budgetLimits.count()).toBe(0)
    expect(await db.config.get('auto_backup_handle')).toBeUndefined()
    expect(await db.categories.count()).toBeGreaterThan(0)
  })
})
