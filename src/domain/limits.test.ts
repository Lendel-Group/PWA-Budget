import { describe, expect, it } from 'vitest'
import { accountFieldErrors } from './accounts'
import { parsePlanInput } from './budget'
import { MAX_AMOUNT, validateNewTransaction } from './finance'
import { applyAmountInput } from './numpad'
import { amountFieldError, debtFieldErrors, goalFieldErrors } from './planning'
import { parseRatesFile } from './rates'
import { formatNumber } from '../lib/format'

/** Предельные значения (budget-spec, spec/02). */
describe('limits', () => {
  it('amount fields: at max ok, above max — «Слишком большая сумма»', () => {
    expect(amountFieldError(MAX_AMOUNT)).toBeUndefined()
    expect(amountFieldError(1e10)).toBe('Слишком большая сумма')
    expect(goalFieldErrors({ title: 'A', targetAmount: 1e10, targetDate: '2026-11-05' }, '2026-11-05').targetAmount).toBe('Слишком большая сумма')
    expect(Object.keys(debtFieldErrors({ name: 'A', totalAmount: 1e10, remainingAmount: 1e10, monthlyPayment: 1e10, dueDay: 5 })))
      .toEqual(['totalAmount', 'remainingAmount', 'monthlyPayment'])
    expect(accountFieldErrors({ name: 'A', type: 'card', currency: 'KZT', initialBalance: -1e10 }).initialBalance).toBe('Слишком большая сумма')
    expect(accountFieldErrors({ name: 'A', type: 'card', currency: 'KZT', initialBalance: -MAX_AMOUNT })).toEqual({})
  })
  it('operation and plan input', () => {
    const tx = { date: '2026-11-05', type: 'expense' as const, accountId: 'a', categoryId: 'c', amount: 1e10, isExcludedFromNoSpend: false }
    expect(() => validateNewTransaction(tx)).toThrow('Слишком большая сумма')
    expect(() => validateNewTransaction({ ...tx, amount: MAX_AMOUNT })).not.toThrow()
    expect(parsePlanInput('10 000 000 000')).toBeNull()
    expect(parsePlanInput('9 999 999 999,99')).toBe(MAX_AMOUNT)
  })
  it('rates above max are dropped', () => {
    expect(parseRatesFile({ date: '2026-11-05', rates: { USD: 500, EUR: 1000001 } })?.rates).toEqual({ USD: 500 })
  })
  it('applyAmountInput keeps numpad limits', () => {
    expect(applyAmountInput('', '1 234,5')).toBe('1234.5')
    expect(applyAmountInput('1234.56', '1234.567')).toBe('1234.56')
    expect(applyAmountInput('9999999999', '99999999999')).toBe('9999999999')
    expect(applyAmountInput('1.2', '1.2.3')).toBe('1.2')
    expect(applyAmountInput('5', '')).toBe('')
  })
  it('formatNumber does not throw on non-finite', () => {
    expect([formatNumber(Infinity), formatNumber(-Infinity), formatNumber(NaN)]).toEqual(['∞', '-∞', 'не\u00a0число'])
  })
})
