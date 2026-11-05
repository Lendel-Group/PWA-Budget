import { useSyncExternalStore } from 'react'
import { getAutoBackupPermission } from '../services/backupService'

let needsResume = false
const listeners = new Set<() => void>()
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => void listeners.delete(l)
}

/** Перечитывает право записи в файл автобэкапа и оповещает подписчиков (баннер, карточка установки). */
export async function refreshAutoBackupStatus(): Promise<void> {
  const next = (await getAutoBackupPermission()) === 'prompt'
  if (next === needsResume) return
  needsResume = next
  listeners.forEach((l) => l())
}

/** true, пока автобэкап приостановлен и нужно подтвердить доступ к файлу (показан баннер «Возобновить»). */
export function useAutoBackupNeedsResume(): boolean {
  return useSyncExternalStore(subscribe, () => needsResume, () => false)
}
