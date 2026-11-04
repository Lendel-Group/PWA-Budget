import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarDays, Delete, SlidersHorizontal, X } from 'lucide-react'
import { db, type Transaction } from '../../db/schema'
import { formatDateChip, toLocalDateString } from '../../domain/dates'
import { applyNumpadKey, displayAmount, parseAmount, type NumpadKey } from '../../domain/numpad'
import { cn } from '../../lib/cn'
import { formatMoney } from '../../lib/format'
import { CategoryIcon } from '../../lib/icons'
import type { NewTransaction } from '../../domain/finance'
import { Dialog } from '../ui/Dialog'
import { SegmentedControl } from '../ui/SegmentedControl'
import { useToast } from '../../lib/toastContext'
import { savedMessage } from '../../lib/savedMessage'
import { addTransaction, updateTransaction } from '../../services/transactionService'

const TYPES: { value: Transaction['type']; label: string }[] = [
  { value: 'expense', label: 'Расход' },
  { value: 'income', label: 'Доход' },
  { value: 'transfer', label: 'Перевод' },
]
/** Следит, есть ли у прокручиваемого блока непоказанное содержимое снизу (для подсказки-градиента). */
function useMoreBelow() {
  const ref = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState(false)
  const update = useCallback(() => {
    const el = ref.current
    if (el) setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 4)
  }, [])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [update])
  return { ref, more, update }
}

const KEYS: NumpadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'backspace']

interface ModalProps {
  open: boolean
  /** Если задана — форма редактирует эту операцию, иначе создаёт новую. */
  editing?: Transaction
  onClose: () => void
}

export function QuickAddModal({ open, editing, onClose }: ModalProps) {
  // Форма монтируется только на время показа — состояние сбрасывается само.
  return open ? <QuickAddForm editing={editing} onClose={onClose} /> : null
}

function QuickAddForm({ editing, onClose }: { editing?: Transaction; onClose: () => void }) {
  /** Платёж по долгу / пополнение цели: тип, категория и связь не меняются, счёт — только в тенге. */
  const linked = !!editing && (!!editing.debtId || !!editing.goalId)
  // При редактировании архивные счета самой операции остаются в списке, иначе выбор молча сменился бы
  const accounts = useLiveQuery(
    () => db.accounts
      .filter((a) => (!linked || a.currency === 'KZT') && (!a.isArchived || a.id === editing?.accountId || a.id === editing?.toAccountId))
      .toArray(),
    [linked, editing?.accountId, editing?.toAccountId],
  )
  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const toast = useToast()

  const [type, setType] = useState<Transaction['type']>(editing?.type ?? 'expense')
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '')
  const [accountId, setAccountId] = useState<string | undefined>(editing?.accountId)
  const [toAccountId, setToAccountId] = useState<string | undefined>(editing?.toAccountId)
  const [categoryId, setCategoryId] = useState<string | undefined>(editing?.categoryId)
  const [excluded, setExcluded] = useState(editing?.isExcludedFromNoSpend ?? false)
  const [comment, setComment] = useState(editing?.comment ?? '')
  const [moreOpen, setMoreOpen] = useState(!!editing?.comment)
  const [toAmount, setToAmount] = useState(editing?.toAmount !== undefined ? String(editing.toAmount) : '')
  const [today] = useState(() => toLocalDateString(new Date()))
  const [date, setDate] = useState(editing?.date ?? today)
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const { ref: scrollRef, more: moreBelow, update: updateMore } = useMoreBelow()

  const fromAccount = accounts?.find((a) => a.id === accountId) ?? accounts?.[0]
  const targets = useMemo(
    () => accounts?.filter((a) => a.id !== fromAccount?.id) ?? [],
    [accounts, fromAccount?.id],
  )
  const toAccount = targets.find((a) => a.id === toAccountId) ?? targets[0]
  const visibleCategories = categories?.filter((c) => c.type === type) ?? []
  const crossCurrency =
    type === 'transfer' && !!toAccount && !!fromAccount && toAccount.currency !== fromAccount.currency

  const value = parseAmount(amount)
  const showExcluded = type === 'expense' && !linked
  const hasExtras = (showExcluded && excluded) || comment.trim() !== ''
  const needsCategory = type !== 'transfer' && !linked && !categoryId
  const canSave =
    !saving && value > 0 && !!fromAccount && !needsCategory &&
    (type === 'transfer' ? !!toAccount && (!crossCurrency || parseAmount(toAmount) > 0) : true)

  async function save() {
    if (!canSave || !fromAccount) return
    setSaving(true)
    setError(undefined)
    try {
      const payload: NewTransaction = {
        date,
        type,
        accountId: fromAccount.id,
        amount: value,
        isExcludedFromNoSpend: linked ? editing.isExcludedFromNoSpend : type === 'expense' && excluded,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
        ...(editing?.debtId ? { debtId: editing.debtId } : {}),
        ...(editing?.goalId ? { goalId: editing.goalId } : {}),
        ...(type === 'transfer'
          ? { toAccountId: toAccount!.id, ...(crossCurrency ? { toAmount: parseAmount(toAmount) } : {}) }
          : categoryId ? { categoryId } : {}),
      }
      if (editing) await updateTransaction(editing.id, payload)
      else await addTransaction(payload)
      toast(savedMessage(payload, fromAccount.currency, !!editing))
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить')
      setSaving(false)
    }
  }

  const accountChips = (
    list: typeof accounts,
    selectedId: string | undefined,
    onPick: (id: string) => void,
    label: string,
    /** На низких экранах подпись скрыта визуально (остаётся в aria-label группы), если она очевидна из контекста */
    hideLabelWhenShort = false,
  ) => (
    <div>
      <p className={cn('mb-1 px-1 text-xs text-fg-muted', hideLabelWhenShort && '[@media(max-height:700px)]:hidden')}>{label}</p>
      <div className="flex gap-2 overflow-x-auto pb-1" role="radiogroup" aria-label={label}>
        {list?.map((a) => (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={a.id === selectedId}
            onClick={() => onPick(a.id)}
            className={cn(
              'shrink-0 rounded-xl border px-3 py-1.5 text-left text-sm [@media(max-height:700px)]:flex [@media(max-height:700px)]:min-h-11 [@media(max-height:700px)]:items-center [@media(max-height:700px)]:gap-2 [@media(max-height:700px)]:py-1',
              a.id === selectedId ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-800 bg-zinc-900',
            )}
          >
            <div className="font-medium">{a.name}</div>
            <div className="text-xs text-zinc-400">{formatMoney(a.currentBalance, a.currency)}</div>
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <Dialog
      label={editing ? 'Редактирование операции' : 'Новая операция'}
      onClose={onClose}
      panelClassName="flex h-[calc(100dvh-env(safe-area-inset-top)-0.5rem)] w-full max-w-md flex-col gap-2.5 rounded-t-3xl [@media(max-height:700px)]:gap-2 bg-zinc-950 p-4 pb-[max(1rem,var(--safe-bottom))]"
    >
      <div className="flex items-center gap-2">
        {linked ? (
          <p className="flex min-h-11 flex-1 items-center rounded-xl bg-zinc-900 px-3 text-sm font-medium">
            {editing.debtId ? 'Платёж по долгу' : 'Пополнение цели'}
          </p>
        ) : (
          <SegmentedControl
            label="Тип операции"
            options={TYPES}
            value={type}
            onChange={(v) => { setType(v); setCategoryId(undefined) }}
            className="flex-1 p-0.5"
            itemClassName="text-sm"
          />
        )}
        <button type="button" aria-label="Закрыть" onClick={onClose} className="grid size-11 place-items-center rounded-xl bg-zinc-900">
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          {/* Нативный выбор даты скрыт под чипом: нажатие по чипу открывает системный календарь */}
          <label className="relative flex min-h-11 items-center gap-1.5 rounded-xl bg-zinc-900 px-3 text-sm text-zinc-300 focus-within:ring-2 focus-within:ring-emerald-500">
            <CalendarDays className="size-4 text-fg-muted" aria-hidden />
            <span>{formatDateChip(date, today)}</span>
            <input
              type="date"
              aria-label="Дата"
              value={date}
              max={today}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
            />
          </label>
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-controls={moreOpen ? 'quick-add-more' : undefined}
            aria-label={hasExtras ? 'Ещё: есть комментарий или особая настройка' : 'Ещё'}
            onClick={() => setMoreOpen((v) => !v)}
            className={cn(
              'relative grid size-11 place-items-center rounded-xl bg-zinc-900 text-zinc-400',
              moreOpen && 'bg-zinc-800 text-zinc-100',
            )}
          >
            <SlidersHorizontal className="size-5" aria-hidden />
            {hasExtras && <span aria-hidden className="absolute right-2 top-2 size-2 rounded-full bg-emerald-400" />}
          </button>
        </div>
        <div
          data-testid="amount"
          className={cn(
            'min-w-0 truncate text-right text-4xl font-semibold tabular-nums',
            type === 'income' ? 'text-emerald-400' : type === 'transfer' ? 'text-sky-400' : 'text-zinc-100',
          )}
        >
          {displayAmount(amount).replace('.', ',')}
          <span className="ml-1 text-2xl text-fg-muted">{fromAccount ? formatMoney(0, fromAccount.currency).slice(-1) : ''}</span>
        </div>
      </div>

      {accountChips(accounts, fromAccount?.id, setAccountId, type === 'income' ? 'Счёт зачисления' : 'Счёт списания', type !== 'transfer')}
      {type === 'transfer' && accountChips(targets, toAccount?.id, setToAccountId, 'Счёт зачисления')}

      {crossCurrency && (
        <label className="flex items-center justify-between gap-3 rounded-xl bg-zinc-900 px-3 py-2 text-sm">
          <span>Сумма зачисления ({toAccount?.currency})</span>
          <input
            inputMode="decimal"
            value={toAmount}
            onChange={(e) => setToAmount(e.target.value.replace(',', '.').replace(/[^\d.]/g, ''))}
            className="w-28 rounded-lg bg-zinc-800 px-2 py-1 text-right"
          />
        </label>
      )}

      {/* Категории прокручиваются, а цифровая клавиатура и «Сохранить» всегда остаются на экране */}
      <div className="relative min-h-0 flex-1">
      <div ref={scrollRef} onScroll={updateMore} className="h-full overflow-y-auto">
        {type !== 'transfer' && !linked && (
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Категория">
            {visibleCategories.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={c.id === categoryId}
                onClick={() => setCategoryId(c.id)}
                className={cn(
                  'flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-2xl border p-2 text-center text-xs [@media(max-height:600px)]:min-h-16 [@media(max-height:600px)]:gap-0.5 [@media(max-height:600px)]:p-1.5',
                  c.id === categoryId ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-800 bg-zinc-900',
                )}
              >
                <span className="grid size-9 place-items-center rounded-full [@media(max-height:600px)]:size-7" style={{ background: `${c.color}33`, color: c.color }}>
                  <CategoryIcon name={c.icon} className="size-5 [@media(max-height:600px)]:size-4" />
                </span>
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>
      {moreBelow && (
        <div aria-hidden data-testid="more-categories" className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-zinc-950 to-transparent" />
      )}
      </div>

      <div className="shrink-0 space-y-2">
        {moreOpen && (
          <div id="quick-add-more" className="space-y-2">
            <input
              aria-label="Комментарий"
              placeholder="Комментарий"
              maxLength={100}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-11 w-full rounded-xl bg-zinc-900 px-3 text-base outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {showExcluded && (
              <label className="flex items-center justify-between rounded-xl bg-zinc-900 px-3 py-2 text-sm">
                <span>
                  Исключить из дней без трат
                  <span className="block text-xs text-fg-muted">коммуналка, кредит, аренда</span>
                </span>
                <input type="checkbox" checked={excluded} onChange={(e) => setExcluded(e.target.checked)} className="size-5 accent-emerald-500" />
              </label>
            )}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          {KEYS.map((k) => (
            <button
              key={k}
              type="button"
              aria-label={k === 'backspace' ? 'Стереть' : k === '.' ? 'Точка' : k}
              onClick={() => setAmount((a) => applyNumpadKey(a, k))}
              className="grid h-12 place-items-center rounded-2xl bg-zinc-900 text-2xl active:bg-zinc-800 [@media(max-height:700px)]:h-11"
            >
              {k === 'backspace' ? <Delete className="size-6" aria-hidden /> : k === '.' ? ',' : k}
            </button>
          ))}
        </div>

        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        {needsCategory && value > 0 && <p role="status" className="text-center text-xs text-amber-400">Выберите категорию</p>}
        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          className="h-12 w-full rounded-2xl bg-emerald-500 text-lg font-semibold text-zinc-950 disabled:opacity-40"
        >
          {editing ? 'Сохранить изменения' : 'Сохранить'}
        </button>
      </div>
    </Dialog>
  )
}
