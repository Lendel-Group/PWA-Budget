import './landing.css'

const appUrl = new URL('app/', document.baseURI).href

// Установленное приложение, созданное до переезда в app/, открывается по старому адресу (корень сайта):
// в режиме standalone сразу отправляем его в приложение, а не на лендинг.
const standalone =
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true
if (standalone) window.location.replace(appUrl)

// Сервис-воркер прежней версии был зарегистрирован на весь сайт и отдавал бы на корне старую копию приложения.
// Новый живёт только в app/ — регистрацию на корне снимаем. Данные (IndexedDB) это не затрагивает.
if ('serviceWorker' in navigator) {
  const rootScope = new URL('./', document.baseURI).href
  void navigator.serviceWorker
    .getRegistrations()
    .then((regs) => Promise.all(regs.filter((r) => r.scope === rootScope).map((r) => r.unregister())))
    .catch(() => {})
}

// Плавное появление блоков при прокрутке
const items = document.querySelectorAll<HTMLElement>('.reveal')
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        e.target.classList.add('is-visible')
        io.unobserve(e.target)
      }
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.1 },
  )
  items.forEach((el) => io.observe(el))
} else {
  items.forEach((el) => el.classList.add('is-visible'))
}

// Шапка: фон появляется после начала прокрутки
const header = document.querySelector<HTMLElement>('[data-header]')
const onScroll = () => header?.toggleAttribute('data-scrolled', window.scrollY > 8)
window.addEventListener('scroll', onScroll, { passive: true })
onScroll()

// Инструкция по установке: открываем вкладку под платформу посетителя
const ua = navigator.userAgent
const platform = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  ? 'ios'
  : /Android/.test(ua)
    ? 'android'
    : 'desktop'
const tabs = document.querySelectorAll<HTMLButtonElement>('[role="tab"][data-platform]')
const selectTab = (id: string) => {
  tabs.forEach((t) => {
    const active = t.dataset.platform === id
    t.setAttribute('aria-selected', String(active))
    t.tabIndex = active ? 0 : -1
    document.getElementById(`install-${t.dataset.platform}`)?.toggleAttribute('hidden', !active)
  })
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => selectTab(t.dataset.platform!))
  t.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]
    next.focus()
    selectTab(next.dataset.platform!)
  })
})
selectTab(platform)

const year = document.querySelector('[data-year]')
if (year) year.textContent = String(new Date().getFullYear())
const version = document.querySelector('[data-version]')
if (version && typeof __APP_VERSION__ !== 'undefined') version.textContent = `v${__APP_VERSION__}`
