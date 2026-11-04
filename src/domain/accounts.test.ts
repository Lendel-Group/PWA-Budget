import { describe, expect, it } from 'vitest'
import { validateAccountInput, type AccountInput } from './accounts'

const a = (o: Partial<AccountInput> = {}): AccountInput => ({ name: 'Kaspi', type: 'card', currency: 'KZT', initialBalance: 0, ...o })

describe('validateAccountInput', () => {
  it('accepts valid and negative balances', () => {
    expect(validateAccountInput(a())).toBeUndefined()
    expect(validateAccountInput(a({ initialBalance: -500 }))).toBeUndefined()
  })
  it('rejects blank names and non-finite balances', () => {
    expect(validateAccountInput(a({ name: '  ' }))).toMatch(/название/)
    expect(validateAccountInput(a({ initialBalance: NaN }))).toMatch(/числом/)
  })
})
