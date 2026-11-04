import type { ReactNode } from 'react'
import { BarChart3, Home, PiggyBank, Plus, Settings, Wallet, type LucideIcon } from 'lucide-react'
import { cn } from '../../lib/cn'
import type { Route } from '../../lib/useHashRoute'
import { InstallBanner } from '../pwa/InstallBanner'
import { AutoBackupBanner } from './AutoBackupBanner'

const TABS: { route: Route; label: string; icon: LucideIcon }[] = [
  { route: 'home', label: 'Главная', icon: Home },
  { route: 'budget', label: 'Бюджет', icon: Wallet },
  { route: 'analytics', label: 'Аналитика', icon: BarChart3 },
  { route: 'goals', label: 'Цели', icon: PiggyBank },
]

interface Props {
  route: Route
  onNavigate: (r: Route) => void
  onAdd: () => void
  children: ReactNode
}

export function AppLayout({ route, onNavigate, onAdd, children }: Props) {
  const left = TABS.slice(0, 2)
  const right = TABS.slice(2)

  const renderTab = ({ route: r, label, icon: Icon }: (typeof TABS)[number]) => (
    <button
      key={r}
      type="button"
      onClick={() => onNavigate(r)}
      aria-current={route === r ? 'page' : undefined}
      className={cn(
        'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]',
        route === r ? 'text-emerald-400' : 'text-zinc-500',
      )}
    >
      <Icon className="size-5" aria-hidden />
      {label}
    </button>
  )

  return (
    <div className="mx-auto min-h-screen max-w-md bg-zinc-950 pb-20 text-zinc-100">
      <InstallBanner />
      <AutoBackupBanner />
      <header className="sticky top-0 z-30 flex h-12 items-center justify-between bg-zinc-950/95 px-4 backdrop-blur">
        <span className="text-sm font-medium text-zinc-500">My Budget 2026</span>
        <button
          type="button"
          onClick={() => onNavigate('settings')}
          aria-label="Настройки"
          aria-current={route === 'settings' ? 'page' : undefined}
          className={cn(
            'grid size-10 place-items-center rounded-xl active:bg-zinc-900',
            route === 'settings' ? 'bg-zinc-900 text-emerald-400' : 'text-zinc-400',
          )}
        >
          <Settings className="size-5" aria-hidden />
        </button>
      </header>
      <main>{children}</main>
      <nav
        aria-label="Основная навигация"
        className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md items-end border-t border-zinc-800 bg-zinc-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        {left.map(renderTab)}
        <div className="flex w-16 justify-center">
          <button
            type="button"
            onClick={onAdd}
            aria-label="Добавить операцию"
            className="-mt-6 grid size-14 place-items-center rounded-full bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-500/30 active:scale-95"
          >
            <Plus className="size-7" aria-hidden />
          </button>
        </div>
        {right.map(renderTab)}
      </nav>
    </div>
  )
}
