import { describe, expect, it } from 'vitest'
import { toNumber } from './form'

describe('toNumber', () => {
  it('запятая, пробелы, пусто', () => {
    expect(toNumber('1 234,5')).toBe(1234.5)
    expect(toNumber('')).toBeNaN()
    expect(toNumber('abc')).toBeNaN()
  })
  it('бесконечность — не число (budget-spec, spec/02)', () => {
    expect(toNumber('1e400')).toBeNaN()
    expect(toNumber('-1e400')).toBeNaN()
    expect(toNumber('Infinity')).toBeNaN()
    expect(toNumber('1e300')).toBe(1e300)
  })
})
