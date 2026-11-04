import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/schema'
import { cn } from '../../lib/cn'
import { formatMoney } from '../../lib/format'

/** Временный живой список последних операций (заменится экраном Dashboard в фазе 5). */
export function RecentTransactions() {
  const txs = useLiveQuery(() => db.transactions.orderBy('timestamp').reverse().limit(10).toArray(), [])
  const accounts = useLiveQuery(() => db.accounts.toArray(), [])
  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const currency = (id: string) => accounts?.find((a) => a.id === id)?.currency ?? 'KZT'

  if (!txs?.length) return <p className="px-4 text-sm text-zinc-500">Операций пока нет</p>
  return (
    <ul className="divide-y divide-zinc-900 px-4" aria-label="Последние операции">
      {txs.map((t) => (
        <li key={t.id} className="flex items-center justify-between py-3 text-sm">
          <div>
            <div>{categories?.find((c) => c.id === t.categoryId)?.name ?? (t.type === 'transfer' ? 'Перевод' : 'Без категории')}</div>
            <div className="text-xs text-zinc-500">{t.date}</div>
          </div>
          <div className={cn('tabular-nums', t.type === 'income' ? 'text-emerald-400' : t.type === 'expense' ? 'text-zinc-100' : 'text-sky-400')}>
            {t.type === 'income' ? '+' : t.type === 'expense' ? '−' : ''}
            {formatMoney(t.amount, currency(t.accountId))}
          </div>
        </li>
      ))}
    </ul>
  )
}
