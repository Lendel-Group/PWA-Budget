import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/cn'

interface Props {
  title: string
  titleTestId?: string
  /** «месяц» / «год» — для подписей стрелок */
  unit: 'месяц' | 'год'
  canPrev: boolean
  canNext: boolean
  onPrev: () => void
  onNext: () => void
  /** Вне текущего периода показывается чип «Сегодня» */
  isCurrent: boolean
  onToday: () => void
  compact?: boolean
}

/**
 * Переключатель периода для «Бюджета», «Аналитики» и «Без трат». Недоступная стрелка остаётся в порядке фокуса,
 * но помечена aria-disabled и ничего не делает; вне текущего периода появляется чип «Сегодня».
 */
export function PeriodSwitcher({ title, titleTestId, unit, canPrev, canNext, onPrev, onNext, isCurrent, onToday, compact }: Props) {
  const arrow = (dir: 'prev' | 'next') => {
    const enabled = dir === 'prev' ? canPrev : canNext
    const Icon = dir === 'prev' ? ChevronLeft : ChevronRight
    return (
      <button
        type="button"
        aria-label={`${dir === 'prev' ? 'Предыдущий' : 'Следующий'} ${unit}`}
        aria-disabled={!enabled}
        onClick={() => enabled && (dir === 'prev' ? onPrev() : onNext())}
        className={cn('grid size-11 shrink-0 place-items-center', compact ? 'rounded-lg bg-zinc-800' : 'rounded-xl bg-zinc-900', !enabled && 'opacity-40')}
      >
        <Icon className={compact ? 'size-4' : 'size-5'} aria-hidden />
      </button>
    )
  }
  return (
    <div className="flex items-center justify-between gap-2">
      {arrow('prev')}
      <div className="flex min-w-0 flex-wrap items-center justify-center gap-x-2">
        <h2 className={cn( compact ? 'font-medium' : 'text-lg font-semibold')} data-testid={titleTestId}>{title}</h2>
        {!isCurrent && (
          <button type="button" onClick={onToday} className="min-h-11 px-2 text-xs font-medium text-accent-fg underline">
            Сегодня
          </button>
        )}
      </div>
      {arrow('next')}
    </div>
  )
}
