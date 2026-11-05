import './docs.css'

// Шапка: фон после начала прокрутки (как на лендинге)
const header = document.querySelector<HTMLElement>('[data-header]')
const onScroll = () => header?.toggleAttribute('data-scrolled', window.scrollY > 8)
window.addEventListener('scroll', onScroll, { passive: true })
onScroll()

// Оглавление: подсвечиваем раздел, который сейчас на экране
const links = new Map<string, HTMLAnchorElement[]>()
document.querySelectorAll<HTMLAnchorElement>('.toc a[href^="#"]').forEach((a) => {
  const id = a.hash.slice(1)
  links.set(id, [...(links.get(id) ?? []), a])
})
const sections = [...links.keys()].map((id) => document.getElementById(id)).filter((s): s is HTMLElement => s !== null)
const setActive = (id: string) => {
  links.forEach((list, key) => list.forEach((a) => a.setAttribute('aria-current', String(key === id))))
}
// Активен последний раздел, чей заголовок уже ушёл под шапку (с запасом на липкое оглавление на телефоне)
const spy = () => {
  const line = window.innerHeight * 0.3
  let current = sections[0]
  for (const s of sections) if (s.getBoundingClientRect().top <= line) current = s
  if (current) setActive(current.id)
}
window.addEventListener('scroll', spy, { passive: true })
window.addEventListener('hashchange', spy)
// При открытии по ссылке с якорем браузер прокручивает уже после загрузки
window.addEventListener('load', () => requestAnimationFrame(spy))
spy()

// Мобильное оглавление закрывается после выбора пункта
const mobileToc = document.querySelector<HTMLDetailsElement>('[data-mobile-toc]')
// Сначала сворачиваем список, потом прокручиваем: иначе он схлопнется уже после прокрутки и заголовок уедет вверх
mobileToc?.addEventListener('click', (e) => {
  const link = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]')
  if (!link) return
  e.preventDefault()
  mobileToc.open = false
  requestAnimationFrame(() => {
    document.getElementById(link.hash.slice(1))?.scrollIntoView()
    history.pushState(null, '', link.hash)
    spy()
  })
})

// Скриншот по нажатию открывается крупно; закрывается кликом, Esc или кнопкой «Назад» браузера не мешаем
const dialog = document.querySelector<HTMLDialogElement>('dialog.zoom')
const zoomImg = dialog?.querySelector('img')
document.querySelectorAll<HTMLButtonElement>('.shot button').forEach((btn) => {
  btn.addEventListener('click', () => {
    const img = btn.querySelector('img')
    if (!dialog || !zoomImg || !img) return
    zoomImg.src = img.currentSrc || img.src
    zoomImg.alt = img.alt
    dialog.showModal()
  })
})
dialog?.addEventListener('click', () => dialog.close())

const version = document.querySelector('[data-version]')
if (version && typeof __APP_VERSION__ !== 'undefined') version.textContent = `v${__APP_VERSION__}`
