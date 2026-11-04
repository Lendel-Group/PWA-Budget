import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Trash2 } from 'lucide-react'
import { AccountSelect } from '../ui/AccountSelect'
import { Field, Sheet } from '../ui/Sheet'
import { inputClass, primaryButton, toNumber } from '../ui/form'
import { db, type Debt } from '../../db/schema'
import { daysBetween, nextDueDate } from '../../domain/planning'
import { cn } from '../../lib/cn'
import { formatMoney } from '../../lib/format'
import { useToday } from '../../lib/useToday'
import { createDebt, deleteDebt, payDebt } from '../../services/planningService'

function dueText(today: string, dueDay: number): string {
  const days = daysBetween(today, nextDueDate(today, dueDay))
  return days === 0 ? 'платёж сегодня' : `платёж через ${days} дн.`
}

function AddDebtSheet({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState({ name: '', total: '', remaining: '', monthly: '', dueDay: '', rate: '' })
  const [error, setError] = useState<string>()
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }))

  async function submit() {
    const total = toNumber(f.total)
    try {
      await createDebt({
        name: f.name,
        totalAmount: total,
        remainingAmount: f.remaining.trim() === '' ? total : toNumber(f.remaining),
        monthlyPayment: toNumber(f.monthly),
        dueDay: toNumber(f.dueDay),
        ...(f.rate.trim() !== '' ? { interestRate: toNumber(f.rate) } : {}),
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить')
    }
  }

  return (
    <Sheet title="Новый долг" onClose={onClose}>
      <Field label="Название"><input className={inputClass} value={f.name} onChange={set('name')} placeholder="Кредит на авто" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Сумма долга, ₸"><input className={inputClass} inputMode="decimal" value={f.total} onChange={set('total')} /></Field>
        <Field label="Остаток, ₸"><input className={inputClass} inputMode="decimal" value={f.remaining} onChange={set('remaining')} placeholder="= сумма" /></Field>
        <Field label="Платёж в месяц, ₸"><input className={inputClass} inputMode="decimal" value={f.monthly} onChange={set('monthly')} /></Field>
        <Field label="День платежа (1–31)"><input className={inputClass} inputMode="numeric" value={f.dueDay} onChange={set('dueDay')} /></Field>
      </div>
      <Field label="Ставка, % годовых (необязательно)"><input className={inputClass} inputMode="decimal" value={f.rate} onChange={set('rate')} /></Field>
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <button type="button" className={primaryButton} onClick={submit}>Добавить долг</button>
    </Sheet>
  )
}

function PaySheet({ debt, onClose }: { debt: Debt; onClose: () => void }) {
  const today = useToday()
  const accounts = useLiveQuery(() => db.accounts.filter((a) => !a.isArchived && a.currency === 'KZT').toArray(), [])
  const [amount, setAmount] = useState(String(Math.min(debt.monthlyPayment, debt.remainingAmount)))
  const [accountId, setAccountId] = useState<string>()
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const selected = accountId ?? accounts?.[0]?.id

  async function submit() {
    if (!selected) return
    setBusy(true)
    setError(undefined)
    try {
      await payDebt(debt.id, selected, toNumber(amount), today)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось внести платёж')
      setBusy(false)
    }
  }

  return (
    <Sheet title={`Платёж: ${debt.name}`} onClose={onClose}>
      <p className="text-sm text-zinc-400">Остаток долга: {formatMoney(debt.remainingAmount)}</p>
      <Field label="Сумма платежа, ₸"><input className={inputClass} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
      <Field label="Списать со счёта">
        {accounts?.length ? <AccountSelect accounts={accounts} value={selected ?? ''} onChange={setAccountId} /> : <p className="text-sm text-amber-400">Нет счёта в тенге</p>}
      </Field>
      <p className="text-xs text-fg-muted">Платёж не нарушает «дни без трат».</p>
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <button type="button" className={primaryButton} disabled={busy || !selected} onClick={submit}>Внести платёж</button>
    </Sheet>
  )
}

export function DebtsTab() {
  const today = useToday()
  const debts = useLiveQuery(() => db.debts.toArray(), [])
  const [adding, setAdding] = useState(false)
  const [paying, setPaying] = useState<Debt>()
  const [error, setError] = useState<string>()
  if (!debts) return null

  const sorted = [...debts].sort((a, b) => Number(a.isClosed) - Number(b.isClosed) || a.createdAt.localeCompare(b.createdAt))

  return (
    <div className="space-y-3">
      {sorted.length === 0 && <p className="py-6 text-center text-sm text-fg-muted">Долгов нет. Добавьте кредит, чтобы отслеживать платежи.</p>}
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <ul className="space-y-3" aria-label="Долги">
        {sorted.map((d) => {
          const paid = Math.min(100, ((d.totalAmount - d.remainingAmount) / d.totalAmount) * 100)
          return (
            <li key={d.id} className={cn('rounded-2xl bg-zinc-900 p-4', d.isClosed && 'opacity-60')}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium">{d.name}</h3>
                  <p className="text-xs text-fg-muted">
                    {d.isClosed ? 'Погашен' : `${formatMoney(d.monthlyPayment)}/мес · ${dueText(today, d.dueDay)}`}
                    {d.interestRate !== undefined && ` · ${d.interestRate}%`}
                  </p>
                </div>
                <button
                  type="button" aria-label={`Удалить долг ${d.name}`}
                  className="-mr-2 -mt-2 grid size-11 shrink-0 place-items-center text-fg-muted hover:text-red-400"
                  onClick={async () => {
                    if (!window.confirm(`Удалить долг «${d.name}»?`)) return
                    setError(undefined)
                    try { await deleteDebt(d.id) } catch (e) { setError(e instanceof Error ? e.message : 'Ошибка') }
                  }}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
              <p className="mt-3 text-2xl font-semibold tabular-nums" data-testid={`debt-remaining-${d.name}`}>{formatMoney(d.remainingAmount)}</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800" role="progressbar" aria-label={`Погашено: ${d.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(paid)}>
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${paid}%` }} />
              </div>
              <p className="mt-1 text-xs text-fg-muted">Погашено {Math.round(paid)}% из {formatMoney(d.totalAmount)}</p>
              {!d.isClosed && (
                <button type="button" onClick={() => setPaying(d)} className="mt-3 h-11 w-full rounded-xl bg-emerald-500/15 font-medium text-emerald-400 active:bg-emerald-500/25">
                  Внести платёж
                </button>
              )}
            </li>
          )
        })}
      </ul>
      <button type="button" onClick={() => setAdding(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 py-3 text-sm text-zinc-300">
        <Plus className="size-4" aria-hidden /> Добавить долг
      </button>
      {adding && <AddDebtSheet onClose={() => setAdding(false)} />}
      {paying && <PaySheet debt={paying} onClose={() => setPaying(undefined)} />}
    </div>
  )
}
