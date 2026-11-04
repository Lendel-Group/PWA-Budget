export const SNOOZE_DAYS = 14
export type InstallMode = 'none' | 'prompt' | 'ios-hint'

/** iPhone/iPad/iPod (в том числе iPadOS, который маскируется под Mac). */
export function isIosDevice(ua: string, platform: string, maxTouchPoints: number): boolean {
  return /iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && maxTouchPoints > 1)
}

/** Отложено ли предложение: пользователь закрыл его меньше SNOOZE_DAYS назад. */
export function isSnoozed(dismissedAt: number | undefined, now: number): boolean {
  return dismissedAt !== undefined && now - dismissedAt < SNOOZE_DAYS * 86_400_000
}

export interface InstallContext {
  /** Приложение уже запущено как установленное. */
  standalone: boolean
  /** Браузер дал событие beforeinstallprompt (Chrome/Edge/Android). */
  hasPrompt: boolean
  ios: boolean
  dismissedAt?: number
  now: number
}

/** Что показать: системный запрос установки, подсказку для iOS или ничего. */
export function getInstallMode(c: InstallContext): InstallMode {
  if (c.standalone || isSnoozed(c.dismissedAt, c.now)) return 'none'
  if (c.hasPrompt) return 'prompt'
  return c.ios ? 'ios-hint' : 'none'
}
