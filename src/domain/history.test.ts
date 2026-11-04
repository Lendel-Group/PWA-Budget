import { describe, expect, it } from 'vitest'
import type { Account, Transaction } from '../db/schema'
import {
  EMPTY_FILTER, filterTransactions, groupByDay, isFilterActive, periodRange, takeGroups,
} from './history'

const accounts = [
  { id: 'k', currency: 'KZT' }, { id: 'u', currency: 'USD' },
] as Account[]
const tx = (o: Partial<Transaction>): Transaction => ({
  id: 't', date: '2026-11-04', timestamp: 0, type: 'expense', accountId: 'k', amount: 100,
  categoryId: 'food', isExcludedFromNoSpend: false, ...o,
})

describe('isFilterActive', () => {
  it('false for the empty filter, true for each field', () => {
    expect(isFilterActive(EMPTY_FILTER)).toBe(false)
    for (const patch of [{ type: 'income' }, { accountId: 'k' }, { categoryId: 'x' }, { from: '2026-01-01' }, { to: '2026-01-01' }]) {
      expect(isFilterActive({ ...EMPTY_FILTER, ...patch } as typeof EMPTY_FILTER)).toBe(true)
    }
  })
})

describe('filterTransactions', () => {
  const txs = [
    tx({ id: '1', date: '2026-11-04' }),
    tx({ id: '2', date: '2026-10-15', type: 'income', categoryId: 'salary', accountId: 'u' }),
    tx({ id: '3', date: '2026-10-01', type: 'transfer', accountId: 'k', toAccountId: 'u', categoryId: undefined }),
  ]
  const ids = (f: Partial<typeof EMPTY_FILTER>) => filterTransactions(txs, { ...EMPTY_FILTER, ...f }).map((t) => t.id)

  it('empty filter keeps everything', () => expect(ids({})).toEqual(['1', '2', '3']))
  it('by type', () => expect(ids({ type: 'income' })).toEqual(['2']))
  it('by account matches both sides of a transfer', () => {
    expect(ids({ accountId: 'u' })).toEqual(['2', '3'])
    expect(ids({ accountId: 'k' })).toEqual(['1', '3'])
  })
  it('by category', () => expect(ids({ categoryId: 'salary' })).toEqual(['2']))
  it('date range is inclusive on both ends', () => {
    expect(ids({ from: '2026-10-15', to: '2026-11-04' })).toEqual(['1', '2'])
    expect(ids({ from: '2026-10-16' })).toEqual(['1'])
    expect(ids({ to: '2026-10-01' })).toEqual(['3'])
  })
  it('filters combine with AND', () => expect(ids({ type: 'income', accountId: 'k' })).toEqual([]))
})

describe('periodRange', () => {
  it('all', () => expect(periodRange('all', '2026-11-04')).toEqual({ from: '', to: '' }))
  it('current month spans the whole month', () => {
    expect(periodRange('month', '2026-11-04')).toEqual({ from: '2026-11-01', to: '2026-11-30' })
    expect(periodRange('month', '2024-02-10')).toEqual({ from: '2024-02-01', to: '2024-02-29' })
  })
  it('previous month, across a year boundary', () => {
    expect(periodRange('prev-month', '2026-11-04')).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(periodRange('prev-month', '2026-01-15')).toEqual({ from: '2025-12-01', to: '2025-12-31' })
  })
  it('last 30 days includes today', () => {
    expect(periodRange('30d', '2026-11-04')).toEqual({ from: '2026-10-06', to: '2026-11-04' })
  })
})

describe('groupByDay', () => {
  it('empty', () => expect(groupByDay([], accounts)).toEqual([]))

  it('sorts days and items newest first', () => {
    const groups = groupByDay([
      tx({ id: 'old', date: '2026-11-01' }),
      tx({ id: 'a', date: '2026-11-04', timestamp: 1 }),
      tx({ id: 'b', date: '2026-11-04', timestamp: 2 }),
    ], accounts)
    expect(groups.map((g) => g.date)).toEqual(['2026-11-04', '2026-11-01'])
    expect(groups[0].items.map((t) => t.id)).toEqual(['b', 'a'])
  })

  it('total = income − expense in KZT, converting foreign currency', () => {
    const [g] = groupByDay([
      tx({ amount: 1000 }), tx({ type: 'income', amount: 5000 }), tx({ amount: 2, accountId: 'u' }),
    ], accounts, { USD: 450 })
    expect(g.totalKzt).toBe(3100)
  })

  it('goal and debt payments count as spending', () => {
    const [g] = groupByDay([tx({ amount: 300, goalId: 'g' }), tx({ amount: 200, debtId: 'd' })], accounts)
    expect(g.totalKzt).toBe(-500)
  })

  it('total is null when only transfers, unknown accounts or missing rates', () => {
    const [g] = groupByDay([
      tx({ type: 'transfer', toAccountId: 'u' }), tx({ accountId: 'ghost' }), tx({ accountId: 'u' }),
    ], accounts)
    expect(g.totalKzt).toBeNull()
    expect(g.items).toHaveLength(3)
  })

  it('avoids float drift', () => {
    const [g] = groupByDay([tx({ amount: 0.1 }), tx({ amount: 0.2 })], accounts)
    expect(g.totalKzt).toBe(-0.3)
  })
})

describe('takeGroups', () => {
  const groups = groupByDay([
    tx({ id: '1', date: '2026-11-04' }), tx({ id: '2', date: '2026-11-04' }),
    tx({ id: '3', date: '2026-11-03' }), tx({ id: '4', date: '2026-11-02' }),
  ], accounts)

  it('never splits a day: stops once the minimum is reached', () => {
    expect(takeGroups(groups, 1).map((g) => g.date)).toEqual(['2026-11-04'])
    expect(takeGroups(groups, 3).map((g) => g.date)).toEqual(['2026-11-04', '2026-11-03'])
  })
  it('returns everything when the minimum exceeds the total; nothing for 0', () => {
    expect(takeGroups(groups, 100)).toHaveLength(3)
    expect(takeGroups(groups, 0)).toEqual([])
  })
})
