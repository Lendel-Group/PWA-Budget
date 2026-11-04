import type { Currency } from '../db/schema'

const SYMBOLS: Record<Currency, string> = { KZT: '₸', USD: '$', RUB: '₽', EUR: '€' }

export function formatMoney(amount: number, currency: Currency = 'KZT'): string {
  const hasFraction = Math.abs(amount % 1) > 0
  const num = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount)
  return `${num} ${SYMBOLS[currency]}`
}
