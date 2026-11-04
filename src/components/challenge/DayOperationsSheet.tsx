import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Transaction } from '../../db/schema'
import { formatDayHeading } from '../../domain/dates'
import { breaksNoSpendDay } from '../../domain/finance'
import { cn } from '../../lib/cn'
import { formatMoney } from '../../lib/format'
import { CategoryIcon } from '../../lib/icons'
import { Sheet } from '../ui/Sheet'

/** Как операция влияет на день без трат — подпись текстом, не только цветом. */
function effectLabel(t: Transaction): { text: string; breaks: boolean } | undefined {
  if (t.type !== 'expense') return undefined
  return breaksNoSpendDay(t) ? { text: 'нарушает день', breaks: true } : { text: 'не считается тратой', breaks: false }
}

/** Операции выбранного дня календаря: что сделало день «нечистым» (read-only). */
export function DayOperationsSheet({ date, today, onClose }: { date: string; today: string; onClose: () => void }) {
  const txs = useLiveQuery(() => db.transactions.where('date').equals(date).toArray(), [date])
  const accounts = useLiveQuery(() => db.accounts.toArray(), [])
  const categories = useLiveQuery(() => db.categories.toArray(), [])

  const ready = txs && accounts && categories
  const items = ready ? [...txs].sort((a, b) => b.timestamp - a.timestamp) : []
  const breaking = items.filter(breaksNoSpendDay).length

  return (
    <Sheet title={formatDayHeading(date, today)} onClose={onClose}>
      {ready && (
        <>
          <p role="status" className="text-sm" data-testid="day-summary">
            {breaking === 0 ? 'День без трат' : `Расходов, нарушающих день: ${breaking}`}
          </p>
          {items.length === 0 ? (
            <p className="py-2 text-sm text-fg-muted" data-testid="day-empty">В этот день операций не было</p>
          ) : (
            <ul aria-label="Операции дня" className="divide-y divide-zinc-800" data-selectable>
              {items.map((t) => {
                const account = accounts.find((a) => a.id === t.accountId)
                const category = categories.find((c) => c.id === t.categoryId)
                const effect = effectLabel(t)
                const title =
                  t.type === 'transfer' ? 'Перевод' : t.debtId ? 'Платёж по долгу' : t.goalId ? 'Пополнение цели' : (category?.name ?? 'Без категории')
                const sign = t.type === 'income' ? '+' : t.type === 'expense' ? '−' : ''
                return (
                  <li key={t.id} className="flex items-center gap-3 py-2.5" data-testid="day-op">
                    <span
                      className="grid size-9 shrink-0 place-items-center rounded-full bg-zinc-800"
                      style={category ? { background: `${category.color}33`, color: category.color } : undefined}
                    >
                      <CategoryIcon name={category?.icon ?? 'Circle'} className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{title}</p>
                      <p className="truncate text-xs text-fg-muted">
                        {account?.name}
                        {t.comment ? ` · ${t.comment}` : ''}
                      </p>
                      {effect && <p className={cn('text-xs', effect.breaks ? 'text-danger' : 'text-fg-muted')}>{effect.text}</p>}
                    </div>
                    <p className={cn('shrink-0 text-sm tabular-nums', t.type === 'income' ? 'text-income' : t.type === 'transfer' ? 'text-transfer' : 'text-zinc-100')}>
                      {sign}
                      {formatMoney(t.amount, account?.currency)}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </Sheet>
  )
}
