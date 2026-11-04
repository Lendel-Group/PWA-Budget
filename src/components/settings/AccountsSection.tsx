import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Archive, ArchiveRestore, Plus } from 'lucide-react'
import { Field, Sheet } from '../ui/Sheet'
import { inputClass, primaryButton, toNumber } from '../ui/form'
import { db, type Account } from '../../db/schema'
import { ACCOUNT_TYPE_LABELS } from '../../domain/accounts'
import { cn } from '../../lib/cn'
import { formatMoney } from '../../lib/format'
import { createAccount, setAccountArchived } from '../../services/accountService'

function AddAccountSheet({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [type, setType] = useState<Account['type']>('card')
  const [currency, setCurrency] = useState<Account['currency']>('KZT')
  const [balance, setBalance] = useState('')
  const [error, setError] = useState<string>()

  async function submit() {
    try {
      await createAccount({ name, type, currency, initialBalance: balance.trim() === '' ? 0 : toNumber(balance) })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось создать счёт')
    }
  }

  return (
    <Sheet title="Новый счёт" onClose={onClose}>
      <Field label="Название"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Kaspi Gold" /></Field>
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
      <Field label="Начальный остаток"><input className={inputClass} inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0" /></Field>
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <button type="button" className={primaryButton} onClick={submit}>Создать счёт</button>
    </Sheet>
  )
}

export function AccountsSection() {
  const accounts = useLiveQuery(() => db.accounts.toArray(), [])
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string>()
  if (!accounts) return null
  const sorted = [...accounts].sort((a, b) => Number(a.isArchived) - Number(b.isArchived) || a.createdAt.localeCompare(b.createdAt))

  return (
    <section aria-labelledby="accounts-h" className="space-y-3 rounded-2xl bg-zinc-900 p-4">
      <h2 id="accounts-h" className="font-medium">Счета</h2>
      <ul className="divide-y divide-zinc-800">
        {sorted.map((a) => (
          <li key={a.id} className={cn('flex items-center justify-between gap-3 py-2.5', a.isArchived && 'opacity-50')}>
            <div className="min-w-0">
              <p className="truncate text-sm">{a.name}{a.isArchived && ' · в архиве'}</p>
              <p className="text-xs text-fg-muted">{ACCOUNT_TYPE_LABELS[a.type]} · {formatMoney(a.currentBalance, a.currency)}</p>
            </div>
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
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <button type="button" onClick={() => setAdding(true)} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 text-sm text-zinc-300">
        <Plus className="size-4" aria-hidden /> Добавить счёт
      </button>
      {adding && <AddAccountSheet onClose={() => setAdding(false)} />}
    </section>
  )
}
