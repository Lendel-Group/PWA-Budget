const snapshot = () => `${window.innerWidth}×${window.innerHeight}`

/** Размер окна в момент загрузки скрипта и спустя 1,5 с — для диагностики раскладки при запуске. */
export const launchViewport: { atStart: string; later?: string } = { atStart: snapshot() }
setTimeout(() => {
  launchViewport.later = snapshot()
}, 1500)

/**
 * iOS (установленное приложение): сразу после запуска фиксированная нижняя панель может остаться
 * на старом месте, пока размер окна не пересчитается (в записи панель «висит» выше на высоту
 * статус-бара до первого нажатия). Принудительно переоцениваем раскладку после старта,
 * при изменении видимой области и при возврате на страницу.
 */
export function installViewportNudge(): () => void {
  const nudge = () => {
    const nav = document.querySelector<HTMLElement>('nav[aria-label="Основная навигация"]')
    if (!nav) return
    nav.style.bottom = '0.5px'
    requestAnimationFrame(() => {
      nav.style.bottom = ''
    })
  }
  const timers = [0, 150, 500, 1500].map((ms) => setTimeout(nudge, ms))
  window.visualViewport?.addEventListener('resize', nudge)
  window.addEventListener('pageshow', nudge)
  window.addEventListener('orientationchange', nudge)
  return () => {
    timers.forEach(clearTimeout)
    window.visualViewport?.removeEventListener('resize', nudge)
    window.removeEventListener('pageshow', nudge)
    window.removeEventListener('orientationchange', nudge)
  }
}
