import { useEffect, useState } from 'react'
import { toLocalDateString } from '../domain/dates'

/** Сегодняшняя дата (YYYY-MM-DD), обновляется после полуночи и при возврате в приложение. */
export function useToday(): string {
  const [today, setToday] = useState(() => toLocalDateString(new Date()))
  useEffect(() => {
    const update = () => setToday(toLocalDateString(new Date()))
    const id = setInterval(update, 60_000)
    document.addEventListener('visibilitychange', update)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])
  return today
}
