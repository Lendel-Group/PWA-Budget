import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import type { Rates } from '../domain/finance'
import type { StoredRates } from '../services/ratesService'

export function useRates(): { rates: Rates; stored?: StoredRates } {
  const stored = useLiveQuery(async () => (await db.config.get('fx_rates'))?.value as StoredRates | undefined, [])
  return { rates: stored?.rates ?? {}, stored }
}
