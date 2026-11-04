import { useState } from 'react'
import { Download, Share, X } from 'lucide-react'
import { getInstallMode, isIosDevice } from '../../domain/install'
import {
  isStandalone, promptInstall, readDismissedAt, rememberDismissed, useCanInstall,
} from '../../lib/install'

/** Сразу предлагает установить приложение: системное окно (Chrome/Android) или подсказка для iOS. */
export function InstallBanner() {
  const hasPrompt = useCanInstall()
  const [dismissedAt, setDismissedAt] = useState(readDismissedAt)
  const [now] = useState(() => Date.now())

  const mode = getInstallMode({
    standalone: isStandalone(),
    hasPrompt,
    ios: isIosDevice(navigator.userAgent, navigator.platform, navigator.maxTouchPoints),
    dismissedAt,
    now,
  })
  if (mode === 'none') return null

  const dismiss = () => {
    rememberDismissed()
    setDismissedAt(Date.now())
  }

  return (
    <div role="region" aria-label="Установка приложения" className="flex items-start gap-3 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-100">
      <div className="min-w-0 flex-1">
        <p className="font-medium">Установите приложение</p>
        {mode === 'prompt' ? (
          <p className="text-xs text-emerald-200/80">Работает без интернета и открывается с главного экрана.</p>
        ) : (
          <p className="text-xs text-emerald-200/80">
            Откройте сайт в Safari, нажмите <Share className="inline size-3.5 align-text-bottom" aria-label="Поделиться" /> «Поделиться» и выберите «На экран “Домой”».
          </p>
        )}
      </div>
      {mode === 'prompt' && (
        <button
          type="button"
          onClick={async () => { if (!(await promptInstall())) dismiss() }}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 font-medium text-zinc-950"
        >
          <Download className="size-4" aria-hidden /> Установить
        </button>
      )}
      <button type="button" aria-label="Скрыть" onClick={dismiss} className="grid size-8 shrink-0 place-items-center rounded-lg text-emerald-200/80">
        <X className="size-4" aria-hidden />
      </button>
    </div>
  )
}
