import { PeriodSwitcher } from '../components/ui/PeriodSwitcher'
import { canStepMonth, monthBounds, sameMonth } from '../domain/period'
import { useEarliestMonth } from '../lib/useEarliestMonth'
import { ScreenSkeleton } from '../components/ui/Skeleton'
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertCircle, Check, Copy, MoreHorizontal } from 'lucide-react'
import { db, type BudgetLimit, type Category } from '../db/schema'
import { DEFAULT_CATEGORY_IDS } from '../db/seed'
import { sortByDefaultOrder } from '../domain/categories'
import {
  calculateCategoryTotalsKzt, calculateUncategorizedKzt, monthBalance, monthLabel, nextMonth, planCopy, previousMonth,
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
  const earliest = useEarliestMonth(true)
  const bounds = monthBounds(current, earliest ?? null, 12)
  const [notice, setNotice] = useState<string>()
  const [menuOpen, setMenuOpen] = useState(false)

  const { rates } = useRates()
  const categories = useLiveQuery(() => db.categories.where('type').equals('expense').toArray(), [])
  const accounts = useLiveQuery(() => db.accounts.toArray(), [])
  const limits = useLiveQuery(() => db.budgetLimits.where('[year+month]').equals([year, month]).toArray(), [year, month])
  const txs = useLiveQuery(() => db.transactions.where('date').between(start, nextStart, true, false).toArray(), [start, nextStart])
  // Есть ли что копировать из прошлого месяца (для подсказки и меню)
  const prevMonthKey = previousMonth(year, month)
  const prevLimitsCount = useLiveQuery(
    () => db.budgetLimits.where('[year+month]').equals([prevMonthKey.year, prevMonthKey.month]).count(),
    [prevMonthKey.year, prevMonthKey.month],
  )

  if (!categories || !accounts || !limits || !txs) return <ScreenSkeleton blocks={['h-11', 'h-32', 'h-24', 'h-24', 'h-24', 'h-24', 'h-24', 'h-24', 'h-24']} />

  const plannedById = new Map(limits.map((l) => [l.categoryId, l.plannedAmount]))
  const totals = calculateCategoryTotalsKzt(txs, accounts, rates)
  // Порядок как в форме «+»; скрытые категории остаются в месяце, где у них есть лимит или траты
  const rows = sortByDefaultOrder(categories, DEFAULT_CATEGORY_IDS).filter((c) => !c.isArchived || (plannedById.get(c.id) ?? 0) > 0 || (totals[c.id] ?? 0) > 0)
  const uncategorized = calculateUncategorizedKzt(txs, accounts, rates)
  const totalPlanned = sumPlannedLimits(limits)
  const totalSpent = calculateExpensesKzt(txs, accounts, rates)
  const prev = prevMonthKey
  const balance = monthBalance(totalPlanned, totalSpent)
  const monthIsEmpty = limits.length === 0
  const canCopy = (prevLimitsCount ?? 0) > 0

  const go = (p: { year: number; month: number }) => { setPeriod(p); setNotice(undefined); setMenuOpen(false) }

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

  const copyAndClose = () => { setMenuOpen(false); void copyFromPrevious() }

  return (
    <section className="space-y-4 p-4">
      <PeriodSwitcher
        title={monthLabel(year, month)}
        titleTestId="period"
        unit="месяц"
        canPrev={canStepMonth({ year, month }, -1, bounds)}
        canNext={canStepMonth({ year, month }, 1, bounds)}
        onPrev={() => go(prev)}
        onNext={() => go(nextMonth(year, month))}
        isCurrent={sameMonth({ year, month }, current)}
        onToday={() => go(current)}
      />

      <div data-selectable className="rounded-2xl bg-zinc-900 p-4" data-testid="totals">
        <div className="-mt-2 mb-1 flex items-center justify-between gap-3">
          <h3 className="text-xs font-medium uppercase tracking-wide text-fg-muted">Итоги месяца</h3>
          {/* Копирование плана — в меню «Ещё»: когда лимиты уже заданы, оно нужно редко */}
          {!monthIsEmpty && canCopy && (
            <button
              type="button"
              aria-label="Ещё"
              aria-expanded={menuOpen}
              aria-controls="budget-more"
              onClick={() => setMenuOpen((v) => !v)}
              className="-mr-2 grid size-11 shrink-0 place-items-center rounded-xl text-fg-muted active:bg-zinc-800"
            >
              <MoreHorizontal className="size-5" aria-hidden />
            </button>
          )}
        </div>
        {menuOpen && (
          <div id="budget-more" className="mb-3">
            <button
              type="button"
              onClick={copyAndClose}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 px-3 text-sm active:bg-zinc-800"
            >
              <Copy className="size-4 shrink-0" aria-hidden />
              Добавить недостающие лимиты из месяца «{monthLabel(prev.year, prev.month)}»
            </button>
          </div>
        )}
        <div className="flex justify-between gap-3 text-sm">
          <span className="text-fg-muted">Запланировано</span>
          <span className="min-w-0 text-right tabular-nums [overflow-wrap:anywhere]" data-testid="total-planned">{formatMoney(totalPlanned)}</span>
        </div>
        <div className="mt-1 flex justify-between gap-3 text-sm">
          <span className="text-fg-muted">Фактические траты</span>
          <span className={cn('min-w-0 text-right tabular-nums [overflow-wrap:anywhere]', totalSpent > totalPlanned && totalPlanned > 0 && 'text-danger')} data-testid="total-spent">{formatMoney(totalSpent)}</span>
        </div>
        {balance && (
          <div className="mt-1 flex justify-between gap-3 border-t border-zinc-800 pt-1 text-sm font-medium">
            <span className={balance.over ? 'text-danger' : 'text-fg-muted'}>{balance.over ? 'Перерасход' : 'Осталось'}</span>
            <span className={cn('min-w-0 text-right tabular-nums [overflow-wrap:anywhere]', balance.over && 'text-danger')} data-testid="total-remaining">{formatMoney(balance.amount)}</span>
          </div>
        )}
      </div>

      {notice && <p role="status" className="text-center text-xs text-zinc-400">{notice}</p>}

      {monthIsEmpty && (
        <section aria-labelledby="empty-month-h" className="rounded-2xl border border-accent/40 bg-accent/10 p-4" data-testid="empty-month">
          <h3 id="empty-month-h" className="font-medium">Задайте лимиты на {monthLabel(year, month)}</h3>
          <p className="mt-1 text-sm text-fg-muted">
            {canCopy
              ? `Впишите суммы по категориям ниже или скопируйте план из месяца «${monthLabel(prev.year, prev.month)}».`
              : 'Впишите суммы по категориям ниже: из них считается «Лимит на сегодня».'}
          </p>
          {canCopy && (
            <button
              type="button"
              onClick={copyAndClose}
              className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent px-3 text-sm font-medium text-on-accent active:brightness-95"
            >
              <Copy className="size-4 shrink-0" aria-hidden />
              Скопировать из прошлого месяца
            </button>
          )}
        </section>
      )}

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
