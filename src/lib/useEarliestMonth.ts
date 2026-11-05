import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { earliestMonth, type Month } from '../domain/period'

/** Месяц первых данных: первая операция и (опционально) первый лимит бюджета. undefined — пока грузится. */
export function useEarliestMonth(withLimits: boolean): Month | null | undefined {
  return useLiveQuery(async () => {
    const firstTx = await db.transactions.orderBy('date').first()
    const firstLimit = withLimits ? await db.budgetLimits.orderBy('[year+month]').first() : undefined
    const limitDate = firstLimit ? `${firstLimit.year}-${String(firstLimit.month).padStart(2, '0')}-01` : undefined
    return earliestMonth([firstTx?.date, limitDate])
  }, [withLimits])
}
