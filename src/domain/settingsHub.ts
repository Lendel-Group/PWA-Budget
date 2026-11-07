/** Сводки строк главного экрана «Настроек» (spec/05). */

/** «Активных: N», с архивными — «Активных: N · В архиве: M». */
export function accountsSummary(accounts: readonly { isArchived: boolean }[]): string {
  const archived = accounts.filter((a) => a.isArchived).length
  const active = `Активных: ${accounts.length - archived}`
  return archived > 0 ? `${active} · В архиве: ${archived}` : active
}

/** «Нацбанк РК · 2026-11-05» / «Вручную · …» / «Не заданы». */
export function ratesSummary(stored?: { source: string; date: string }): string {
  if (!stored) return 'Не заданы'
  return `${stored.source === 'nbk' ? 'Нацбанк РК' : 'Вручную'} · ${stored.date}`
}

/** Состояние автобэкапа; `supported === false` — браузер без File System Access (iOS Safari). */
export function backupSummary(permission: 'granted' | 'prompt' | 'denied' | 'none', supported: boolean): string {
  if (!supported) return 'Только вручную'
  if (permission === 'granted') return 'Автобэкап включён'
  if (permission === 'none') return 'Автобэкап не настроен'
  return 'Автобэкап приостановлен'
}

export const aboutSummary = (version: string) => `Версия ${version}`
