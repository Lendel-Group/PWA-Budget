import { useState } from 'react'
import type { Account, Category, Currency, Transaction } from '../../db/schema'
import { calculateCategoryBreakdown, type CategoryBreakdown as Breakdown } from '../../domain/analytics'
import { monthLabel } from '../../domain/budget'
import type { Rates } from '../../domain/finance'
import { formatMoney, formatShare } from '../../lib/format'
import { CategoryIcon } from '../../lib/icons'
import { SegmentedControl } from '../ui/SegmentedControl'

type Scope = 'month' | 'year'
const SCOPES: readonly { value: Scope; label: string }[] = [
  { value: 'month', label: 'Месяц' },
  { value: 'year', label: 'Год' },
]
const UNCATEGORIZED_COLOR = '#71717a'

/** Строки «куда уходят деньги»: категория, доля, сумма и полоса ширины доли; значения всегда текстом, полоса — только иллюстрация. */
function Rows({ breakdown, categories }: { breakdown: Breakdown; categories: Category[] }) {
  const byId = new Map(categories.map((c) => [c.id, c]))
  return (
    <ul aria-label="Расходы по категориям" className="space-y-3">
      {breakdown.rows.map((row) => {
        const category = row.categoryId === null ? undefined : byId.get(row.categoryId)
        const name = row.categoryId === null ? 'Без категории' : (category?.name ?? 'Другое')
        const color = category?.color ?? UNCATEGORIZED_COLOR
        return (
          <li key={row.categoryId ?? 'none'} data-testid={`cat-row-${row.categoryId ?? 'none'}`} data-selectable>
            {/* flex-wrap: при крупном шрифте сумма и доля уходят на вторую строку, а не за край экрана */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-full" style={{ background: `${color}33`, color }}>
                <CategoryIcon name={category?.icon ?? 'Circle'} className="size-4" />
              </span>
              <span className="min-w-0 flex-1 basis-24 truncate text-sm">{name}</span>
              <span className="ml-auto flex shrink-0 items-baseline gap-3">
                <span className="text-sm tabular-nums [overflow-wrap:anywhere]">{formatMoney(row.amount)}</span>
                <span className="w-10 text-right text-xs tabular-nums text-fg-muted">{formatShare(row.share)}</span>
              </span>
            </div>
            <div aria-hidden className="ml-11 mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-800">
              <div className="h-full rounded-full" style={{ width: `${Math.max(row.share * 100, 1)}%`, background: color }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

interface Props {
  year: number
  /** Выбранный на графике месяц 1–12; без него доступен только год. */
  month?: number
  transactions: Transaction[]
  accounts: Account[]
  categories: Category[]
  rates: Rates
}

/** «По категориям»: расходы за выбранный месяц или за год, по убыванию, в KZT по текущим курсам. */
export function CategoryBreakdown({ year, month, transactions, accounts, categories, rates }: Props) {
  const [scope, setScope] = useState<Scope>('month')
  // Месяц доступен, пока на графике выбран месяц; иначе показываем год
  const effective: Scope = scope === 'month' && month !== undefined ? 'month' : 'year'
  const breakdown = calculateCategoryBreakdown(transactions, accounts, rates, year, effective === 'month' ? month : undefined)
  const period = effective === 'month' && month !== undefined ? monthLabel(year, month) : `${year} год`
  const skipped: Currency[] = breakdown.skippedCurrencies

  return (
    <section aria-labelledby="by-category-h" className="space-y-3 rounded-2xl bg-zinc-900 p-4" data-testid="by-category">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h3 id="by-category-h" className="font-medium">По категориям</h3>
          <p className="text-xs text-fg-muted" data-testid="by-category-period">{period}</p>
        </div>
        {month !== undefined && (
          <SegmentedControl label="Период категорий" options={SCOPES} value={effective} onChange={setScope} className="w-36 max-w-full shrink-0 p-0.5" itemClassName="text-xs" />
        )}
      </div>

      {breakdown.rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-fg-muted" data-testid="by-category-empty">Расходов за этот период нет</p>
      ) : (
        <>
          <p className="flex items-baseline justify-between text-sm" data-selectable>
            <span className="text-fg-muted">Всего</span>
            <span className="font-medium tabular-nums" data-testid="by-category-total">{formatMoney(breakdown.total)}</span>
          </p>
          <Rows breakdown={breakdown} categories={categories} />
        </>
      )}

      {skipped.length > 0 && (
        <p className="flex items-start gap-2 text-xs text-warning" role="note">
          Не учтены расходы в {skipped.join(', ')}: нет курса. <a className="underline" href="#/settings">Задайте курсы в настройках.</a>
        </p>
      )}
    </section>
  )
}
