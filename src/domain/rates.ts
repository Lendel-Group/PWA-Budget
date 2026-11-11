import type { Currency } from '../db/schema'
import { MAX_RATE, type Rates } from './finance'

const SUPPORTED: Exclude<Currency, 'KZT'>[] = ['USD', 'EUR', 'RUB']

export interface RatesFile {
  /** YYYY-MM-DD — дата, на которую действуют курсы (по Алматы). */
  date: string
  rates: Rates
}

/**
 * Разбирает latest.json из репозитория nbk-rates: { date, rates: { USD: 453.26, ... } },
 * где курс — тенге за 1 единицу валюты. Возвращает null, если формат неверный
 * или нет ни одной поддерживаемой валюты.
 */
export function parseRatesFile(data: unknown): RatesFile | null {
  if (typeof data !== 'object' || data === null) return null
  const { date, rates } = data as { date?: unknown; rates?: unknown }
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  if (typeof rates !== 'object' || rates === null) return null

  const result: Rates = {}
  for (const code of SUPPORTED) {
    const value = (rates as Record<string, unknown>)[code]
    if (typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= MAX_RATE) result[code] = value
  }
  return Object.keys(result).length === 0 ? null : { date, rates: result }
}
