import { db } from '../db/schema'

export type WelcomeState = 'active' | 'done'

/**
 * Экраны первого запуска (spec/03, «Запуск приложения»): вызывается после сида, решение принимается один раз —
 * свежая установка (операций нет) → `active`, иначе `done`. Повторные вызовы ничего не меняют.
 */
export async function initWelcome(): Promise<WelcomeState> {
  return db.transaction('rw', [db.config, db.transactions], async () => {
    const existing = (await db.config.get('welcome'))?.value
    if (existing === 'active' || existing === 'done') return existing
    const state: WelcomeState = (await db.transactions.count()) > 0 ? 'done' : 'active'
    await db.config.put({ key: 'welcome', value: state })
    return state
  })
}

/** «Готово» и «Пропустить»: экраны больше не показываются. */
export async function finishWelcome(): Promise<void> {
  await db.config.put({ key: 'welcome', value: 'done' satisfies WelcomeState })
}

/** `undefined` — ещё не определено (или данные только что импортированы / сброшены): экраны не показываются. */
export async function getWelcomeState(): Promise<WelcomeState | undefined> {
  const value = (await db.config.get('welcome'))?.value
  return value === 'active' || value === 'done' ? value : undefined
}
