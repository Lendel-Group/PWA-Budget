import { db } from '../db/schema'
import type { Rates } from '../domain/finance'
import { nbkRatesUrl, parseNbkRates } from '../domain/rates'

export interface StoredRates {
  rates: Rates
  /** YYYY-MM-DD, на какую дату получены/введены курсы. */
  date: string
  source: 'nbk' | 'manual'
}

export async function getStoredRates(): Promise<StoredRates | undefined> {
  return (await db.config.get('fx_rates'))?.value as StoredRates | undefined
}

export async function setManualRates(rates: Rates, date: string): Promise<void> {
  await db.config.put({ key: 'fx_rates', value: { rates, date, source: 'manual' } satisfies StoredRates })
}

/**
 * Пытается получить официальные курсы НБ РК раз в день. Единственный
 * внешний запрос приложения; при любой ошибке (офлайн, CORS) остаются
 * кэш или ручные курсы.
 */
export async function refreshRates(
  today: string,
  fetchImpl: typeof fetch = fetch,
  force = false,
): Promise<StoredRates | undefined> {
  const stored = await getStoredRates()
  if (!force && stored?.date === today) return stored
  try {
    const res = await fetchImpl(nbkRatesUrl(today), { signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const rates = parseNbkRates(await res.text())
    if (Object.keys(rates).length === 0) throw new Error('курсы не найдены в ответе')
    const fresh: StoredRates = { rates, date: today, source: 'nbk' }
    await db.config.put({ key: 'fx_rates', value: fresh })
    return fresh
  } catch (e) {
    console.info('[rates] используем сохранённые курсы:', e instanceof Error ? e.message : e)
    return stored
  }
}
