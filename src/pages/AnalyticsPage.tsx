import { PeriodSwitcher } from '../components/ui/PeriodSwitcher'
import { yearBounds } from '../domain/period'
import { useEarliestMonth } from '../lib/useEarliestMonth'
import { ScreenSkeleton } from '../components/ui/Skeleton'
import { useRef, useState, type PointerEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { CategoryBreakdown } from '../components/analytics/CategoryBreakdown'
import { NoSpendTab } from '../components/challenge/NoSpendTab'
import { SegmentedControl, TabPanel } from '../components/ui/SegmentedControl'
import { db } from '../db/schema'
import { barFractions, calculateYearSummary, compactAmount, sumYear } from '../domain/analytics'
import { monthLabel } from '../domain/budget'
import { parseDate } from '../domain/dates'
import { slotAt, stepIndex } from '../domain/roving'
import type { AnalyticsRoute } from '../domain/routes'
import { cn } from '../lib/cn'
import type { Route } from '../lib/useHashRoute'
import { formatMoney, formatNumber } from '../lib/format'
import { useRates } from '../lib/useRates'
import { useToday } from '../lib/useToday'

const MONTHS_SHORT = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']

const BAR_AREA_PX = 104

/**
 * Столбцы — кнопки-слоты на всю высоту графика (радиогруппа «месяц»): выбираются тапом, скольжением пальца
 * по графику (скраб), стрелками/Home/End; сумма выбранного месяца — в строке над графиком (`role="status"`
 * озвучивает её) и в `aria-label` каждого столбца. Слотов 12, поэтому на телефоне каждый ~25 px шириной
 * (но всей высоты графика); скраб снимает требование точного попадания.
 * Подписи месяцев — обычный HTML 11 px, они растут вместе с системным шрифтом; если ячейки уже ~25 px,
 * подписи показываются через одну.
 */
function ExpenseChart({ year, expenses, selected, defaultStop, onSelect }: {
  year: number
  expenses: number[]
  /** Выбранный месяц 1–12 или `undefined`. */
  selected?: number
  /** Месяц (1–12), на котором стоит Tab, пока ничего не выбрано. */
  defaultStop: number
  onSelect: (month: number) => void
}) {
  const group = useRef<HTMLDivElement>(null)
  const fractions = barFractions(expenses)
  const stop = (selected ?? defaultStop) - 1

  const choose = (i: number, focus = false) => {
    onSelect(i + 1)
    if (focus) group.current?.querySelectorAll<HTMLElement>('button')[i]?.focus()
  }
  const slotFromPointer = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return slotAt(e.clientX, r.left, r.width, 12)
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-1">
        <button
          type="button"
          aria-label="Предыдущий месяц"
          disabled={selected === undefined || selected <= 1}
          onClick={() => choose((selected ?? 1) - 2)}
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-zinc-800 disabled:opacity-40"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <p role="status" className="min-w-0 text-center text-sm">
          {selected !== undefined ? (
            <>
              <span className="text-fg-muted">{monthLabel(year, selected)} · </span>
              <span className="font-medium tabular-nums" data-testid="chart-value">{formatMoney(expenses[selected - 1])}</span>
            </>
          ) : (
            <span className="text-xs text-fg-muted">Коснитесь столбца, чтобы увидеть сумму</span>
          )}
        </p>
        <button
          type="button"
          aria-label="Следующий месяц"
          disabled={selected !== undefined && selected >= 12}
          onClick={() => choose(selected ?? 0)}
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-zinc-800 disabled:opacity-40"
        >
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </div>
      <div
        ref={group}
        role="radiogroup"
        aria-label="Расходы по месяцам"
        className="@container mt-1 grid touch-pan-y grid-cols-12"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); choose(slotFromPointer(e)) }}
        onPointerMove={(e) => { if (e.buttons !== 0) choose(slotFromPointer(e)) }}
        onKeyDown={(e) => {
          const next = stepIndex(stop, e.key, 12)
          if (next === undefined) return
          e.preventDefault()
          choose(next, true)
        }}
      >
        {fractions.map((f, i) => {
          const isSelected = selected === i + 1
          const h = Math.max(f * BAR_AREA_PX, expenses[i] > 0 ? 2 : 0)
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`${monthLabel(year, i + 1)}: ${formatMoney(expenses[i])}`}
              tabIndex={i === stop ? 0 : -1}
              onClick={() => choose(i)}
              data-testid={`bar-${i + 1}`}
              className={cn(
                'flex flex-col items-center justify-end rounded-lg px-0.5 pb-1 pt-2 outline-none focus-visible:ring-2 focus-visible:ring-accent',
                isSelected && 'bg-zinc-800',
              )}
            >
              <span className="flex w-full items-end justify-center border-b border-zinc-700" style={{ height: BAR_AREA_PX }}>
                <span aria-hidden className={cn('w-3/5 rounded-t-sm', isSelected ? 'bg-expense-strong' : 'bg-expense')} style={{ height: h }} />
              </span>
              <span
                aria-hidden
                className={cn('mt-1 text-[11px] leading-4 tracking-tight', isSelected ? 'text-zinc-100' : 'text-fg-muted', i % 2 && '@max-[300px]:invisible')}
              >
                {MONTHS_SHORT[i]}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Годовой обзор: расходы по месяцам и таблица доходов, расходов и сбережений. */
function YearOverview() {
  const today = useToday()
  const current = parseDate(today)
  const [year, setYear] = useState<number | null>(null)
  const y = year ?? current.year
  // Выбранный месяц привязан к году: при смене года выбор сбрасывается к текущему месяцу (в текущем году) или пустому
  const [picked, setPicked] = useState<{ year: number; month: number } | null>(null)
  const selected = picked?.year === y ? picked.month : y === current.year ? current.month : undefined
  const earliest = useEarliestMonth(false)
  const bounds = yearBounds(current.year, earliest ?? null)
  const { rates } = useRates()
  const accounts = useLiveQuery(() => db.accounts.toArray(), [])
  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const txs = useLiveQuery(() => db.transactions.where('date').between(`${y}-01-01`, `${y}-12-31`, true, true).toArray(), [y])
  if (!accounts || !categories || !txs) return <ScreenSkeleton className="p-0" blocks={['h-11', 'h-72', 'h-64', 'h-48']} />

  const rows = calculateYearSummary(txs, accounts, rates, y)
  const total = sumYear(rows)
  const max = Math.max(...rows.map((r) => r.expense))
  const money = formatNumber

  return (
    <div className="space-y-4">
      <PeriodSwitcher
        title={String(y)}
        titleTestId="year"
        unit="год"
        canPrev={y > bounds.min}
        canNext={y < bounds.max}
        onPrev={() => setYear(y - 1)}
        onNext={() => setYear(y + 1)}
        isCurrent={y === current.year}
        onToday={() => setYear(null)}
      />

      <div className="rounded-2xl bg-zinc-900 p-3">
        <p className="mb-1 flex items-baseline justify-between gap-2 px-1 text-sm text-fg-muted">
          Расходы по месяцам
          {max > 0 && <span className="shrink-0 text-[11px]">макс. {compactAmount(max)} ₸</span>}
        </p>
        <ExpenseChart
          year={y}
          expenses={rows.map((r) => r.expense)}
          selected={selected}
          defaultStop={y === current.year ? current.month : 1}
          onSelect={(month) => setPicked({ year: y, month })}
        />
      </div>

      <CategoryBreakdown year={y} month={selected} transactions={txs} accounts={accounts} categories={categories} rates={rates} />

      <div className="overflow-x-auto rounded-2xl bg-zinc-900">
        <table className="w-full text-xs tabular-nums" data-testid="summary">
          <caption className="sr-only">Доходы, расходы и сбережения по месяцам, ₸</caption>
          <thead className="text-fg-muted">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-normal">Месяц</th>
              <th scope="col" className="px-2 py-2 text-right font-normal">Доходы</th>
              <th scope="col" className="px-2 py-2 text-right font-normal">Расходы</th>
              <th scope="col" className="px-3 py-2 text-right font-normal">Сбережения</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {rows.map((r) => (
              <tr key={r.month} data-selected={r.month === selected || undefined} className={cn(r.month === selected && 'bg-accent/10')}>
                <th scope="row" className="px-3 py-2 text-left font-normal text-zinc-300">{MONTHS_SHORT[r.month - 1]}</th>
                <td className={cn('px-2 py-2 text-right', r.income ? 'text-income' : 'text-fg-muted')}>{r.income ? money(r.income) : '—'}</td>
                <td className="px-2 py-2 text-right">{r.expense ? money(r.expense) : '—'}</td>
                <td className={cn('px-3 py-2 text-right', r.savings < 0 ? 'text-danger' : r.savings > 0 ? 'text-zinc-100' : 'text-fg-muted')}>
                  {r.savings ? money(r.savings) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-zinc-700 font-medium">
            <tr data-testid="summary-total">
              <th scope="row" className="px-3 py-2.5 text-left">Итого</th>
              <td className="px-2 py-2.5 text-right text-income">{money(total.income)}</td>
              <td className="px-2 py-2.5 text-right">{money(total.expense)}</td>
              <td className={cn('px-3 py-2.5 text-right', total.savings < 0 && 'text-danger')}>{money(total.savings)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-fg-muted">Суммы в тенге. Сбережения = доходы − расходы; пополнения целей остаются сбережениями.</p>
    </div>
  )
}

const TABS: readonly { value: AnalyticsRoute; label: string }[] = [
  { value: 'analytics', label: 'Обзор' },
  { value: 'nospend', label: 'Дни без трат' },
]

/** «Аналитика»: обзор по годам и календарь дней без трат. Подраздел — маршрут (`#/analytics`, `#/nospend`). */
export default function AnalyticsPage({ route, onNavigate }: { route: AnalyticsRoute; onNavigate: (r: Route) => void }) {
  return (
    <section className="space-y-4 p-4">
      <SegmentedControl
        variant="tabs"
        id="analytics-tabs"
        label="Раздел аналитики"
        options={TABS}
        value={route}
        onChange={onNavigate}
        className="p-1"
        itemClassName="text-sm"
      />
      <TabPanel id="analytics-tabs" value={route}>
        {route === 'analytics' ? <YearOverview /> : <NoSpendTab />}
      </TabPanel>
    </section>
  )
}
