import { useState } from 'react'
import { Download, Share, X } from 'lucide-react'
import { getInstallMode, isIosDevice } from '../../domain/install'
import { useAutoBackupNeedsResume } from '../../lib/autoBackupStatus'
import {
  isStandalone, promptInstall, readDismissedAt, rememberDismissed, useCanInstall,
} from '../../lib/install'

/**
 * Предложение установить приложение — карточка на главной, а не полоса над каждым экраном: системное окно
 * (Chrome/Android) или подсказка для iOS. Закрытие откладывает предложение на 14 дней. Пока показан баннер
 * приостановленного автобэкапа, карточка скрыта: баннеров не больше одного, приоритет у бэкапа.
 */
export function InstallCard() {
  const hasPrompt = useCanInstall()
  const backupBannerShown = useAutoBackupNeedsResume()
  const [dismissedAt, setDismissedAt] = useState(readDismissedAt)
  const [now] = useState(() => Date.now())

  const mode = getInstallMode({
    standalone: isStandalone(),
    hasPrompt,
    ios: isIosDevice(navigator.userAgent, navigator.platform, navigator.maxTouchPoints),
    dismissedAt,
    now,
  })
  if (mode === 'none' || backupBannerShown) return null

  const dismiss = () => {
    rememberDismissed()
    setDismissedAt(Date.now())
  }

  return (
    <section aria-label="Установка приложения" className="flex items-start gap-3 rounded-2xl border border-accent/40 bg-accent/10 p-4 text-sm" data-testid="install-card">
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <p className="font-medium">Установите приложение</p>
          {mode === 'prompt' ? (
            <p className="text-xs text-fg-muted">Работает без интернета и открывается с главного экрана.</p>
          ) : (
            <p className="text-xs text-fg-muted">
              Откройте сайт в Safari, нажмите <Share className="inline size-3.5 align-text-bottom" aria-label="Поделиться" /> «Поделиться» и выберите «На экран “Домой”».
            </p>
          )}
        </div>
        {mode === 'prompt' && (
          <button
            type="button"
            onClick={async () => { if (!(await promptInstall())) dismiss() }}
            className="flex min-h-11 items-center gap-1.5 rounded-xl bg-accent px-4 font-medium text-on-accent"
          >
            <Download className="size-4" aria-hidden /> Установить
          </button>
        )}
      </div>
      <button type="button" aria-label="Скрыть" onClick={dismiss} className="-mr-2 -mt-2 grid size-11 shrink-0 place-items-center rounded-xl text-fg-muted active:bg-zinc-900">
        <X className="size-5" aria-hidden />
      </button>
    </section>
  )
}
