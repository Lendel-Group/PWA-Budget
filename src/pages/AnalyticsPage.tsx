import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { db } from '../db/schema'
import { barFractions, calculateYearSummary, compactAmount, sumYear } from '../domain/analytics'
import { parseDate } from '../domain/dates'
import { cn } from '../lib/cn'
import { formatMoney } from '../lib/format'
import { useRates } from '../lib/useRates'
import { useToday } from '../lib/useToday'

const MONTHS_SHORT = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']

function ExpenseChart({ expenses, currentMonth }: { expenses: number[]; currentMonth?: number }) {
  const fractions = barFractions(expenses)
  const max = Math.max(...expenses)
  const W = 340, H = 150, top = 14, bottom = 22, left = 4, slot = (W - left) / 12, bw = slot * 0.6
  const plot = H - top - bottom
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Расходы по месяцам" className="w-full">
      <line x1={left} x2={W} y1={H - bottom} y2={H - bottom} className="stroke-zinc-700" />
      {max > 0 && <text x={left} y={9} className="fill-fg-muted" fontSize="9">{compactAmount(max)} ₸</text>}
      {fractions.map((f, i) => {
        const h = Math.max(f * plot, expenses[i] > 0 ? 2 : 0)
        const x = left + i * slot + (slot - bw) / 2
        return (
          <g key={i}>
            <rect x={x} y={H - bottom - h} width={bw} height={h} rx={2}
              className={i + 1 === currentMonth ? 'fill-emerald-400' : 'fill-emerald-600'} data-testid={`bar-${i + 1}`}>
              <title>{`${MONTHS_SHORT[i]}: ${formatMoney(expenses[i])}`}</title>
            </rect>
            <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="8" className="fill-fg-muted">{MONTHS_SHORT[i]}</text>
          </g>
        )
      })}
    </svg>
  )
}

export default function AnalyticsPage() {
  const today = useToday()
  const current = parseDate(today)
  const [year, setYear] = useState<number | null>(null)
  const y = year ?? current.year
  const { rates } = useRates()
  const accounts = useLiveQuery(() => db.accounts.toArray(), [])
  const txs = useLiveQuery(() => db.transactions.where('date').between(`${y}-01-01`, `${y}-12-31`, true, true).toArray(), [y])
  if (!accounts || !txs) return null

  const rows = calculateYearSummary(txs, accounts, rates, y)
  const total = sumYear(rows)
  const money = (n: number) => formatMoney(n).replace(' ₸', '')

  return (
    <section className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <button type="button" aria-label="Предыдущий год" onClick={() => setYear(y - 1)} className="grid size-11 place-items-center rounded-xl bg-zinc-900">
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <h2 className="text-lg font-semibold" data-testid="year">{y}</h2>
        <button type="button" aria-label="Следующий год" onClick={() => setYear(y + 1)} className="grid size-11 place-items-center rounded-xl bg-zinc-900">
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </div>

      <div className="rounded-2xl bg-zinc-900 p-4">
        <p className="mb-2 text-sm text-fg-muted">Расходы по месяцам</p>
        <ExpenseChart expenses={rows.map((r) => r.expense)} currentMonth={y === current.year ? current.month : undefined} />
      </div>

      <div className="overflow-hidden rounded-2xl bg-zinc-900">
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
              <tr key={r.month} className={cn(y === current.year && r.month === current.month && 'bg-emerald-500/10')}>
                <th scope="row" className="px-3 py-2 text-left font-normal text-zinc-300">{MONTHS_SHORT[r.month - 1]}</th>
                <td className="px-2 py-2 text-right text-emerald-400">{r.income ? money(r.income) : '—'}</td>
                <td className="px-2 py-2 text-right">{r.expense ? money(r.expense) : '—'}</td>
                <td className={cn('px-3 py-2 text-right', r.savings < 0 ? 'text-red-400' : r.savings > 0 ? 'text-zinc-100' : 'text-fg-muted')}>
                  {r.savings ? money(r.savings) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-zinc-700 font-medium">
            <tr data-testid="summary-total">
              <th scope="row" className="px-3 py-2.5 text-left">Итого</th>
              <td className="px-2 py-2.5 text-right text-emerald-400">{money(total.income)}</td>
              <td className="px-2 py-2.5 text-right">{money(total.expense)}</td>
              <td className={cn('px-3 py-2.5 text-right', total.savings < 0 && 'text-red-400')}>{money(total.savings)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-fg-muted">Суммы в тенге. Сбережения = доходы − расходы; пополнения целей остаются сбережениями.</p>
    </section>
  )
}
