import { useEffect, useState } from 'react'

export type Route = 'home' | 'budget' | 'analytics' | 'goals' | 'settings'
export const ROUTES: Route[] = ['home', 'budget', 'analytics', 'goals', 'settings']

const read = (): Route => {
  const h = window.location.hash.replace(/^#\/?/, '') as Route
  return ROUTES.includes(h) ? h : 'home'
}

export function useHashRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(read)
  useEffect(() => {
    const onChange = () => setRoute(read())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return [route, (r) => { window.location.hash = `/${r}` }]
}
