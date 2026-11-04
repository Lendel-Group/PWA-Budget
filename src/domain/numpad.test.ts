import { describe, expect, it } from 'vitest'
import { applyNumpadKey, displayAmount, parseAmount, type NumpadKey } from './numpad'

const type = (keys: NumpadKey[]) => keys.reduce(applyNumpadKey, '')

describe('applyNumpadKey', () => {
  it('appends digits', () => expect(type(['1', '2', '5'])).toBe('125'))
  it('replaces a lone leading zero', () => expect(type(['0', '5'])).toBe('5'))
  it('ignores repeated zeros', () => expect(type(['0', '0', '0'])).toBe('0'))
  it('dot on empty gives 0.', () => expect(type(['.'])).toBe('0.'))
  it('dot after digits', () => expect(type(['7', '.', '5'])).toBe('7.5'))
  it('ignores a second dot', () => expect(type(['7', '.', '.', '5'])).toBe('7.5'))
  it('limits decimals to 2', () => expect(type(['1', '.', '2', '3', '4'])).toBe('1.23'))
  it('limits integer digits', () => {
    expect(type(Array(12).fill('9') as NumpadKey[])).toBe('9'.repeat(10))
  })
  it('allows zero before the dot', () => expect(type(['0', '.', '0', '5'])).toBe('0.05'))
  it('backspace removes the last char, safe on empty', () => {
    expect(applyNumpadKey('12', 'backspace')).toBe('1')
    expect(applyNumpadKey('', 'backspace')).toBe('')
  })
})

describe('parseAmount / displayAmount', () => {
  it('parses', () => {
    expect(parseAmount('12.5')).toBe(12.5)
    expect(parseAmount('')).toBe(0)
    expect(parseAmount('0.')).toBe(0)
    expect(parseAmount('abc')).toBe(0)
  })
  it('displays zero for empty', () => {
    expect(displayAmount('')).toBe('0')
    expect(displayAmount('5.')).toBe('5.')
  })
})
