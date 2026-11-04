import { useEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { Account, Category, Transaction } from '../../db/schema'
import { cn } from '../../lib/cn'
import { formatMoney } from '../../lib/format'
import { CategoryIcon } from '../../lib/icons'

/** Ширина раскрываемой кнопки «Удалить». */
const REVEAL = 88
/** Сдвиг, после которого жест считается свайпом, а не нажатием. */
const DRAG_START = 8

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
  /** Нажатие на строку (не свайп) открывает редактирование. */
  onEdit?: (t: Transaction) => void
}

/**
 * Строка операции: нажатие — редактирование. Свайп влево раскрывает кнопку «Удалить» (как в iOS),
 * удаление — только нажатием на неё. Свайп вправо, нажатие на строку или вне её закрывают кнопку.
 * Кнопка всегда в DOM под строкой: с клавиатуры/скринридером до неё доходят Tab'ом, фокус раскрывает строку.
 */
export function TransactionRow({ transaction: t, accounts, categories, onDelete, onEdit }: Props) {
  const [open, setOpen] = useState(false)
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; base: number } | null>(null)
  const root = useRef<HTMLLIElement>(null)
  const account = accounts.find((a) => a.id === t.accountId)
  const category = categories.find((c) => c.id === t.categoryId)
  const sign = t.type === 'income' ? '+' : t.type === 'expense' ? '−' : ''

  // Нажатие вне строки закрывает раскрытое действие
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const end = () => {
    if (!start.current) return
    start.current = null
    if (dragging) setOpen(dx <= -REVEAL / 2)
    setDragging(false)
    setDx(0)
  }

  const offset = dragging ? dx : open ? -REVEAL : 0

  const body = (
    <>
      <span
        className="grid size-9 shrink-0 place-items-center rounded-full bg-zinc-800"
        style={category ? { background: `${category.color}33`, color: category.color } : undefined}
      >
        <CategoryIcon name={category?.icon ?? 'Circle'} className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{describe(t, categories, accounts)}</div>
        <div className="truncate text-xs text-fg-muted">
          {account?.name}
          {t.comment ? ` · ${t.comment}` : ''}
        </div>
      </div>
      <div className={cn('text-sm tabular-nums', t.type === 'income' ? 'text-income' : t.type === 'transfer' ? 'text-transfer' : 'text-zinc-100')}>
        {sign}
        {formatMoney(t.amount, account?.currency)}
      </div>
    </>
  )

  return (
    <li ref={root} className="relative overflow-hidden rounded-xl">
      <button
        type="button"
        aria-label="Удалить операцию"
        onClick={() => onDelete(t)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        style={{ width: REVEAL }}
        className="absolute inset-y-0 right-0 flex flex-col items-center justify-center gap-0.5 rounded-xl bg-red-600 text-xs font-medium text-white"
      >
        <Trash2 className="size-5" aria-hidden />
        Удалить
      </button>
      <div
        className="relative flex touch-pan-y items-center gap-3 bg-zinc-900 px-3"
        style={{ transform: `translateX(${offset}px)`, transition: dragging ? undefined : 'transform .2s' }}
        // Захват указателя — только после сдвига: иначе обычное нажатие по кнопке «Изменить» не дойдёт до click
        onPointerDown={(e) => { start.current = { x: e.clientX, base: open ? -REVEAL : 0 } }}
        onPointerMove={(e) => {
          if (!start.current) return
          const delta = e.clientX - start.current.x
          if (!dragging) {
            if (Math.abs(delta) < DRAG_START) return
            setDragging(true)
            e.currentTarget.setPointerCapture(e.pointerId)
          }
          setDx(Math.max(-REVEAL, Math.min(0, start.current.base + delta)))
        }}
        onPointerUp={end}
        onPointerCancel={end}
      >
        {onEdit ? (
          <button
            type="button"
            onClick={() => (open ? setOpen(false) : onEdit(t))}
            className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-3 text-left"
          >
            {body}
          </button>
        ) : (
          <div className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-3">
            {body}
          </div>
        )}
      </div>
    </li>
  )
}
