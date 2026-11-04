import { describe, expect, it } from 'vitest'
import { currencySymbol, formatMoney, formatNumber, formatShare, pluralRu } from './format'

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

describe('pluralRu', () => {
  const day = (n: number) => `${n} ${pluralRu(n, ['день', 'дня', 'дней'])}`
  it('1, 2–4, 5–20 и составные числа', () => {
    expect(['0', '1', '2', '4', '5', '11', '12', '14', '20', '21', '22', '25', '101', '111', '112'].map((n) => day(Number(n)))).toEqual([
      '0 дней', '1 день', '2 дня', '4 дня', '5 дней', '11 дней', '12 дней', '14 дней', '20 дней', '21 день', '22 дня', '25 дней', '101 день', '111 дней', '112 дней',
    ])
  })
  it('отрицательные числа склоняются по модулю', () => {
    expect(day(-1)).toBe('-1 день')
    expect(day(-3)).toBe('-3 дня')
  })
})

describe('formatShare', () => {
  it('округляет до целых процентов', () => {
    expect(formatShare(0.374)).toBe('37%')
    expect(formatShare(0.375)).toBe('38%')
    expect(formatShare(1)).toBe('100%')
    expect(formatShare(0)).toBe('0%')
  })
  it('ненулевая доля меньше полупроцента — «<1%»', () => {
    expect(formatShare(0.001)).toBe('<1%')
    expect(formatShare(0.0049)).toBe('<1%')
    expect(formatShare(0.005)).toBe('1%')
  })
})
