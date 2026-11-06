/**
 * Тема интерфейса (budget-spec, spec/05 «Общее», spec/06 «Тема»): «Как в системе» (по умолчанию) / «Светлая» / «Тёмная».
 * Выбор — локальная настройка устройства в localStorage: не в IndexedDB и не в резервной копии; восстановление и
 * полный сброс его не меняют. До первого кадра тему ставит встроенный скрипт в app/index.html — он повторяет
 * resolveTheme, держите их одинаковыми.
 */
export type ThemeMode = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'theme'

/** Варианты в «Настройки → Оформление → Тема» — тексты spec/05. */
export const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'Как в системе' },
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
]

/** Цвет surface темы — для <meta name="theme-color"> (строка состояния и панель браузера). */
export const THEME_SURFACE: Record<ResolvedTheme, string> = { dark: '#09090b', light: '#f4f4f5' }

/** Сохранённое значение → режим; нет или неизвестно — «Как в системе». */
export function parseThemeMode(value: unknown): ThemeMode {
  return value === 'light' || value === 'dark' ? value : 'system'
}

/** Какая тема сейчас: «Как в системе» следует теме устройства. */
export function resolveTheme(mode: ThemeMode, systemDark: boolean): ResolvedTheme {
  if (mode === 'system') return systemDark ? 'dark' : 'light'
  return mode
}

const DARK_QUERY = '(prefers-color-scheme: dark)'

export function readThemeMode(): ThemeMode {
  try {
    return parseThemeMode(localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    return 'system' // хранилище недоступно (приватный режим) — как в системе
  }
}

export function saveThemeMode(mode: ThemeMode) {
  try {
    if (mode === 'system') localStorage.removeItem(THEME_STORAGE_KEY)
    else localStorage.setItem(THEME_STORAGE_KEY, mode)
  } catch {
    // не сохранилось — тема всё равно применяется до перезагрузки
  }
}

/** Применить тему к документу: атрибут data-theme (палитра в index.css), color-scheme и theme-color. */
export function applyTheme(mode: ThemeMode) {
  const theme = resolveTheme(mode, window.matchMedia(DARK_QUERY).matches)
  const root = document.documentElement
  root.dataset.theme = theme
  root.style.colorScheme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_SURFACE[theme])
}

/** «Как в системе» меняется вместе с темой устройства, без перезагрузки. Вызывать один раз при запуске. */
export function watchSystemTheme() {
  window.matchMedia(DARK_QUERY).addEventListener('change', () => applyTheme(readThemeMode()))
}
