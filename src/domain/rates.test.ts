import { describe, expect, it } from 'vitest'
import { nbkRatesUrl, parseNbkRates, toNbkDate } from './rates'

const item = (code: string, value: string, quant = '1') =>
  `<item><fullname>X</fullname><title>${code}</title><description>${value}</description><quant>${quant}</quant></item>`

describe('rates', () => {
  it('formats date and url', () => {
    expect(toNbkDate('2026-11-04')).toBe('04.11.2026')
    expect(nbkRatesUrl('2026-11-04')).toContain('fdate=04.11.2026')
  })
  it('parses supported currencies and divides by quant', () => {
    const xml = `<rates>${item('USD', '453.26')}${item('EUR', '506,7')}${item('RUB', '55.8', '10')}${item('AUD', '316.28')}</rates>`
    expect(parseNbkRates(xml)).toEqual({ USD: 453.26, EUR: 506.7, RUB: 5.58 })
  })
  it('defaults quant to 1 and skips malformed items', () => {
    const xml = `<item><title>USD</title><description>450</description></item>
      <item><description>1</description></item>
      <item><title>EUR</title><description>abc</description><quant>1</quant></item>
      <item><title>RUB</title><description>5</description><quant>0</quant></item>`
    expect(parseNbkRates(xml)).toEqual({ USD: 450 })
  })
  it('returns empty rates for junk', () => {
    expect(parseNbkRates('')).toEqual({})
    expect(parseNbkRates('<html/>')).toEqual({})
  })
})
