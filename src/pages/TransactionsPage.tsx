import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { HistoryFilters, type PeriodState } from '../components/transactions/HistoryFilters'
import { TransactionRow } from '../components/transactions/TransactionRow'
import { db } from '../db/schema'
import { formatDayHeading } from '../domain/dates'
import {
  EMPTY_FILTER, filterTransactions, groupByDay, periodRange, takeGroups, type HistoryFilter,
} from '../domain/history'
import { cn } from '../lib/cn'
import { formatMoney } from '../lib/format'
import { useDeleteTransaction } from '../lib/useDeleteTransaction'
import { useRates } from '../lib/useRates'
import { useToday } from '../lib/useToday'

/** Сколько операций показываем за раз; день целиком не обрывается. */
const PAGE_SIZE = 100
const DEFAULT_PERIOD: PeriodState = { preset: 'all', from: '', to: '' }

export default function TransactionsPage() {
  const today = useToday()
  const { rates } = useRates()
  const { remove, error } = useDeleteTransaction()
  const accounts = useLiveQuery(() => db.accounts.toArray(), [])
  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const all = useLiveQuery(() => db.transactions.toArray(), [])

  const [filter, setFilter] = useState<HistoryFilter>(EMPTY_FILTER)
  const [period, setPeriod] = useState<PeriodState>(DEFAULT_PERIOD)
  const [limit, setLimit] = useState(PAGE_SIZE)

  if (!accounts || !categories || !all) return null

  const range = period.preset === 'custom' ? { from: period.from, to: period.to } : periodRange(period.preset, today)
  const effective: HistoryFilter = { ...filter, ...range }
  const found = filterTransactions(all, effective)
  const groups = groupByDay(found, accounts, rates)
  const shown = takeGroups(groups, limit)
  const shownCount = shown.reduce((n, g) => n + g.items.length, 0)

  const updateFilter = (patch: Partial<HistoryFilter>) => { setFilter((f) => ({ ...f, ...patch })); setLimit(PAGE_SIZE) }
  const updatePeriod = (p: PeriodState) => { setPeriod(p); setLimit(PAGE_SIZE) }
  const reset = () => { setFilter(EMPTY_FILTER); setPeriod(DEFAULT_PERIOD); setLimit(PAGE_SIZE) }

  return (
    <section className="space-y-4 p-4">
      <HistoryFilters
        filter={filter} period={period} accounts={accounts} categories={categories} today={today}
        onFilter={updateFilter} onPeriod={updatePeriod} onReset={reset}
      />

      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

      {all.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-400">Операций пока нет. Нажмите «+», чтобы добавить первую.</p>
      ) : found.length === 0 ? (
        <div className="py-8 text-center text-sm text-zinc-400">
          <p>По выбранным фильтрам ничего не найдено.</p>
          <button type="button" onClick={reset} className="mt-2 min-h-11 text-emerald-400 underline">Сбросить фильтры</button>
        </div>
      ) : (
        <>
          <p className="text-xs text-zinc-400" role="status" data-testid="found">Операций: {found.length}</p>
          {shown.map((g) => (
            <div key={g.date}>
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-400">{formatDayHeading(g.date, today)}</h2>
                {g.totalKzt !== null && (
                  <span className={cn('text-xs tabular-nums', g.totalKzt > 0 ? 'text-emerald-400' : 'text-zinc-400')} data-testid={`day-total-${g.date}`}>
                    {g.totalKzt > 0 ? '+' : g.totalKzt < 0 ? '−' : ''}{formatMoney(Math.abs(g.totalKzt))}
                  </span>
                )}
              </div>
              <ul className="space-y-2" aria-label={formatDayHeading(g.date, today)}>
                {g.items.map((t) => (
                  <TransactionRow key={t.id} transaction={t} accounts={accounts} categories={categories} onDelete={remove} />
                ))}
              </ul>
            </div>
          ))}
          {shownCount < found.length && (
            <button
              type="button"
              onClick={() => setLimit((n) => n + PAGE_SIZE)}
              className="min-h-11 w-full rounded-xl border border-zinc-700 text-sm active:bg-zinc-900"
            >
              Показать ещё ({found.length - shownCount})
            </button>
          )}
        </>
      )}
    </section>
  )
}
