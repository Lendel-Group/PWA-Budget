import type { Currency } from '../db/schema'
import type { Rates } from './finance'

const SUPPORTED: Exclude<Currency, 'KZT'>[] = ['USD', 'EUR', 'RUB']

/** YYYY-MM-DD → DD.MM.YYYY (формат запроса Нацбанка РК). */
export function toNbkDate(date: string): string {
  const [y, m, d] = date.split('-')
  return `${d}.${m}.${y}`
}

export const nbkRatesUrl = (date: string) =>
  `https://nationalbank.kz/rss/get_rates.cfm?fdate=${toNbkDate(date)}`

/** Разбирает XML официальных курсов НБ РК → курсы к KZT за 1 единицу валюты. */
export function parseNbkRates(xml: string): Rates {
  const rates: Rates = {}
  for (const item of xml.match(/<item>[\s\S]*?<\/item>/g) ?? []) {
    const code = /<title>\s*([A-Z]{3})\s*<\/title>/.exec(item)?.[1] as Currency | undefined
    if (!code || !SUPPORTED.includes(code as (typeof SUPPORTED)[number])) continue
    const value = Number(/<description>\s*([\d.,]+)\s*<\/description>/.exec(item)?.[1]?.replace(',', '.'))
    const quant = Number(/<quant>\s*(\d+)\s*<\/quant>/.exec(item)?.[1] ?? 1)
    if (Number.isFinite(value) && value > 0 && quant > 0) rates[code] = value / quant
  }
  return rates
}
