import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, CheckCircle2, Plus, Trash2 } from 'lucide-react'
import { AccountSelect } from '../ui/AccountSelect'
import { Field, Sheet } from '../ui/Sheet'
import { inputClass, primaryButton, toNumber } from '../ui/form'
import { db, type FinancialGoal } from '../../db/schema'
import { calculateGoalPlan } from '../../domain/planning'
import { cn } from '../../lib/cn'
import { formatMoney } from '../../lib/format'
import { useToday } from '../../lib/useToday'
import { createGoal, deleteGoal, topUpGoal } from '../../services/planningService'

/** Цвета цели: название читает скринридер, hex — только для отрисовки. */
const COLORS = [
  { value: '#22c55e', name: 'Зелёный' },
  { value: '#3b82f6', name: 'Синий' },
  { value: '#a855f7', name: 'Фиолетовый' },
  { value: '#f97316', name: 'Оранжевый' },
  { value: '#ec4899', name: 'Розовый' },
  { value: '#eab308', name: 'Жёлтый' },
]

function AddGoalSheet({ onClose }: { onClose: () => void }) {
  const today = useToday()
  const [title, setTitle] = useState('')
  const [target, setTarget] = useState('')
  const [date, setDate] = useState('')
  const [color, setColor] = useState(COLORS[0].value)
  const [error, setError] = useState<string>()

  async function submit() {
    try {
      await createGoal({ title, targetAmount: toNumber(target), targetDate: date, color }, today)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить')
    }
  }

  return (
    <Sheet title="Новая цель" onClose={onClose}>
      <Field label="Название"><input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Отпуск" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Сумма, ₸"><input className={inputClass} inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} /></Field>
        <Field label="Дата"><input className={inputClass} type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
      <div className="flex flex-wrap gap-x-1 gap-y-0" role="radiogroup" aria-label="Цвет">
        {COLORS.map((c) => {
          const selected = c.value === color
          return (
            <button key={c.value} type="button" role="radio" aria-checked={selected} aria-label={c.name} onClick={() => setColor(c.value)} className="grid size-11 place-items-center">
              <span
                className={cn('grid size-8 place-items-center rounded-full', selected && 'ring-2 ring-white ring-offset-2 ring-offset-zinc-950')}
                style={{ background: c.value }}
              >
                {selected && <Check className="size-5 text-zinc-950" strokeWidth={3} aria-hidden />}
              </span>
            </button>
          )
        })}
      </div>
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <button type="button" className={primaryButton} onClick={submit}>Добавить цель</button>
    </Sheet>
  )
}

function TopUpSheet({ goal, onClose }: { goal: FinancialGoal; onClose: () => void }) {
  const today = useToday()
  const accounts = useLiveQuery(() => db.accounts.filter((a) => !a.isArchived && a.currency === 'KZT').toArray(), [])
  const [amount, setAmount] = useState('')
  const [accountId, setAccountId] = useState<string>()
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const selected = accountId ?? accounts?.[0]?.id

  async function submit() {
    if (!selected) return
    setBusy(true)
    setError(undefined)
    try {
      await topUpGoal(goal.id, selected, toNumber(amount), today)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось пополнить')
      setBusy(false)
    }
  }

  return (
    <Sheet title={`Пополнить: ${goal.title}`} onClose={onClose}>
      <Field label="Сумма, ₸"><input className={inputClass} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></Field>
      <Field label="Списать со счёта">
        {accounts?.length ? <AccountSelect accounts={accounts} value={selected ?? ''} onChange={setAccountId} /> : <p className="text-sm text-amber-400">Нет счёта в тенге</p>}
      </Field>
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <button type="button" className={primaryButton} disabled={busy || !selected} onClick={submit}>Пополнить</button>
    </Sheet>
  )
}

export function GoalsTab() {
  const today = useToday()
  const goals = useLiveQuery(() => db.goals.toArray(), [])
  const [adding, setAdding] = useState(false)
  const [topping, setTopping] = useState<FinancialGoal>()
  const [error, setError] = useState<string>()
  if (!goals) return null

  return (
    <div className="space-y-3">
      {goals.length === 0 && <p className="py-6 text-center text-sm text-fg-muted">Целей пока нет. Поставьте первую!</p>}
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <ul className="space-y-3" aria-label="Финансовые цели">
        {goals.map((g) => {
          const pct = Math.min(100, (g.currentAmount / g.targetAmount) * 100)
          const plan = calculateGoalPlan(g, today)
          return (
            <li key={g.id} className="rounded-2xl bg-zinc-900 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="flex items-center gap-1.5 font-medium">
                    {g.title}
                    {g.isAchieved && <CheckCircle2 className="size-4 text-emerald-400" aria-label="Цель достигнута" />}
                  </h3>
                  <p className="text-xs text-fg-muted">
                    до {g.targetDate}
                    {!g.isAchieved && plan.daysLeft >= 0 && ` · осталось ${plan.daysLeft} дн.`}
                  </p>
                </div>
                <button type="button" aria-label={`Удалить цель ${g.title}`} className="-mr-2 -mt-2 grid size-11 shrink-0 place-items-center text-fg-muted hover:text-red-400"
                  onClick={async () => {
                    if (!window.confirm(`Удалить цель «${g.title}»?`)) return
                    setError(undefined)
                    try { await deleteGoal(g.id) } catch (e) { setError(e instanceof Error ? e.message : 'Ошибка') }
                  }}>
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
              <p className="mt-3 tabular-nums" data-testid={`goal-current-${g.title}`}>
                <span className="text-2xl font-semibold">{formatMoney(g.currentAmount)}</span>
                <span className="text-sm text-fg-muted"> / {formatMoney(g.targetAmount)}</span>
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800" role="progressbar" aria-label={`Накоплено: ${g.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: g.color }} />
              </div>
              {!g.isAchieved && plan.remaining > 0 && (
                <p className="mt-1 text-xs text-fg-muted">Чтобы успеть: ~{formatMoney(plan.perMonth)} в месяц</p>
              )}
              {!g.isAchieved && (
                <button type="button" onClick={() => setTopping(g)} className="mt-3 h-11 w-full rounded-xl bg-emerald-500/15 font-medium text-emerald-400 active:bg-emerald-500/25">
                  Пополнить
                </button>
              )}
            </li>
          )
        })}
      </ul>
      <button type="button" onClick={() => setAdding(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 py-3 text-sm text-zinc-300">
        <Plus className="size-4" aria-hidden /> Добавить цель
      </button>
      {adding && <AddGoalSheet onClose={() => setAdding(false)} />}
      {topping && <TopUpSheet goal={topping} onClose={() => setTopping(undefined)} />}
    </div>
  )
}
