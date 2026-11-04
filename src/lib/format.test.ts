import { describe, expect, it } from 'vitest'
import { currencySymbol, formatMoney, formatNumber } from './format'

describe('currencySymbol', () => {
  it.each([
    ['KZT', '₸'],
    ['USD', '$'],
    ['EUR', '€'],
    ['RUB', '₽'],
  ] as const)('%s → %s', (code, symbol) => {
    expect(currencySymbol(code)).toBe(symbol)
  })

  it('повторный вызов возвращает то же значение (кэш)', () => {
    expect(currencySymbol('KZT')).toBe(currencySymbol('KZT'))
  })
})

describe('formatNumber', () => {
  it('целые без копеек, дробные с двумя знаками, пробел-разделитель тысяч', () => {
    expect(formatNumber(5000)).toBe('5 000')
    expect(formatNumber(12.5)).toBe('12,50')
    expect(formatNumber(0)).toBe('0')
    expect(formatNumber(-1234567)).toMatch(/^[-−]1 234 567$/)
  })
})

describe('formatMoney', () => {
  it('число и знак валюты через пробел; по умолчанию тенге', () => {
    expect(formatMoney(5000)).toBe('5 000 ₸')
    expect(formatMoney(12.5, 'USD')).toBe('12,50 $')
    expect(formatMoney(100, 'EUR')).toBe('100 €')
    expect(formatMoney(100, 'RUB')).toBe('100 ₽')
  })
})
