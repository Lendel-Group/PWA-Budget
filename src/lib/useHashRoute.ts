import { useEffect, useState } from 'react'
import { parseRoute, type Route } from '../domain/routes'

export type { Route }

export function useHashRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return [route, (r) => { window.location.hash = `/${r}` }]
}
