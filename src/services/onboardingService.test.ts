import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/schema'
import { dismissOnboarding, getOnboardingState, initOnboarding } from './onboardingService'

beforeEach(async () => {
  await Promise.all([db.config.clear(), db.transactions.clear()])
})

describe('onboardingService', () => {
  it('до инициализации состояния нет', async () => {
    expect(await getOnboardingState()).toBeUndefined()
  })

  it('свежая установка без операций → active', async () => {
    expect(await initOnboarding()).toBe('active')
    expect(await getOnboardingState()).toBe('active')
  })

  it('пользователь с данными → dismissed: чек-лист ему не показывается', async () => {
    await db.transactions.add({ id: 't', date: '2026-11-04', timestamp: 1, type: 'expense', accountId: 'a', amount: 1, categoryId: 'c', isExcludedFromNoSpend: false })
    expect(await initOnboarding()).toBe('dismissed')
    expect(await getOnboardingState()).toBe('dismissed')
  })

  it('повторный запуск не меняет решение, даже если данных стало больше или меньше', async () => {
    await initOnboarding()
    await db.transactions.add({ id: 't', date: '2026-11-04', timestamp: 1, type: 'expense', accountId: 'a', amount: 1, categoryId: 'c', isExcludedFromNoSpend: false })
    expect(await initOnboarding()).toBe('active')
    await dismissOnboarding()
    await db.transactions.clear()
    expect(await initOnboarding()).toBe('dismissed')
  })

  it('dismissOnboarding скрывает чек-лист', async () => {
    await initOnboarding()
    await dismissOnboarding()
    expect(await getOnboardingState()).toBe('dismissed')
  })

  it('мусорное значение в config считается отсутствием состояния и пересчитывается', async () => {
    await db.config.put({ key: 'onboarding', value: 'garbage' })
    expect(await getOnboardingState()).toBeUndefined()
    expect(await initOnboarding()).toBe('active')
  })
})
