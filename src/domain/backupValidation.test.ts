import { describe, expect, it } from 'vitest'
import { BACKUP_APP_ID, BACKUP_SCHEMA_VERSION, BackupValidationError, parseBackup } from './backupValidation'

const valid = () => ({
  app: BACKUP_APP_ID,
  schemaVersion: BACKUP_SCHEMA_VERSION,
  exportedAt: '2026-11-04T00:00:00.000Z',
  data: {
    accounts: [
      { id: 'a', name: 'A', type: 'card', currency: 'KZT', initialBalance: 0, currentBalance: 5, isArchived: false, createdAt: 'x' },
      { id: 'b', name: 'B', type: 'cash', currency: 'USD', initialBalance: 0, currentBalance: 0, isArchived: false, createdAt: 'x' },
    ],
    categories: [{ id: 'c', name: 'C', type: 'expense', icon: 'i', color: '#fff', isDefault: true }],
    budgetLimits: [{ id: '2026-11-c', year: 2026, month: 11, categoryId: 'c', plannedAmount: 10 }],
    transactions: [
      { id: 't1', date: '2026-11-01', timestamp: 1, type: 'expense', accountId: 'a', amount: 1, isExcludedFromNoSpend: false, comment: 'hi', interestRate: undefined },
      { id: 't2', date: '2026-11-01', timestamp: 2, type: 'transfer', accountId: 'a', toAccountId: 'b', toAmount: 2, amount: 1, isExcludedFromNoSpend: true },
    ],
    debts: [{ id: 'd', name: 'D', totalAmount: 1, remainingAmount: 1, monthlyPayment: 1, dueDay: 1, interestRate: 3, createdAt: 'x', isClosed: false }],
    goals: [{ id: 'g', title: 'G', targetAmount: 1, currentAmount: 0, targetDate: '2027-01-01', icon: 'i', color: 'c', isAchieved: false }],
    config: [{ key: 'fx_rates', value: { USD: 500 } }],
  },
})
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Mut = (b: any) => void
const parse = (m?: Mut) => {
  const b = valid()
  m?.(b)
  return parseBackup(JSON.stringify(b))
}

describe('parseBackup', () => {
  it('accepts a valid file', () => {
    expect(parse().data.accounts).toHaveLength(2)
  })
  it('accepts empty tables', () => {
    expect(() => parse((b) => { for (const k of Object.keys(b.data)) b.data[k] = [] })).not.toThrow()
  })
  it('rejects invalid JSON', () => {
    expect(() => parseBackup('{oops')).toThrow(BackupValidationError)
  })
  it.each([['null', 'null'], ['array', '[]'], ['foreign app', '{"app":"x"}']])('rejects %s', (_n, s) => {
    expect(() => parseBackup(s)).toThrow(/не файл/)
  })
  it('rejects wrong schema version', () => {
    expect(() => parse((b) => { b.schemaVersion = 1 })).toThrow(/версия/)
  })
  it('rejects missing exportedAt / data', () => {
    expect(() => parse((b) => { delete b.exportedAt })).toThrow(/даты/)
    expect(() => parse((b) => { b.data = [] })).toThrow(/data/)
  })
  it('rejects non-array table and non-object row', () => {
    expect(() => parse((b) => { b.data.accounts = {} })).toThrow(/массив/)
    expect(() => parse((b) => { b.data.accounts = [1] })).toThrow(/объект/)
  })
  it('rejects bad field types', () => {
    expect(() => parse((b) => { b.data.accounts[0].name = 5 })).toThrow(/тип string/)
    expect(() => parse((b) => { b.data.accounts[0].isArchived = 'no' })).toThrow(/boolean/)
    expect(() => parse((b) => { b.data.accounts[0].currentBalance = 'x' })).toThrow(/число/)
    expect(() => parse((b) => { b.data.accounts[0].currentBalance = null })).toThrow(/число/)
    expect(() => parse((b) => { b.data.accounts[0].currency = 'GBP' })).toThrow(/недопустимое/)
    expect(() => parse((b) => { b.data.debts[0].interestRate = 'x' })).toThrow(/число/)
    expect(() => parse((b) => { b.data.transactions[0].comment = 3 })).toThrow(/string/)
  })
  it('rejects missing required field', () => {
    expect(() => parse((b) => { delete b.data.goals[0].title })).toThrow(/goals\[0\]\.title/)
  })
  it('rejects duplicate ids', () => {
    expect(() => parse((b) => { b.data.accounts[1].id = 'a'; b.data.transactions[1].toAccountId = 'a' })).toThrow(/повторяющийся/)
  })
  it('validates config', () => {
    expect(() => parse((b) => { b.data.config = {} })).toThrow(/config/)
    expect(() => parse((b) => { b.data.config = [null] })).toThrow(/некорректная/)
    expect(() => parse((b) => { b.data.config = [{ key: 1, value: 1 }] })).toThrow(/некорректная/)
    expect(() => parse((b) => { b.data.config = [{ key: 'k' }] })).toThrow(/некорректная/)
  })
  it('checks referential integrity of accounts', () => {
    expect(() => parse((b) => { b.data.transactions[0].accountId = 'zz' })).toThrow(/несуществующий/)
    expect(() => parse((b) => { b.data.transactions[1].toAccountId = 'zz' })).toThrow(/несуществующий/)
  })
})
