import { db } from '../db/schema'
import type { Rates } from '../domain/finance'
import { parseRatesFile } from '../domain/rates'

/**
 * Копия официальных курсов НБ РК (репозиторий nbk-rates на GitHub Pages).
 * Можно переопределить при сборке: VITE_RATES_URL.
 */
export const RATES_URL: string =
  import.meta.env.VITE_RATES_URL ?? 'https://al-writer.github.io/nbk-rates/latest.json'

export interface StoredRates {
  rates: Rates
  /** YYYY-MM-DD: для 'nbk' — дата курсов, для 'manual' — дата ввода. */
  date: string
  source: 'nbk' | 'manual'
}

export interface RefreshResult {
  rates?: StoredRates
  /** true, если курсы были успешно загружены из сети в этом вызове. */
  fetched: boolean
}

export async function getStoredRates(): Promise<StoredRates | undefined> {
  return (await db.config.get('fx_rates'))?.value as StoredRates | undefined
}

export async function setManualRates(rates: Rates, date: string): Promise<void> {
  await db.config.put({ key: 'fx_rates', value: { rates, date, source: 'manual' } satisfies StoredRates })
}

/**
 * Загружает актуальные курсы (один небольшой JSON с того же github.io). Единственный
 * внешний запрос приложения; офлайн или при ошибке остаются сохранённые/введённые вручную курсы.
 * Курсы старше уже сохранённых не принимаются.
 */
export async function refreshRates(
  today: string,
  fetchImpl: typeof fetch = fetch,
  force = false,
  url: string = RATES_URL,
): Promise<RefreshResult> {
  const stored = await getStoredRates()
  if (!force && stored?.date === today) return { rates: stored, fetched: false }
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(8000), cache: 'no-cache' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const file = parseRatesFile(await res.json())
    if (!file) throw new Error('неверный формат файла курсов')
    if (stored && file.date < stored.date) return { rates: stored, fetched: false }
    const fresh: StoredRates = { rates: file.rates, date: file.date, source: 'nbk' }
    await db.config.put({ key: 'fx_rates', value: fresh })
    return { rates: fresh, fetched: true }
  } catch (e) {
    console.info('[rates] используем сохранённые курсы:', e instanceof Error ? e.message : e)
    return { rates: stored, fetched: false }
  }
}
