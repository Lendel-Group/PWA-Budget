import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { calculateNoSpendStreak, getDatesWithExpenses } from '../domain/finance'
import { getFirstTrackedDate } from '../domain/planning'
import { useToday } from './useToday'

export interface NoSpendStats {
  /** Дни с расходами, нарушающими серию. */
  dates: Set<string>
  /** Первая дата, с которой ведётся учёт. */
  firstTracked: string
  currentStreak: number
  cleanDaysThisMonth: number
}

/** Серия дней без трат и данные календаря; `undefined`, пока данные грузятся. Общий для «Аналитики» и главной. */
export function useNoSpendStats(): NoSpendStats | undefined {
  const today = useToday()
  const accounts = useLiveQuery(() => db.accounts.toArray(), [])
  const expenses = useLiveQuery(() => db.transactions.where('type').equals('expense').toArray(), [])
  const first = useLiveQuery(() => db.transactions.orderBy('date').limit(1).toArray(), [])
  if (!accounts || !expenses || !first) return undefined
  const dates = getDatesWithExpenses(expenses)
  const firstTracked = getFirstTrackedDate(accounts, first, today)
  return { dates, firstTracked, ...calculateNoSpendStreak(dates, today, firstTracked) }
}
