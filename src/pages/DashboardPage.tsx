import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, ChevronDown } from 'lucide-react'
import { TransactionRow } from '../components/transactions/TransactionRow'
import { db } from '../db/schema'
import { addDays, daysInMonth, daysLeftInMonth, monthStart, parseDate } from '../domain/dates'
import {
  accountsMissingRates, calculateDailyAllowance, calculateExpensesKzt, calculateNetWorth,
  getAllowanceStatus, sumPlannedLimits, type AllowanceStatus,
} from '../domain/finance'
import { cn } from '../lib/cn'
import { formatMoney } from '../lib/format'
import { useRates } from '../lib/useRates'
import { useToday } from '../lib/useToday'
import { useDeleteTransaction } from '../lib/useDeleteTransaction'

const STATUS_STYLES: Record<AllowanceStatus, { card: string; text: string; label: string }> = {
  green: { card: 'border-emerald-500/40 bg-emerald-500/10', text: 'text-emerald-400', label: 'Всё в порядке' },
  yellow: { card: 'border-amber-500/40 bg-amber-500/10', text: 'text-amber-400', label: 'Тратьте аккуратнее' },
  red: { card: 'border-red-500/40 bg-red-500/10', text: 'text-red-400', label: 'Лимит исчерпан' },
}

export default function DashboardPage() {
  const today = useToday()
  const yesterday = addDays(today, -1)
  const { year, month } = parseDate(today)
  const start = monthStart(today)
  const nextStart = addDays(start, daysInMonth(year, month))

  const { rates } = useRates()
  const accounts = useLiveQuery(() => db.accounts.filter((a) => !a.isArchived).toArray(), [])
  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const limits = useLiveQuery(() => db.budgetLimits.where('[year+month]').equals([year, month]).toArray(), [year, month])
  const monthTxs = useLiveQuery(
    () => db.transactions.where('date').between(start, nextStart, true, false).toArray(),
    [start, nextStart],
  )
  const recent = useLiveQuery(
    () => db.transactions.where('date').anyOf(today, yesterday).toArray(),
    [today, yesterday],
  )

  const [expanded, setExpanded] = useState(false)
  const { remove, error: deleteError } = useDeleteTransaction()

  if (!accounts || !categories || !limits || !monthTxs || !recent) return null

  const netWorth = calculateNetWorth(accounts, rates)
  const missing = accountsMissingRates(accounts, rates)
  const planned = sumPlannedLimits(limits)
  const spent = calculateExpensesKzt(monthTxs, accounts, rates)
  const remaining = planned - spent
  const allowance = calculateDailyAllowance(planned, spent, daysLeftInMonth(today))
  const status = STATUS_STYLES[getAllowanceStatus(allowance)]
  const usedPct = planned > 0 ? Math.min(100, (spent / planned) * 100) : 0

  const group = (date: string, title: string) => {
    const items = recent.filter((t) => t.date === date).sort((a, b) => b.timestamp - a.timestamp)
    return (
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">{title}</h3>
        {items.length === 0 ? (
          <p className="text-sm text-zinc-600">Операций нет</p>
        ) : (
          <ul className="space-y-2" aria-label={title}>
            {items.map((t) => (
              <TransactionRow key={t.id} transaction={t} accounts={accounts} categories={categories} onDelete={remove} />
            ))}
          </ul>
        )}
      </div>
    )
  }

  return (
    <section className="space-y-4 p-4">
      <div className="rounded-2xl bg-zinc-900 p-4">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          <span>
            <span className="block text-sm text-zinc-500">Общий капитал</span>
            <span className="text-3xl font-semibold tabular-nums" data-testid="net-worth">{formatMoney(netWorth)}</span>
          </span>
          <ChevronDown className={cn('size-5 text-zinc-500 transition-transform', expanded && 'rotate-180')} aria-hidden />
        </button>
        {expanded && (
          <ul className="mt-3 divide-y divide-zinc-800 text-sm" aria-label="Балансы счетов">
            {accounts.map((a) => (
              <li key={a.id} className="flex justify-between py-2">
                <span>{a.name}</span>
                <span className="tabular-nums text-zinc-300">{formatMoney(a.currentBalance, a.currency)}</span>
              </li>
            ))}
          </ul>
        )}
        {missing.length > 0 && (
          <p className="mt-3 flex items-start gap-2 text-xs text-amber-400">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            Нет курса для {[...new Set(missing.map((a) => a.currency))].join(', ')} — эти счета не вошли в капитал.
            Задайте курсы в настройках.
          </p>
        )}
      </div>

      <div className={cn('rounded-2xl border p-4', planned > 0 ? status.card : 'border-zinc-800 bg-zinc-900')} data-testid="allowance-card" data-status={planned > 0 ? getAllowanceStatus(allowance) : 'none'}>
        <p className="text-sm text-zinc-400">Лимит на сегодня</p>
        {planned > 0 ? (
          <>
            <p className={cn('text-4xl font-semibold tabular-nums', status.text)} data-testid="allowance">{formatMoney(allowance)}</p>
            <p className="mt-1 text-xs text-zinc-400">{status.label} · дней до конца месяца: {daysLeftInMonth(today)}</p>
          </>
        ) : (
          <p className="mt-1 text-sm text-zinc-400">
            Задайте плановые лимиты на вкладке <a className="text-emerald-400 underline" href="#/budget">«Бюджет»</a>, чтобы увидеть дневной лимит.
          </p>
        )}
      </div>

      <div className="rounded-2xl bg-zinc-900 p-4">
        <p className="mb-3 text-sm text-zinc-500">Месячный бюджет</p>
        <div
          className="h-3 overflow-hidden rounded-full bg-zinc-800"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(usedPct)}
          aria-label="Израсходовано от плана"
        >
          <div className={cn('h-full rounded-full', spent > planned ? 'bg-red-500' : 'bg-emerald-500')} style={{ width: `${planned > 0 ? usedPct : spent > 0 ? 100 : 0}%` }} />
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div><dt className="text-zinc-500">Израсходовано</dt><dd className="text-sm tabular-nums" data-testid="spent">{formatMoney(spent)}</dd></div>
          <div><dt className="text-zinc-500">Запланировано</dt><dd className="text-sm tabular-nums">{formatMoney(planned)}</dd></div>
          <div>
            <dt className="text-zinc-500">{remaining < 0 ? 'Перерасход' : 'Остаток'}</dt>
            <dd className={cn('text-sm tabular-nums', remaining < 0 && 'text-red-400')}>{formatMoney(Math.abs(remaining))}</dd>
          </div>
        </dl>
      </div>

      <div className="space-y-4">
        {deleteError && <p role="alert" className="text-sm text-red-400">{deleteError}</p>}
        {group(today, 'Сегодня')}
        {group(yesterday, 'Вчера')}
        <a href="#/transactions" className="flex min-h-11 items-center justify-center rounded-xl border border-zinc-700 text-sm text-zinc-200 active:bg-zinc-900">
          Все операции →
        </a>
      </div>
    </section>
  )
}
