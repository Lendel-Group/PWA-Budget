import { useEffect, useRef, type ReactNode } from 'react'
import { BarChart3, Home, Plus, Settings, Target, Wallet, type LucideIcon } from 'lucide-react'
import { defaultRoute, screenOf, type Screen } from '../../domain/routes'
import { cn } from '../../lib/cn'
import type { Route } from '../../lib/useHashRoute'
import { useRouteAnnounce } from '../../lib/useRouteAnnounce'
import { installViewportNudge } from '../../lib/viewport'
import { AutoBackupBanner } from './AutoBackupBanner'

/** Заголовок страницы (h1) — один на экран, у «Планов» он общий для всех подразделов. */
const SCREEN_TITLES: Record<Screen, string> = {
  home: 'Мой бюджет',
  budget: 'Бюджет',
  analytics: 'Аналитика',
  plans: 'Планы',
  transactions: 'Операции',
  settings: 'Настройки',
  categories: 'Категории',
}

/** Заголовок вкладки браузера уточняет подраздел «Планов» и «Аналитики». */
const SUB_LABELS: Partial<Record<Route, string>> = { goals: 'Цели', debts: 'Долги', nospend: 'Дни без трат' }

const TABS: { screen: Screen; label: string; icon: LucideIcon }[] = [
  { screen: 'home', label: 'Главная', icon: Home },
  { screen: 'budget', label: 'Бюджет', icon: Wallet },
  { screen: 'analytics', label: 'Аналитика', icon: BarChart3 },
  { screen: 'plans', label: 'Планы', icon: Target },
]

interface Props {
  route: Route
  onNavigate: (r: Route) => void
  onAdd: () => void
  children: ReactNode
}

export function AppLayout({ route, onNavigate, onAdd, children }: Props) {
  useEffect(() => installViewportNudge(), [])
  const heading = useRef<HTMLHeadingElement>(null)
  const screen = screenOf(route)
  // Анонсируем смену экрана, а не подраздела: иначе переключение вкладок внутри «Планов» или «Аналитики» уводило бы фокус с них на h1
  useRouteAnnounce(screen, SUB_LABELS[route] ?? SCREEN_TITLES[screen], heading)
  // Вкладка экрана возвращает на подраздел, где пользователь был в последний раз
  const lastRoute = useRef<Partial<Record<Screen, Route>>>({})
  useEffect(() => { lastRoute.current[screen] = route }, [screen, route])

  const left = TABS.slice(0, 2)
  const right = TABS.slice(2)

  const renderTab = ({ screen: s, label, icon: Icon }: (typeof TABS)[number]) => (
    <button
      key={s}
      type="button"
      onClick={() => onNavigate(lastRoute.current[s] ?? defaultRoute(s))}
      aria-current={screen === s ? 'page' : undefined}
      className={cn(
        // Подписи вкладок — фиксированные 12 px (как у системных таб-баров): при увеличении шрифта четыре подписи и «+» иначе не помещаются
        'flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[12px]',
        screen === s ? 'text-accent-fg' : 'text-fg-muted',
      )}
    >
      <Icon className="size-5" aria-hidden />
      {label}
    </button>
  )

  return (
    <div className="mx-auto min-h-dvh max-w-md bg-zinc-950 pt-[env(safe-area-inset-top)] pb-[calc(5.5rem+var(--safe-bottom))] text-zinc-100">
      {/* Закрывает область под статус-баром (iOS black-translucent), чтобы контент не просвечивал */}
      <div aria-hidden className="fixed inset-x-0 top-0 z-40 h-[env(safe-area-inset-top)] bg-zinc-950" />
      <AutoBackupBanner />
      <header className="sticky top-[env(safe-area-inset-top)] z-30 flex h-14 items-center justify-between bg-zinc-950/95 px-4 backdrop-blur">
        <h1 ref={heading} tabIndex={-1} className="truncate text-2xl font-bold tracking-tight text-zinc-50 outline-none">{SCREEN_TITLES[screen]}</h1>
        <button
          type="button"
          onClick={() => onNavigate('settings')}
          aria-label="Настройки"
          aria-current={screen === 'settings' ? 'page' : undefined}
          className={cn(
            'grid size-11 place-items-center rounded-xl active:bg-zinc-900',
            screen === 'settings' ? 'bg-zinc-900 text-accent-fg' : 'text-zinc-400',
          )}
        >
          <Settings className="size-5" aria-hidden />
        </button>
      </header>
      <main>{children}</main>
      <nav
        aria-label="Основная навигация"
        className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md items-end border-t border-zinc-800 bg-zinc-950/95 pb-[var(--safe-bottom)] backdrop-blur"
      >
        {left.map(renderTab)}
        <div className="flex w-16 justify-center">
          <button
            type="button"
            onClick={onAdd}
            aria-label="Добавить операцию"
            className="-mt-6 grid size-14 place-items-center rounded-full bg-accent text-on-accent shadow-lg shadow-accent/30 active:scale-95"
          >
            <Plus className="size-7" aria-hidden />
          </button>
        </div>
        {right.map(renderTab)}
      </nav>
    </div>
  )
}
