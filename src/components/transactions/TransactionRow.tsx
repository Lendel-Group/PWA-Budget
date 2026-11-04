import { useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { Account, Category, Transaction } from '../../db/schema'
import { cn } from '../../lib/cn'
import { formatMoney } from '../../lib/format'
import { CategoryIcon } from '../../lib/icons'

const SWIPE_THRESHOLD = 80

function describe(t: Transaction, categories: Category[], accounts: Account[]): string {
  if (t.type === 'transfer') {
    const to = accounts.find((a) => a.id === t.toAccountId)?.name ?? '?'
    return `Перевод → ${to}`
  }
  if (t.debtId) return 'Платёж по долгу'
  if (t.goalId) return 'Пополнение цели'
  return categories.find((c) => c.id === t.categoryId)?.name ?? 'Без категории'
}

interface Props {
  transaction: Transaction
  accounts: Account[]
  categories: Category[]
  onDelete: (t: Transaction) => void
}

/** Строка операции: удаление кнопкой-корзиной или свайпом влево. */
export function TransactionRow({ transaction: t, accounts, categories, onDelete }: Props) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startX = useRef<number | null>(null)
  const account = accounts.find((a) => a.id === t.accountId)
  const category = categories.find((c) => c.id === t.categoryId)
  const sign = t.type === 'income' ? '+' : t.type === 'expense' ? '−' : ''

  const end = () => {
    if (startX.current === null) return
    startX.current = null
    setDragging(false)
    if (dx <= -SWIPE_THRESHOLD) onDelete(t)
    setDx(0)
  }

  return (
    <li className="relative overflow-hidden rounded-xl bg-red-600/80">
      <Trash2 className="absolute right-5 top-1/2 size-5 -translate-y-1/2 text-white" aria-hidden />
      <div
        className="relative flex touch-pan-y items-center gap-3 bg-zinc-900 px-3 py-3"
        style={{ transform: `translateX(${dx}px)`, transition: dragging ? undefined : 'transform .2s' }}
        onPointerDown={(e) => {
          startX.current = e.clientX
          setDragging(true)
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => startX.current !== null && setDx(Math.min(0, e.clientX - startX.current))}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <span
          className="grid size-9 shrink-0 place-items-center rounded-full bg-zinc-800"
          style={category ? { background: `${category.color}33`, color: category.color } : undefined}
        >
          <CategoryIcon name={category?.icon ?? 'Circle'} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm">{describe(t, categories, accounts)}</div>
          <div className="truncate text-xs text-zinc-500">
            {account?.name}
            {t.comment ? ` · ${t.comment}` : ''}
          </div>
        </div>
        <div className={cn('text-sm tabular-nums', t.type === 'income' ? 'text-emerald-400' : t.type === 'transfer' ? 'text-sky-400' : 'text-zinc-100')}>
          {sign}
          {formatMoney(t.amount, account?.currency)}
        </div>
        <button
          type="button"
          aria-label="Удалить операцию"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onDelete(t)}
          className="grid size-9 shrink-0 place-items-center rounded-lg text-zinc-500 hover:text-red-400"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>
    </li>
  )
}
