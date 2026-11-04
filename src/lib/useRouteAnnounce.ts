import { useEffect, useRef, type RefObject } from 'react'
import { documentTitle } from './routeTitle'

/**
 * Смена экрана в одностраничном приложении: обновляет `document.title`, возвращает прокрутку наверх
 * и переносит фокус на заголовок `h1` нового экрана — так скринридер объявляет, что страница сменилась.
 * При первой загрузке заголовок обновляется, но фокус и прокрутка не трогаются.
 */
export function useRouteAnnounce(route: string, screenTitle: string, heading: RefObject<HTMLElement | null>) {
  const previous = useRef(route)

  useEffect(() => {
    document.title = documentTitle(screenTitle)
  }, [screenTitle])

  useEffect(() => {
    // Сравнение с предыдущим маршрутом, а не флаг «первый запуск»: эффекты в StrictMode выполняются дважды
    if (previous.current === route) return
    previous.current = route
    window.scrollTo(0, 0)
    heading.current?.focus({ preventScroll: true })
  }, [route, heading])
}
