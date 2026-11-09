import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Archive, ArchiveRestore, Pencil, Plus } from 'lucide-react'
import { FormField, SubmitButton } from '../ui/FormField'
import { Field, Sheet } from '../ui/Sheet'
import { inputClass, toNumber } from '../ui/form'
import { db, type Account } from '../../db/schema'
import { ACCOUNT_TYPE_LABELS, accountFieldErrors, type AccountField } from '../../domain/accounts'
import { cn } from '../../lib/cn'
import { currencySymbol, formatMoney } from '../../lib/format'
import { useFormValidation } from '../../lib/useFormValidation'
import { createAccount, setAccountArchived, setInitialBalance } from '../../services/accountService'

const ACCOUNT_FIELD_LABELS: Record<AccountField, string> = { name: 'название', initialBalance: 'остаток' }

function AddAccountSheet({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [type, setType] = useState<Account['type']>('card')
  const [currency, setCurrency] = useState<Account['currency']>('KZT')
  const [balance, setBalance] = useState('')
  const [error, setError] = useState<string>()
  const input = { name, type, currency, initialBalance: balance.trim() === '' ? 0 : toNumber(balance) }
  const v = useFormValidation(accountFieldErrors(input))

  async function submit() {
    try {
      await createAccount(input)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось создать счёт')
    }
  }

  return (
    <Sheet title="Новый счёт" onClose={onClose}>
      <FormField label="Название" {...v.field('name')}>
        {(a11y) => <input {...a11y} data-autofocus className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Kaspi Gold" />}
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Тип">
          <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as Account['type'])}>
            {Object.entries(ACCOUNT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field label="Валюта">
          <select className={inputClass} value={currency} onChange={(e) => setCurrency(e.target.value as Account['currency'])}>
            {['KZT', 'USD', 'EUR', 'RUB'].map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
      </div>
      <FormField label="Начальный остаток" {...v.field('initialBalance')}>
        {(a11y) => <input {...a11y} className={inputClass} inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0" />}
      </FormField>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <SubmitButton missing={v.invalid.map((k) => ACCOUNT_FIELD_LABELS[k])} onClick={submit}>Создать счёт</SubmitButton>
    </Sheet>
  )
}

function InitialBalanceSheet({ account, onClose }: { account: Account; onClose: () => void }) {
  const [balance, setBalance] = useState(account.initialBalance === 0 ? '' : String(account.initialBalance))
  const [error, setError] = useState<string>()
  const value = balance.trim() === '' ? 0 : toNumber(balance)
  const v = useFormValidation<'initialBalance'>(Number.isFinite(value) ? {} : { initialBalance: 'Начальный остаток должен быть числом' })

  async function submit() {
    try {
      await setInitialBalance(account.id, value)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить')
    }
  }

  return (
    <Sheet title="Начальный остаток" onClose={onClose}>
      <p className="text-sm text-fg-muted">{account.name} · операций по счёту ещё нет</p>
      <FormField label={`Начальный остаток, ${currencySymbol(account.currency)}`} {...v.field('initialBalance')}>
        {(a11y) => <input {...a11y} data-autofocus className={inputClass} inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0" />}
      </FormField>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <SubmitButton missing={v.invalid.map(() => 'остаток')} onClick={submit}>Сохранить</SubmitButton>
    </Sheet>
  )
}

export function AccountsSection() {
  const accounts = useLiveQuery(() => db.accounts.toArray(), [])
  /** Счета, на которые ссылается хоть одна операция: им начальный остаток уже не меняют. */
  const used = useLiveQuery(async () => {
    const ids = new Set<string>()
    await db.transactions.each((t) => { ids.add(t.accountId); if (t.toAccountId) ids.add(t.toAccountId) })
    return ids
  }, [])
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Account>()
  const [error, setError] = useState<string>()
  if (!accounts || !used) return null
  const sorted = [...accounts].sort((a, b) => Number(a.isArchived) - Number(b.isArchived) || a.createdAt.localeCompare(b.createdAt))

  return (
    <section aria-label="Счета" className="space-y-3 rounded-2xl bg-zinc-900 p-4">
      <ul className="divide-y divide-zinc-800">
        {sorted.map((a) => (
          <li key={a.id} className={cn('flex items-center justify-between gap-3 py-2.5', a.isArchived && 'opacity-50')}>
            <div className="min-w-0">
              <p className="truncate text-sm">{a.name}{a.isArchived && ' · в архиве'}</p>
              <p className="text-xs text-fg-muted">{ACCOUNT_TYPE_LABELS[a.type]} · {formatMoney(a.currentBalance, a.currency)}</p>
            </div>
            {!used.has(a.id) && (
              <button
                type="button"
                aria-label={`Изменить остаток счёта ${a.name}`}
                className="ml-auto grid size-11 shrink-0 place-items-center rounded-lg bg-zinc-800 text-zinc-300"
                onClick={() => { setError(undefined); setEditing(a) }}
              >
                <Pencil className="size-4" aria-hidden />
              </button>
            )}
            <button
              type="button"
              aria-label={a.isArchived ? `Вернуть счёт ${a.name}` : `Архивировать счёт ${a.name}`}
              className="grid size-11 shrink-0 place-items-center rounded-lg bg-zinc-800 text-zinc-300"
              onClick={async () => {
                setError(undefined)
                try { await setAccountArchived(a.id, !a.isArchived) } catch (e) { setError(e instanceof Error ? e.message : 'Ошибка') }
              }}
            >
              {a.isArchived ? <ArchiveRestore className="size-4" aria-hidden /> : <Archive className="size-4" aria-hidden />}
            </button>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button type="button" onClick={() => setAdding(true)} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 text-sm text-zinc-300">
        <Plus className="size-4" aria-hidden /> Добавить счёт
      </button>
      {adding && <AddAccountSheet onClose={() => setAdding(false)} />}
      {editing && <InitialBalanceSheet account={editing} onClose={() => setEditing(undefined)} />}
    </section>
  )
}
