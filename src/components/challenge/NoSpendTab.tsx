import { useState } from 'react'
import { ChevronLeft, ChevronRight, Flame } from 'lucide-react'
import { monthLabel, nextMonth, previousMonth } from '../../domain/budget'
import { parseDate } from '../../domain/dates'
import { buildCalendar, type DayState } from '../../domain/planning'
import { cn } from '../../lib/cn'
import { useNoSpendStats } from '../../lib/useNoSpendStats'
import { useToday } from '../../lib/useToday'

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
  if (!stats) return null

  const { dates, firstTracked, currentStreak, cleanDaysThisMonth } = stats
  const weeks = buildCalendar(year, month, today, dates, firstTracked)
  const isCurrent = year === current.year && month === current.month
  const monthClean = weeks.flat().filter((c) => c?.state === 'clean').length

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

      <div className="rounded-2xl bg-zinc-900 p-4">
        <div className="mb-3 flex items-center justify-between">
          <button type="button" aria-label="Предыдущий месяц" className="grid size-11 place-items-center rounded-lg bg-zinc-800"
            onClick={() => setPeriod(previousMonth(year, month))}><ChevronLeft className="size-4" aria-hidden /></button>
          <h2 className="font-medium" data-testid="calendar-title">{monthLabel(year, month)}</h2>
          <button type="button" aria-label="Следующий месяц" className="grid size-11 place-items-center rounded-lg bg-zinc-800"
            onClick={() => setPeriod(nextMonth(year, month))}><ChevronRight className="size-4" aria-hidden /></button>
        </div>
        <div role="grid" aria-label="Календарь дней без трат" className="grid grid-cols-7 gap-1.5 text-center text-sm">
          {WEEKDAYS.map((d) => <div key={d} role="columnheader" className="pb-1 text-xs text-fg-muted">{d}</div>)}
          {weeks.flat().map((c, i) =>
            c === null ? <div key={`b${i}`} role="gridcell" /> : (
              <div
                key={c.date}
                role="gridcell"
                data-state={c.state}
                data-date={c.date}
                aria-label={`${c.date}: ${STATE_LABEL[c.state]}`}
                className={cn('grid aspect-square place-items-center rounded-lg tabular-nums', STATE_CLASS[c.state], c.isToday && 'ring-2 ring-accent')}
              >
                {c.day}
              </div>
            ),
          )}
        </div>
        <p className="mt-3 text-xs text-fg-muted">
          Зелёные дни — без расходов. Коммуналка, аренда и кредиты (с отметкой «Исключить») не считаются тратами.
        </p>
      </div>
    </div>
  )
}
