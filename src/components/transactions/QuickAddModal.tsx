import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Delete, X } from 'lucide-react'
import { db, type Transaction } from '../../db/schema'
import { toLocalDateString } from '../../domain/dates'
import { applyNumpadKey, displayAmount, parseAmount, type NumpadKey } from '../../domain/numpad'
import { cn } from '../../lib/cn'
import { formatMoney } from '../../lib/format'
import { CategoryIcon } from '../../lib/icons'
import { addTransaction } from '../../services/transactionService'

const TYPES: { value: Transaction['type']; label: string }[] = [
  { value: 'expense', label: 'Расход' },
  { value: 'income', label: 'Доход' },
  { value: 'transfer', label: 'Перевод' },
]
const KEYS: NumpadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'backspace']

export function QuickAddModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  // Форма монтируется только на время показа — состояние сбрасывается само.
  return open ? <QuickAddForm onClose={onClose} /> : null
}

function QuickAddForm({ onClose }: { onClose: () => void }) {
  const accounts = useLiveQuery(
    () => db.accounts.filter((a) => !a.isArchived).toArray(),
    [],
  )
  const categories = useLiveQuery(() => db.categories.toArray(), [])

  const [type, setType] = useState<Transaction['type']>('expense')
  const [amount, setAmount] = useState('')
  const [accountId, setAccountId] = useState<string>()
  const [toAccountId, setToAccountId] = useState<string>()
  const [categoryId, setCategoryId] = useState<string>()
  const [excluded, setExcluded] = useState(false)
  const [toAmount, setToAmount] = useState('')
  const [today] = useState(() => toLocalDateString(new Date()))
  const [date, setDate] = useState(today)
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

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
  const canSave =
    !saving && value > 0 && !!fromAccount &&
    (type === 'transfer' ? !!toAccount && (!crossCurrency || parseAmount(toAmount) > 0) : true)

  async function save() {
    if (!canSave || !fromAccount) return
    setSaving(true)
    setError(undefined)
    try {
      await addTransaction({
        date,
        type,
        accountId: fromAccount.id,
        amount: value,
        isExcludedFromNoSpend: type === 'expense' && excluded,
        ...(type === 'transfer'
          ? { toAccountId: toAccount!.id, ...(crossCurrency ? { toAmount: parseAmount(toAmount) } : {}) }
          : { categoryId }),
      })
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
  ) => (
    <div>
      <p className="mb-1 px-1 text-xs text-zinc-500">{label}</p>
      <div className="flex gap-2 overflow-x-auto pb-1" role="radiogroup" aria-label={label}>
        {list?.map((a) => (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={a.id === selectedId}
            onClick={() => onPick(a.id)}
            className={cn(
              'shrink-0 rounded-xl border px-3 py-2 text-left text-sm',
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
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Новая операция">
      <button type="button" aria-label="Закрыть" className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative flex max-h-[96dvh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-3xl bg-zinc-950 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 rounded-xl bg-zinc-900 p-1" role="tablist">
            {TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={type === t.value}
                onClick={() => { setType(t.value); setCategoryId(undefined) }}
                className={cn(
                  'flex-1 rounded-lg py-2 text-sm font-medium',
                  type === t.value ? 'bg-zinc-700 text-white' : 'text-zinc-400',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button type="button" aria-label="Закрыть" onClick={onClose} className="grid size-10 place-items-center rounded-xl bg-zinc-900">
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="flex items-end justify-between px-1">
          <input
            type="date"
            aria-label="Дата"
            value={date}
            max={today}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="rounded-lg bg-zinc-900 px-2 py-1 text-xs text-zinc-300"
          />
          <div
            data-testid="amount"
            className={cn(
              'text-right text-5xl font-semibold tabular-nums',
              type === 'income' ? 'text-emerald-400' : type === 'transfer' ? 'text-sky-400' : 'text-zinc-100',
            )}
          >
            {displayAmount(amount).replace('.', ',')}
            <span className="ml-1 text-2xl text-zinc-500">{fromAccount ? formatMoney(0, fromAccount.currency).slice(-1) : ''}</span>
          </div>
        </div>

        {accountChips(accounts, fromAccount?.id, setAccountId, type === 'income' ? 'Счёт зачисления' : 'Счёт списания')}
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

        {type !== 'transfer' && (
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Категория">
            {visibleCategories.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={c.id === categoryId}
                onClick={() => setCategoryId(c.id)}
                className={cn(
                  'flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border p-2 text-center text-xs',
                  c.id === categoryId ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-800 bg-zinc-900',
                )}
              >
                <span className="grid size-9 place-items-center rounded-full" style={{ background: `${c.color}33`, color: c.color }}>
                  <CategoryIcon name={c.icon} className="size-5" />
                </span>
                {c.name}
              </button>
            ))}
          </div>
        )}

        {type === 'expense' && (
          <label className="flex items-center justify-between rounded-xl bg-zinc-900 px-3 py-3 text-sm">
            <span>
              Исключить из дней без трат
              <span className="block text-xs text-zinc-500">коммуналка, кредит, аренда</span>
            </span>
            <input type="checkbox" checked={excluded} onChange={(e) => setExcluded(e.target.checked)} className="size-5 accent-emerald-500" />
          </label>
        )}

        <div className="grid grid-cols-3 gap-2">
          {KEYS.map((k) => (
            <button
              key={k}
              type="button"
              aria-label={k === 'backspace' ? 'Стереть' : k === '.' ? 'Точка' : k}
              onClick={() => setAmount((a) => applyNumpadKey(a, k))}
              className="grid h-14 place-items-center rounded-2xl bg-zinc-900 text-2xl active:bg-zinc-800"
            >
              {k === 'backspace' ? <Delete className="size-6" aria-hidden /> : k === '.' ? ',' : k}
            </button>
          ))}
        </div>

        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          className="h-14 rounded-2xl bg-emerald-500 text-lg font-semibold text-zinc-950 disabled:opacity-40"
        >
          Сохранить
        </button>
      </div>
    </div>
  )
}
