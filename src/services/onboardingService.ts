import { db } from '../db/schema'

export type OnboardingState = 'active' | 'dismissed'

/**
 * Вызывается при запуске после сида, один раз за жизнь данных: свежая установка (операций нет) →
 * `active`, чек-лист первых шагов виден; пользователь с данными (обновление приложения) → `dismissed`,
 * чек-лист ему не показывается. Повторные вызовы ничего не меняют.
 */
export async function initOnboarding(): Promise<OnboardingState> {
  return db.transaction('rw', [db.config, db.transactions], async () => {
    const existing = (await db.config.get('onboarding'))?.value
    if (existing === 'active' || existing === 'dismissed') return existing
    const state: OnboardingState = (await db.transactions.count()) > 0 ? 'dismissed' : 'active'
    await db.config.put({ key: 'onboarding', value: state })
    return state
  })
}

/** Скрывает чек-лист навсегда (по крестику или когда все шаги выполнены). */
export async function dismissOnboarding(): Promise<void> {
  await db.config.put({ key: 'onboarding', value: 'dismissed' satisfies OnboardingState })
}

/** Состояние для интерфейса; `undefined` — ещё не определено (или данные только что импортированы). */
export async function getOnboardingState(): Promise<OnboardingState | undefined> {
  const value = (await db.config.get('onboarding'))?.value
  return value === 'active' || value === 'dismissed' ? value : undefined
}
