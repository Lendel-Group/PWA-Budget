import { useEffect } from 'react'
import { refreshAutoBackupStatus, useAutoBackupNeedsResume } from '../../lib/autoBackupStatus'
import { resumeAutoBackup } from '../../services/backupService'

/**
 * После перезапуска браузера право записи в файл нужно подтвердить жестом пользователя.
 * Одна компактная строка над шапкой (≈44 px); пока она показана, предложение установки на главной скрыто.
 */
export function AutoBackupBanner() {
  const needsResume = useAutoBackupNeedsResume()

  useEffect(() => {
    void refreshAutoBackupStatus()
    const onVisible = () => document.visibilityState === 'visible' && void refreshAutoBackupStatus()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  if (!needsResume) return null
  return (
    <div role="region" aria-label="Автобэкап" className="flex flex-wrap items-center justify-between gap-x-3 bg-warning/15 px-4 text-sm text-warning">
      <span className="py-1">Автобэкап приостановлен</span>
      <button
        type="button"
        className="min-h-11 px-1 font-semibold underline"
        onClick={async () => {
          await resumeAutoBackup()
          await refreshAutoBackupStatus()
        }}
      >
        Возобновить
      </button>
    </div>
  )
}
