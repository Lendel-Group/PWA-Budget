import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, Copy } from 'lucide-react'
import { db, type BudgetLimit, type Category } from '../db/schema'
import {
  calculateCategoryTotalsKzt, calculateUncategorizedKzt, limitId, monthLabel, nextMonth, parsePlanInput, planCopy, previousMonth,
} from '../domain/budget'
import { addDays, daysInMonth, parseDate } from '../domain/dates'
import { calculateExpensesKzt, sumPlannedLimits } from '../domain/finance'
import { cn } from '../lib/cn'
import { formatMoney } from '../lib/format'
import { CategoryIcon } from '../lib/icons'
import { useRates } from '../lib/useRates'
import { useToday } from '../lib/useToday'

const pad = (n: number) => String(n).padStart(2, '0')

async function savePlan(year: number, month: number, categoryId: string, amount: number) {
  const id = limitId(year, month, categoryId)
  if (amount > 0) await db.budgetLimits.put({ id, year, month, categoryId, plannedAmount: amount })
  else await db.budgetLimits.delete(id)
}

/** Поле лимита с инлайн-автосохранением (debounce 500 мс и при потере фокуса). */
function PlanInput({ stored, year, month, categoryId, name }: {
  stored: number; year: number; month: number; categoryId: string; name: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const parsed = draft === null ? null : parsePlanInput(draft)
  const invalid = draft !== null && parsed === null

  useEffect(() => {
    if (parsed === null || parsed === stored) return
    const id = setTimeout(() => void savePlan(year, month, categoryId, parsed), 500)
    return () => clearTimeout(id)
  }, [parsed, stored, year, month, categoryId])

  return (
    <input
      inputMode="decimal"
      aria-label={`Лимит: ${name}`}
      aria-invalid={invalid}
      placeholder="0"
      value={draft ?? (stored > 0 ? String(stored) : '')}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (parsed !== null && parsed !== stored) void savePlan(year, month, categoryId, parsed)
        setDraft(null)
      }}
      className={cn(
        'w-28 rounded-lg bg-zinc-800 px-2 py-1.5 text-right text-sm tabular-nums outline-none focus:ring-2 focus:ring-emerald-500',
        invalid && 'ring-2 ring-red-500',
      )}
    />
  )
}

function CategoryRow({ category, planned, actual, year, month }: {
  category: Category; planned: number; actual: number; year: number; month: number
}) {
  const over = planned > 0 ? actual > planned : actual > 0
  const pct = planned > 0 ? Math.min(100, (actual / planned) * 100) : actual > 0 ? 100 : 0
  return (
    <li className="rounded-2xl bg-zinc-900 p-3">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full" style={{ background: `${category.color}33`, color: category.color }}>
          <CategoryIcon name={category.icon} className="size-5" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm">{category.name}</span>
        <PlanInput stored={planned} year={year} month={month} categoryId={category.id} name={category.name} />
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800"
        role="progressbar"
        aria-label={`Расход: ${category.name}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <div className={cn('h-full rounded-full', over ? 'bg-red-500' : 'bg-emerald-500')} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-xs">
        <span className={cn('tabular-nums', over ? 'text-red-400' : 'text-zinc-400')} data-testid={`actual-${category.id}`}>
          Факт: {formatMoney(actual)}
        </span>
        <span className={cn('tabular-nums', over ? 'text-red-400' : 'text-fg-muted')}>
          {planned > 0
            ? actual > planned ? `Перерасход ${formatMoney(actual - planned)}` : `Осталось ${formatMoney(planned - actual)}`
            : actual > 0 ? 'Нет лимита' : ''}
        </span>
      </div>
    </li>
  )
}

export default function BudgetPage() {
  const today = useToday()
  const [period, setPeriod] = useState<{ year: number; month: number } | null>(null)
  const current = parseDate(today)
  const { year, month } = period ?? { year: current.year, month: current.month }
  const start = `${year}-${pad(month)}-01`
  const nextStart = addDays(start, daysInMonth(year, month))
  const [notice, setNotice] = useState<string>()

  const { rates } = useRates()
  const categories = useLiveQuery(() => db.categories.where('type').equals('expense').toArray(), [])
  const accounts = useLiveQuery(() => db.accounts.toArray(), [])
  const limits = useLiveQuery(() => db.budgetLimits.where('[year+month]').equals([year, month]).toArray(), [year, month])
  const txs = useLiveQuery(() => db.transactions.where('date').between(start, nextStart, true, false).toArray(), [start, nextStart])

  if (!categories || !accounts || !limits || !txs) return null

  const plannedById = new Map(limits.map((l) => [l.categoryId, l.plannedAmount]))
  const totals = calculateCategoryTotalsKzt(txs, accounts, rates)
  const uncategorized = calculateUncategorizedKzt(txs, accounts, rates)
  const totalPlanned = sumPlannedLimits(limits)
  const totalSpent = calculateExpensesKzt(txs, accounts, rates)
  const prev = previousMonth(year, month)

  const go = (p: { year: number; month: number }) => { setPeriod(p); setNotice(undefined) }

  async function copyFromPrevious() {
    const previousLimits = await db.budgetLimits.where('[year+month]').equals([prev.year, prev.month]).toArray()
    const toAdd: BudgetLimit[] = planCopy(previousLimits, limits ?? [], year, month)
    if (toAdd.length === 0) {
      setNotice(previousLimits.length === 0
        ? `Нет плана за ${monthLabel(prev.year, prev.month)} — копировать нечего`
        : 'Все лимиты уже заданы — копировать нечего')
      return
    }
    await db.budgetLimits.bulkPut(toAdd)
    setNotice(`Скопировано лимитов: ${toAdd.length}`)
  }

  return (
    <section className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <button type="button" aria-label="Предыдущий месяц" onClick={() => go(prev)} className="grid size-10 place-items-center rounded-xl bg-zinc-900">
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <h2 className="text-lg font-semibold" data-testid="period">{monthLabel(year, month)}</h2>
        <button type="button" aria-label="Следующий месяц" onClick={() => go(nextMonth(year, month))} className="grid size-10 place-items-center rounded-xl bg-zinc-900">
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </div>

      <div className="rounded-2xl bg-zinc-900 p-4" data-testid="totals">
        <div className="flex justify-between text-sm">
          <span className="text-fg-muted">Запланировано</span>
          <span className="tabular-nums" data-testid="total-planned">{formatMoney(totalPlanned)}</span>
        </div>
        <div className="mt-1 flex justify-between text-sm">
          <span className="text-fg-muted">Фактические траты</span>
          <span className={cn('tabular-nums', totalSpent > totalPlanned && totalPlanned > 0 && 'text-red-400')} data-testid="total-spent">{formatMoney(totalSpent)}</span>
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={copyFromPrevious}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 py-3 text-sm active:bg-zinc-900"
        >
          <Copy className="size-4" aria-hidden />
          Скопировать план из прошлого месяца
        </button>
        {notice && <p role="status" className="mt-2 text-center text-xs text-zinc-400">{notice}</p>}
      </div>

      <ul className="space-y-2" aria-label="Категории расходов">
        {categories.map((c) => (
          <CategoryRow key={c.id} category={c} planned={plannedById.get(c.id) ?? 0} actual={totals[c.id] ?? 0} year={year} month={month} />
        ))}
        {uncategorized > 0 && (
          <li className="flex items-center justify-between rounded-2xl bg-zinc-900 p-3 text-sm" data-testid="uncategorized">
            <span>Без категории</span>
            <span className="tabular-nums text-zinc-400">Факт: {formatMoney(uncategorized)}</span>
          </li>
        )}
      </ul>
    </section>
  )
}
