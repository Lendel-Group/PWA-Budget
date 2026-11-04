/**
 * Маршруты приложения (`#/<route>`). Подразделы адресуются отдельными маршрутами: «Планы» — `goals`, `debts`;
 * «Аналитика» — `analytics` (обзор по годам), `nospend` (дни без трат).
 */
export type Route = 'home' | 'budget' | 'analytics' | 'goals' | 'debts' | 'nospend' | 'transactions' | 'settings'

export const ROUTES: readonly Route[] = ['home', 'budget', 'analytics', 'goals', 'debts', 'nospend', 'transactions', 'settings']

/** Экран — то, что видно как страница с заголовком; у «Планов» несколько маршрутов-подразделов. */
export type Screen = 'home' | 'budget' | 'analytics' | 'plans' | 'transactions' | 'settings'

export const PLANS_ROUTES = ['goals', 'debts'] as const satisfies readonly Route[]
export type PlansRoute = (typeof PLANS_ROUTES)[number]
export const ANALYTICS_ROUTES = ['analytics', 'nospend'] as const satisfies readonly Route[]
export type AnalyticsRoute = (typeof ANALYTICS_ROUTES)[number]

export const isPlansRoute = (route: Route): route is PlansRoute => (PLANS_ROUTES as readonly Route[]).includes(route)
export const isAnalyticsRoute = (route: Route): route is AnalyticsRoute => (ANALYTICS_ROUTES as readonly Route[]).includes(route)

export const screenOf = (route: Route): Screen =>
  isPlansRoute(route) ? 'plans' : route === 'nospend' ? 'analytics' : route

/** Маршрут, на который ведёт вкладка экрана, если пользователь ещё не был в его подразделах. */
export const defaultRoute = (screen: Screen): Route => (screen === 'plans' ? 'goals' : screen)

/** `location.hash` → маршрут; неизвестное и пустое — главная. */
export function parseRoute(hash: string): Route {
  const name = hash.replace(/^#\/?/, '') as Route
  return ROUTES.includes(name) ? name : 'home'
}
