import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertCircle, Check, ChevronLeft, ChevronRight, Copy } from 'lucide-react'
import { db, type BudgetLimit, type Category } from '../db/schema'
import { DEFAULT_CATEGORY_IDS } from '../db/seed'
import { sortByDefaultOrder } from '../domain/categories'
import {
  calculateCategoryTotalsKzt, calculateUncategorizedKzt, monthLabel, nextMonth, planCopy, previousMonth,
} from '../domain/budget'
import { addDays, daysInMonth, parseDate } from '../domain/dates'
import { calculateExpensesKzt, sumPlannedLimits } from '../domain/finance'
import { cn } from '../lib/cn'
import { formatMoney } from '../lib/format'
import { CategoryIcon } from '../lib/icons'
import { usePlanLimit, type LimitStatus } from '../lib/usePlanLimit'
import { useRates } from '../lib/useRates'
import { useToday } from '../lib/useToday'

const pad = (n: number) => String(n).padStart(2, '0')

/** Текст проблемы с лимитом для нижней строки карточки (там же он озвучивается); `undefined` — всё в порядке. */
const LIMIT_PROBLEMS: Partial<Record<LimitStatus, string>> = {
  invalid: 'Введите сумму числом',
  'save-error': 'Не удалось сохранить лимит',
}

/** Поле лимита: отметка состояния — внутри поля слева, поэтому ни появление, ни исчезновение вёрстку не сдвигают. */
function PlanInput({ limit, name, describedBy }: { limit: ReturnType<typeof usePlanLimit>; name: string; describedBy?: string }) {
  const { status } = limit
  const bad = status === 'invalid' || status === 'save-error'
  return (
    <span className="relative w-28 min-w-0 shrink">
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-2 grid place-items-center">
        {status === 'saved' && <Check className="size-4 text-success" data-testid="limit-saved" />}
        {bad && <AlertCircle className="size-4 text-danger" data-testid="limit-problem" />}
      </span>
      <input
        inputMode="decimal"
        aria-label={`Лимит: ${name}`}
        aria-invalid={bad}
        aria-describedby={bad ? describedBy : undefined}
        placeholder="0"
        value={limit.value}
        onChange={(e) => limit.onChange(e.target.value)}
        onBlur={limit.onBlur}
        className={cn(
          'min-h-11 w-full min-w-0 rounded-lg bg-zinc-800 py-1.5 pl-7 pr-2 text-right text-sm tabular-nums outline-none focus:ring-2 focus:ring-accent',
          bad && 'ring-2 ring-danger focus:ring-danger',
        )}
      />
    </span>
  )
}

function CategoryRow({ category, planned, actual, year, month }: {
  category: Category; planned: number; actual: number; year: number; month: number
}) {
  const limit = usePlanLimit(planned, year, month, category.id)
  const problem = LIMIT_PROBLEMS[limit.status]
  const problemId = `limit-problem-${category.id}`
  const over = planned > 0 ? actual > planned : actual > 0
  const pct = planned > 0 ? Math.min(100, (actual / planned) * 100) : actual > 0 ? 100 : 0
  return (
    <li data-selectable className="rounded-2xl bg-zinc-900 p-3">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full" style={{ background: `${category.color}33`, color: category.color }}>
          <CategoryIcon name={category.icon} className="size-5" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm">{category.name}</span>
        <PlanInput limit={limit} name={category.name} describedBy={problemId} />
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800"
        role="progressbar"
        aria-label={`Расход: ${category.name}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <div className={cn('h-full rounded-full', over ? 'bg-danger' : 'bg-expense')} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-xs">
        <span className={cn('tabular-nums', over ? 'text-danger' : 'text-zinc-400')} data-testid={`actual-${category.id}`}>
          Факт: {formatMoney(actual)}
        </span>
        <span className={cn('tabular-nums', over || problem ? 'text-danger' : 'text-fg-muted')}>
          {/* Состояние лимита озвучивается: ошибки — `alert`, «Сохранено» — вежливый `status`; обе области всегда в разметке */}
          <span id={problemId} role="alert">{problem}</span>
          <span role="status" className="sr-only">{limit.status === 'saved' ? 'Лимит сохранён' : ''}</span>
          {!problem && (planned > 0
            ? actual > planned ? `Перерасход ${formatMoney(actual - planned)}` : `Осталось ${formatMoney(planned - actual)}`
            : actual > 0 ? 'Нет лимита' : '')}
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
  // Порядок как в форме «+»; скрытые категории остаются в месяце, где у них есть лимит или траты
  const rows = sortByDefaultOrder(categories, DEFAULT_CATEGORY_IDS).filter((c) => !c.isArchived || (plannedById.get(c.id) ?? 0) > 0 || (totals[c.id] ?? 0) > 0)
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
        <button type="button" aria-label="Предыдущий месяц" onClick={() => go(prev)} className="grid size-11 place-items-center rounded-xl bg-zinc-900">
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <h2 className="text-lg font-semibold" data-testid="period">{monthLabel(year, month)}</h2>
        <button type="button" aria-label="Следующий месяц" onClick={() => go(nextMonth(year, month))} className="grid size-11 place-items-center rounded-xl bg-zinc-900">
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </div>

      <div data-selectable className="rounded-2xl bg-zinc-900 p-4" data-testid="totals">
        <div className="flex justify-between gap-3 text-sm">
          <span className="text-fg-muted">Запланировано</span>
          <span className="min-w-0 text-right tabular-nums [overflow-wrap:anywhere]" data-testid="total-planned">{formatMoney(totalPlanned)}</span>
        </div>
        <div className="mt-1 flex justify-between gap-3 text-sm">
          <span className="text-fg-muted">Фактические траты</span>
          <span className={cn('min-w-0 text-right tabular-nums [overflow-wrap:anywhere]', totalSpent > totalPlanned && totalPlanned > 0 && 'text-danger')} data-testid="total-spent">{formatMoney(totalSpent)}</span>
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
        {rows.map((c) => (
          <CategoryRow key={c.id} category={c} planned={plannedById.get(c.id) ?? 0} actual={totals[c.id] ?? 0} year={year} month={month} />
        ))}
        {uncategorized > 0 && (
          <li data-selectable className="flex items-center justify-between rounded-2xl bg-zinc-900 p-3 text-sm" data-testid="uncategorized">
            <span>Без категории</span>
            <span className="tabular-nums text-zinc-400">Факт: {formatMoney(uncategorized)}</span>
          </li>
        )}
      </ul>
    </section>
  )
}
