import { describe, expect, it } from 'vitest'
import { parseRatesFile } from './rates'

describe('parseRatesFile', () => {
  it('keeps supported currencies and ignores the rest', () => {
    expect(parseRatesFile({
      date: '2026-11-04', source: 'x', fetchedAt: 'y',
      rates: { USD: 453.26, EUR: 506.7, RUB: 5.58, KRW: 0.3371, GBP: 600 },
    })).toEqual({ date: '2026-11-04', rates: { USD: 453.26, EUR: 506.7, RUB: 5.58 } })
  })
  it('accepts a partial set', () => {
    expect(parseRatesFile({ date: '2026-11-04', rates: { USD: 450 } })).toEqual({ date: '2026-11-04', rates: { USD: 450 } })
  })
  it('skips invalid values (zero, negative, NaN, strings)', () => {
    expect(parseRatesFile({ date: '2026-11-04', rates: { USD: 0, EUR: -1, RUB: '5', KZT: 1 } })).toBeNull()
    expect(parseRatesFile({ date: '2026-11-04', rates: { USD: Number.NaN, EUR: 500 } })).toEqual({ date: '2026-11-04', rates: { EUR: 500 } })
  })
  it.each([
    ['null', null], ['string', 'x'], ['no date', { rates: { USD: 1 } }],
    ['bad date', { date: '04.11.2026', rates: { USD: 1 } }], ['numeric date', { date: 20261104, rates: { USD: 1 } }],
    ['no rates', { date: '2026-11-04' }], ['null rates', { date: '2026-11-04', rates: null }],
    ['empty rates', { date: '2026-11-04', rates: {} }],
  ])('rejects %s', (_n, input) => expect(parseRatesFile(input)).toBeNull())
})
