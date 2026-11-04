/** Маршруты приложения (`#/<route>`). Подразделы «Планов» — `goals`, `debts`, `nospend` — адресуются отдельными маршрутами. */
export type Route = 'home' | 'budget' | 'analytics' | 'goals' | 'debts' | 'nospend' | 'transactions' | 'settings'

export const ROUTES: readonly Route[] = ['home', 'budget', 'analytics', 'goals', 'debts', 'nospend', 'transactions', 'settings']

/** Экран — то, что видно как страница с заголовком; у «Планов» несколько маршрутов-подразделов. */
export type Screen = 'home' | 'budget' | 'analytics' | 'plans' | 'transactions' | 'settings'

export const PLANS_ROUTES = ['goals', 'debts', 'nospend'] as const satisfies readonly Route[]
export type PlansRoute = (typeof PLANS_ROUTES)[number]

export const isPlansRoute = (route: Route): route is PlansRoute => (PLANS_ROUTES as readonly Route[]).includes(route)

export const screenOf = (route: Route): Screen => (isPlansRoute(route) ? 'plans' : route)

/** `location.hash` → маршрут; неизвестное и пустое — главная. */
export function parseRoute(hash: string): Route {
  const name = hash.replace(/^#\/?/, '') as Route
  return ROUTES.includes(name) ? name : 'home'
}
