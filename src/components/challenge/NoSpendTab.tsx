import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Flame } from 'lucide-react'
import { monthLabel, nextMonth, previousMonth } from '../../domain/budget'
import { addDays, daysInMonth, formatDayHeading, monthStart, parseDate } from '../../domain/dates'
import { buildCalendar, isCalendarDayInteractive, nextCalendarDate, type DayState } from '../../domain/planning'
import { cn } from '../../lib/cn'
import { useNoSpendStats } from '../../lib/useNoSpendStats'
import { useToday } from '../../lib/useToday'
import { DayOperationsSheet } from './DayOperationsSheet'

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const STATE_CLASS: Record<DayState, string> = {
  clean: 'bg-accent/20 text-accent-fg',
  spent: 'bg-zinc-800 text-zinc-300',
  future: 'text-fg-muted',
  untracked: 'text-fg-muted',
}
const STATE_LABEL: Record<DayState, string> = {
  clean: 'день без трат', spent: 'были траты', future: 'впереди', untracked: 'до начала учёта',
}

export function NoSpendTab() {
  const today = useToday()
  const [period, setPeriod] = useState<{ year: number; month: number } | null>(null)
  const current = parseDate(today)
  const { year, month } = period ?? current

  const stats = useNoSpendStats()
  const grid = useRef<HTMLDivElement>(null)
  const [openDate, setOpenDate] = useState<string | null>(null)
  const [focusDate, setFocusDate] = useState<string | null>(null)
  if (!stats) return null

  const { dates, firstTracked, currentStreak, cleanDaysThisMonth } = stats
  const weeks = buildCalendar(year, month, today, dates, firstTracked)
  const isCurrent = year === current.year && month === current.month
  const monthClean = weeks.flat().filter((c) => c?.state === 'clean').length
  // Клавиатура: открыть можно только дни с данными; в Tab-порядке один день (roving tabindex)
  const interactive = new Set(weeks.flat().filter((c) => c !== null && isCalendarDayInteractive(c.state)).map((c) => c!.date))
  const first = monthStart(`${year}-${String(month).padStart(2, '0')}-01`)
  const last = addDays(first, daysInMonth(year, month) - 1)
  const lastInteractive = [...interactive].sort().at(-1)
  const tabStop = focusDate !== null && interactive.has(focusDate) ? focusDate : interactive.has(today) ? today : lastInteractive

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-zinc-900 p-4">
          <p className="flex items-center gap-1 text-xs text-fg-muted"><Flame className="size-4 text-orange-400" aria-hidden /> Серия</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums" data-testid="streak">{currentStreak}</p>
          <p className="text-xs text-fg-muted">дней подряд без трат</p>
        </div>
        <div className="rounded-2xl bg-zinc-900 p-4">
          <p className="text-xs text-fg-muted">Чистых дней в месяце</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-accent-fg" data-testid="clean-days">{isCurrent ? cleanDaysThisMonth : monthClean}</p>
          <p className="text-xs text-fg-muted">{monthLabel(year, month)}</p>
        </div>
      </div>

      <div className="rounded-2xl bg-zinc-900 p-3">
        <div className="mb-3 flex items-center justify-between">
          <button type="button" aria-label="Предыдущий месяц" className="grid size-11 place-items-center rounded-lg bg-zinc-800"
            onClick={() => setPeriod(previousMonth(year, month))}><ChevronLeft className="size-4" aria-hidden /></button>
          <h2 className="font-medium" data-testid="calendar-title">{monthLabel(year, month)}</h2>
          <button type="button" aria-label="Следующий месяц" className="grid size-11 place-items-center rounded-lg bg-zinc-800"
            onClick={() => setPeriod(nextMonth(year, month))}><ChevronRight className="size-4" aria-hidden /></button>
        </div>
        <div
          ref={grid}
          role="grid"
          aria-label="Календарь дней без трат"
          className="space-y-1 text-center text-sm"
          onKeyDown={(e) => {
            // «Откуда» — день, на котором реально стоит фокус
            const from = (e.target as HTMLElement).dataset.date
            const next = from && nextCalendarDate(from, e.key, (d) => interactive.has(d), first, last)
            if (!next) return
            e.preventDefault()
            setFocusDate(next)
            grid.current?.querySelector<HTMLElement>(`[data-date="${next}"]`)?.focus()
          }}
        >
          <div role="row" className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((d) => <div key={d} role="columnheader" className="pb-1 text-xs text-fg-muted">{d}</div>)}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} role="row" className="grid grid-cols-7 gap-1">
              {week.map((c, i) => {
                if (c === null) return <div key={`b${i}`} role="gridcell" aria-hidden />
                const base = cn('grid aspect-square place-items-center rounded-lg tabular-nums', STATE_CLASS[c.state], c.isToday && 'ring-2 ring-accent')
                const label = `${formatDayHeading(c.date, today)}: ${STATE_LABEL[c.state]}`
                return (
                  <div key={c.date} role="gridcell" aria-selected={openDate === c.date || undefined}>
                    {isCalendarDayInteractive(c.state) ? (
                      <button
                        type="button"
                        data-state={c.state}
                        data-date={c.date}
                        aria-label={label}
                        tabIndex={c.date === tabStop ? 0 : -1}
                        onFocus={() => setFocusDate(c.date)}
                        onClick={() => setOpenDate(c.date)}
                        className={cn(base, 'w-full outline-none focus-visible:ring-2 focus-visible:ring-accent active:brightness-125')}
                      >
                        {c.day}
                      </button>
                    ) : (
                      // Будущие дни и дни до начала учёта: без фокуса и нажатия, состояние сказано в подписи
                      <div data-state={c.state} data-date={c.date} aria-label={label} aria-disabled="true" role="img" className={cn(base, 'opacity-60')}>
                        {c.day}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-fg-muted">
          Зелёные дни — без расходов. Коммуналка, аренда и кредиты (с отметкой «Исключить») не считаются тратами.
          Нажмите на день, чтобы увидеть его операции; блеклые дни ещё впереди или были до начала учёта.
        </p>
      </div>
      {openDate && <DayOperationsSheet date={openDate} today={today} onClose={() => setOpenDate(null)} />}
    </div>
  )
}
