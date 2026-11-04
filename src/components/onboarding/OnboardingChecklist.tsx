import { Check, Circle, X } from 'lucide-react'
import type { ReactNode } from 'react'
import type { OnboardingStep, OnboardingStepId } from '../../domain/onboarding'
import { cn } from '../../lib/cn'

const LABELS: Record<OnboardingStepId, { title: string; hint: string; action: string }> = {
  account: { title: 'Добавьте счёт и остаток', hint: 'Откуда считать деньги: карта, наличные, депозит', action: 'К счетам' },
  limits: { title: 'Задайте лимиты', hint: 'Из них считается «Лимит на сегодня»', action: 'К бюджету' },
  transaction: { title: 'Добавьте первую операцию', hint: 'Расход или доход за пару нажатий', action: 'Добавить' },
}

const ACTION_CLASS = 'flex min-h-11 shrink-0 items-center rounded-xl bg-zinc-800 px-3 text-sm font-medium text-zinc-100 active:bg-zinc-700'

/** Чек-лист первых шагов для нового пользователя: шаги отмечаются по данным, у каждого — переход на нужный экран. */
export function OnboardingChecklist({ steps, onAdd, onDismiss }: { steps: OnboardingStep[]; onAdd: () => void; onDismiss: () => void }) {
  const doneCount = steps.filter((s) => s.done).length

  const action = (id: OnboardingStepId): ReactNode => {
    // Имя кнопки = видимая подпись; к какому шагу она относится, скринридер читает из описания (название шага)
    const { action: label } = LABELS[id]
    const describedBy = `onboarding-step-${id}`
    if (id === 'transaction') return <button type="button" onClick={onAdd} className={ACTION_CLASS} aria-describedby={describedBy}>{label}</button>
    return <a href={id === 'account' ? '#/settings' : '#/budget'} className={ACTION_CLASS} aria-describedby={describedBy}>{label}</a>
  }

  return (
    <section aria-labelledby="onboarding-h" className="rounded-2xl border border-accent/40 bg-accent/10 p-4" data-testid="onboarding">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 id="onboarding-h" className="font-medium">С чего начать</h2>
          <p className="text-xs text-fg-muted">Выполнено {doneCount} из {steps.length}</p>
        </div>
        <button type="button" onClick={onDismiss} aria-label="Скрыть подсказки" className="-mr-2 -mt-2 grid size-11 shrink-0 place-items-center rounded-xl text-fg-muted active:bg-zinc-900">
          <X className="size-5" aria-hidden />
        </button>
      </div>
      <ol className="mt-2 space-y-1">
        {steps.map((s) => (
          <li key={s.id} className="flex items-center gap-3 py-1">
            {s.done
              ? <Check className="size-5 shrink-0 text-success" aria-label="Выполнено" />
              : <Circle className="size-5 shrink-0 text-fg-muted" aria-label="Не выполнено" />}
            <div className="min-w-0 flex-1">
              <p id={`onboarding-step-${s.id}`} className={cn('text-sm', s.done && 'text-fg-muted line-through')}>{LABELS[s.id].title}</p>
              {!s.done && <p className="text-xs text-fg-muted">{LABELS[s.id].hint}</p>}
            </div>
            {!s.done && action(s.id)}
          </li>
        ))}
      </ol>
    </section>
  )
}
