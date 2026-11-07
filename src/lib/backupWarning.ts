import { pluralRu } from './format'

/** Копия «давняя» — дольше этого числа полных суток. */
export const BACKUP_STALE_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Предупреждение в листе сброса и восстановления (spec/05, «Давно не было копии»): копии нет или ей больше
 * {@link BACKUP_STALE_DAYS} полных суток; `undefined` — копия свежая, лист без предупреждения.
 */
export function backupWarning(lastBackup: string | undefined, now: Date): string | undefined {
  const last = lastBackup ? Date.parse(lastBackup) : NaN
  if (Number.isNaN(last)) return 'Резервная копия ещё не создавалась.'
  const days = Math.floor((now.getTime() - last) / DAY_MS)
  if (days <= BACKUP_STALE_DAYS) return undefined
  return `Последняя резервная копия — ${days} ${pluralRu(days, ['день', 'дня', 'дней'])} назад.`
}
