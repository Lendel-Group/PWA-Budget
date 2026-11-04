import { describe, expect, it } from 'vitest'
import { accountFieldErrors, pickAccount, validateAccountInput, type AccountInput } from './accounts'

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

describe('pickAccount', () => {
  const acc = (id: string, isArchived = false) => ({ id, isArchived })
  const list = [acc('a'), acc('b'), acc('c', true)]

  it('явный выбор важнее всего, даже архивный (редактирование)', () => {
    expect(pickAccount(list, 'c', 'b')?.id).toBe('c')
  })
  it('без выбора — счёт последней операции', () => {
    expect(pickAccount(list, undefined, 'b')?.id).toBe('b')
  })
  it('последний счёт в архиве — первый активный', () => {
    expect(pickAccount(list, undefined, 'c')?.id).toBe('a')
  })
  it('последний счёт неизвестен или не задан — первый активный', () => {
    expect(pickAccount(list, undefined, 'zzz')?.id).toBe('a')
    expect(pickAccount(list)?.id).toBe('a')
  })
  it('все счета в архиве — первый в списке; пустой список — undefined', () => {
    expect(pickAccount([acc('x', true), acc('y', true)])?.id).toBe('x')
    expect(pickAccount([])).toBeUndefined()
  })
})

describe('accountFieldErrors', () => {
  it('нет ошибок — пустой объект', () => {
    expect(accountFieldErrors(a())).toEqual({})
  })
  it('ошибки привязаны к полям и собираются все сразу', () => {
    expect(accountFieldErrors(a({ name: ' ', initialBalance: NaN }))).toEqual({
      name: 'Укажите название счёта',
      initialBalance: 'Начальный остаток должен быть числом',
    })
    expect(Object.keys(accountFieldErrors(a({ initialBalance: Infinity })))).toEqual(['initialBalance'])
  })
})
