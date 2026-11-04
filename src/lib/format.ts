import type { Currency } from '../db/schema'

const symbols = new Map<Currency, string>()

/**
 * Знак валюты («₸», «$», «€», «₽») из самого Intl, без ручной таблицы и без разбора строки
 * `formatMoney`. Если Intl знака не знает, возвращается код валюты («KZT»).
 */
export function currencySymbol(currency: Currency): string {
  let symbol = symbols.get(currency)
  if (symbol === undefined) {
    const parts = new Intl.NumberFormat('ru-RU', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).formatToParts(0)
    symbol = parts.find((p) => p.type === 'currency')?.value ?? currency
    symbols.set(currency, symbol)
  }
  return symbol
}

/** Число без знака валюты: «5 000», «12,50» (копейки показываются только если они есть). */
export function formatNumber(amount: number): string {
  const hasFraction = Math.abs(amount % 1) > 0
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatMoney(amount: number, currency: Currency = 'KZT'): string {
  return `${formatNumber(amount)} ${currencySymbol(currency)}`
}
