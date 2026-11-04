import { useCallback, useEffect, useState } from 'react'
import { getAutoBackupPermission, resumeAutoBackup } from '../../services/backupService'

/** После перезапуска браузера право записи в файл нужно подтвердить жестом пользователя. */
export function AutoBackupBanner() {
  const [needsResume, setNeedsResume] = useState(false)

  const check = useCallback(
    () => getAutoBackupPermission().then((p) => setNeedsResume(p === 'prompt')),
    [],
  )

  useEffect(() => {
    let alive = true
    const run = () => getAutoBackupPermission().then((p) => alive && setNeedsResume(p === 'prompt'))
    void run()
    const onVisible = () => document.visibilityState === 'visible' && void run()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  if (!needsResume) return null
  return (
    <div className="flex items-center justify-between gap-3 bg-amber-500/15 px-4 py-2 text-sm text-amber-200">
      <span>Автобэкап приостановлен</span>
      <button
        type="button"
        className="min-h-11 rounded-lg bg-amber-500 px-3 font-medium text-zinc-950"
        onClick={async () => {
          await resumeAutoBackup()
          await check()
        }}
      >
        Возобновить автобэкап
      </button>
    </div>
  )
}
