/** То, что нужно от `navigator.serviceWorker` (в тестах — подмена). */
export interface SwContainer {
  getRegistration(): Promise<{ waiting: SwWorker | null } | undefined>
  addEventListener(type: 'controllerchange', listener: () => void, options?: { once: boolean }): void
}
export interface SwWorker {
  readonly state: string
  postMessage(message: unknown): void
  addEventListener(type: 'statechange', listener: () => void): void
}

/** Сколько ждать, пока новая версия возьмёт управление, прежде чем перезагрузить страницу всё равно. */
export const APPLY_TIMEOUT_MS = 3000

/**
 * «Обновить» в баннере новой версии. Ожидающему сервис-воркеру — SKIP_WAITING; страница перезагружается, как только он
 * активирован или взял управление, и в любом случае через [APPLY_TIMEOUT_MS]. Регистрация читается заново в момент
 * нажатия: у установленного на iOS приложения, проснувшегося из фона, прежний объект бывает устаревшим, а события
 * `controllerchange` не приходит — раньше кнопка тогда ничего не делала. Нет ожидающего — новая версия уже
 * активирована (например, вкладкой в браузере): достаточно перезагрузить.
 */
export async function applyUpdate(
  container: SwContainer | undefined,
  reload: () => void,
  setTimer: (fn: () => void, ms: number) => unknown = setTimeout,
): Promise<void> {
  let done = false
  const go = () => {
    if (done) return
    done = true
    reload()
  }
  if (!container) return go()
  container.addEventListener('controllerchange', go, { once: true })
  const waiting = (await container.getRegistration().catch(() => undefined))?.waiting
  if (!waiting) return go()
  waiting.addEventListener('statechange', () => { if (waiting.state === 'activated') go() })
  setTimer(go, APPLY_TIMEOUT_MS)
  waiting.postMessage({ type: 'SKIP_WAITING' })
}
