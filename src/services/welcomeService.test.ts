import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/schema'
import { importDatabaseFromJson } from './backupService'
import { finishWelcome, getWelcomeState, initWelcome } from './welcomeService'

const tx = { id: 't', date: '2026-11-04', timestamp: 1, type: 'expense' as const, accountId: 'a', amount: 1, categoryId: 'c', isExcludedFromNoSpend: false }

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('welcomeService', () => {
  it('свежая установка → active; «Готово» → done', async () => {
    expect(await getWelcomeState()).toBeUndefined()
    expect(await initWelcome()).toBe('active')
    await finishWelcome()
    expect(await getWelcomeState()).toBe('done')
    expect(await initWelcome()).toBe('done')
  })

  it('есть операции (обновление приложения) → done', async () => {
    await db.transactions.add(tx)
    expect(await initWelcome()).toBe('done')
  })

  it('решение не меняется при следующих запусках', async () => {
    await initWelcome()
    await db.transactions.add(tx)
    expect(await initWelcome()).toBe('active')
  })

  it('импорт удаляет ключ: до следующего запуска экраны не показываются', async () => {
    await initWelcome()
    const backup = {
      app: 'pwa-budget', schemaVersion: 2, exportedAt: '2026-11-04T00:00:00.000Z',
      data: { accounts: [], categories: [], budgetLimits: [], transactions: [], debts: [], goals: [], config: [] },
    }
    await importDatabaseFromJson(JSON.stringify(backup))
    expect(await getWelcomeState()).toBeUndefined()
  })
})
