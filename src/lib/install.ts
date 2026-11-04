import { useSyncExternalStore } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'install-dismissed-at'
let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

/** Вызвать как можно раньше (main.tsx): событие приходит до монтирования React. */
export function captureInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    notify()
  })
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => void listeners.delete(l)
}

/** true, если браузер готов показать системное окно установки. */
export function useCanInstall(): boolean {
  return useSyncExternalStore(subscribe, () => deferred !== null, () => false)
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function readDismissedAt(): number | undefined {
  try {
    const v = Number(localStorage.getItem(DISMISS_KEY))
    return v > 0 ? v : undefined
  } catch {
    return undefined
  }
}

export function rememberDismissed(now = Date.now()): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(now))
  } catch {
    // приватный режим: просто покажем снова в следующий раз
  }
}

/** Показывает системное окно установки. true — пользователь согласился. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false
  const event = deferred
  deferred = null // событие одноразовое
  notify()
  await event.prompt()
  return (await event.userChoice).outcome === 'accepted'
}
