import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CheckCircle2, Plus, Trash2 } from 'lucide-react'
import { AccountSelect } from '../ui/AccountSelect'
import { ColorPicker } from '../ui/ColorPicker'
import { FormField, SubmitButton } from '../ui/FormField'
import { Field, Sheet } from '../ui/Sheet'
import { inputClass, toNumber } from '../ui/form'
import { db, type FinancialGoal } from '../../db/schema'
import { amountFieldError, calculateGoalPlan, goalFieldErrors, type GoalField } from '../../domain/planning'
import { formatMoney } from '../../lib/format'
import { COLOR_CHOICES } from '../../lib/palette'
import { useFormValidation } from '../../lib/useFormValidation'
import { useToday } from '../../lib/useToday'
import { createGoal, deleteGoal, topUpGoal } from '../../services/planningService'

/** Палитра целей — первые шесть цветов общей палитры. */
const COLORS = COLOR_CHOICES.slice(0, 6)

const GOAL_FIELD_LABELS: Record<GoalField, string> = { title: 'название', targetAmount: 'сумма', targetDate: 'дата' }

function AddGoalSheet({ onClose }: { onClose: () => void }) {
  const today = useToday()
  const [title, setTitle] = useState('')
  const [target, setTarget] = useState('')
  const [date, setDate] = useState('')
  const [color, setColor] = useState<string>(COLORS[0].value)
  const [error, setError] = useState<string>()
  const input = { title, targetAmount: toNumber(target), targetDate: date }
  const v = useFormValidation(goalFieldErrors(input, today))

  async function submit() {
    try {
      await createGoal({ ...input, color }, today)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить')
    }
  }

  return (
    <Sheet title="Новая цель" onClose={onClose}>
      <FormField label="Название" {...v.field('title')}>
        {(a11y) => <input {...a11y} data-autofocus className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Отпуск" />}
      </FormField>
      <div className="grid grid-cols-2 items-start gap-3">
        <FormField label="Сумма, ₸" {...v.field('targetAmount')}>
          {(a11y) => <input {...a11y} className={inputClass} inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />}
        </FormField>
        <FormField label="Дата" {...v.field('targetDate')}>
          {(a11y) => <input {...a11y} className={inputClass} type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />}
        </FormField>
      </div>
      <ColorPicker choices={COLORS} value={color} onChange={setColor} />
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <SubmitButton missing={v.invalid.map((k) => GOAL_FIELD_LABELS[k])} onClick={submit}>Добавить цель</SubmitButton>
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
  const v = useFormValidation({ amount: amountFieldError(toNumber(amount)) })

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
      <FormField label="Сумма, ₸" {...v.field('amount')}>
        {(a11y) => <input {...a11y} data-autofocus className={inputClass} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />}
      </FormField>
      <Field label="Списать со счёта">
        {accounts?.length ? <AccountSelect accounts={accounts} value={selected ?? ''} onChange={setAccountId} /> : <p className="text-sm text-warning">Нет счёта в тенге</p>}
      </Field>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <SubmitButton missing={v.invalid.map(() => 'сумма')} disabled={busy || !selected} onClick={submit}>Пополнить</SubmitButton>
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
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <ul className="space-y-3" aria-label="Финансовые цели">
        {goals.map((g) => {
          const pct = Math.min(100, (g.currentAmount / g.targetAmount) * 100)
          const plan = calculateGoalPlan(g, today)
          return (
            <li key={g.id} data-selectable className="rounded-2xl bg-zinc-900 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="flex items-center gap-1.5 font-medium">
                    {g.title}
                    {g.isAchieved && <CheckCircle2 className="size-4 text-success" aria-label="Цель достигнута" />}
                  </h3>
                  <p className="text-xs text-fg-muted">
                    до {g.targetDate}
                    {!g.isAchieved && plan.daysLeft >= 0 && ` · осталось ${plan.daysLeft} дн.`}
                  </p>
                </div>
                <button type="button" aria-label={`Удалить цель ${g.title}`} className="-mr-2 -mt-2 grid size-11 shrink-0 place-items-center text-fg-muted hover:text-danger"
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
                <button type="button" onClick={() => setTopping(g)} className="mt-3 h-11 w-full rounded-xl bg-accent/15 font-medium text-accent-fg active:bg-accent/25">
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
