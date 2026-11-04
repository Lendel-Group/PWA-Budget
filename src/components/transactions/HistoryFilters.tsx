import { X } from 'lucide-react'
import type { Account, Category } from '../../db/schema'
import { isFilterActive, type HistoryFilter, type PeriodPreset, type TypeFilter } from '../../domain/history'
import { cn } from '../../lib/cn'
import { inputClass } from '../ui/form'
import { SegmentedControl } from '../ui/SegmentedControl'

export type PeriodChoice = PeriodPreset | 'custom'

export interface PeriodState {
  preset: PeriodChoice
  from: string
  to: string
}

const TYPES: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'expense', label: 'Расходы' },
  { value: 'income', label: 'Доходы' },
  { value: 'transfer', label: 'Переводы' },
]

const PERIODS: { value: PeriodChoice; label: string }[] = [
  { value: 'all', label: 'Всё время' },
  { value: 'month', label: 'Этот месяц' },
  { value: 'prev-month', label: 'Прошлый месяц' },
  { value: '30d', label: 'Последние 30 дней' },
  { value: 'custom', label: 'Свой период…' },
]

interface Props {
  filter: HistoryFilter
  period: PeriodState
  accounts: Account[]
  categories: Category[]
  today: string
  onFilter: (patch: Partial<HistoryFilter>) => void
  onPeriod: (p: PeriodState) => void
  onReset: () => void
}

const select = cn(inputClass, 'min-h-11 truncate')

export function HistoryFilters({ filter, period, accounts, categories, today, onFilter, onPeriod, onReset }: Props) {
  const visibleCategories = categories.filter((c) => filter.type === 'all' || c.type === filter.type)
  const rangeInvalid = period.preset === 'custom' && !!period.from && !!period.to && period.from > period.to

  return (
    <div className="space-y-2">
      <SegmentedControl
        label="Тип операции"
        options={TYPES}
        value={filter.type}
        // Категории привязаны к типу: при смене типа выбранная категория сбрасывается
        onChange={(type) => onFilter({ type, categoryId: '' })}
        className="p-1"
        itemClassName="px-1 text-sm"
      />

      <div className="grid grid-cols-2 gap-2">
        <select aria-label="Счёт" className={select} value={filter.accountId} onChange={(e) => onFilter({ accountId: e.target.value })}>
          <option value="">Все счета</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.isArchived ? ' (архив)' : ''}</option>)}
        </select>
        <select
          aria-label="Категория"
          className={select}
          value={filter.categoryId}
          disabled={filter.type === 'transfer'}
          onChange={(e) => onFilter({ categoryId: e.target.value })}
        >
          <option value="">Все категории</option>
          {visibleCategories.map((c) => <option key={c.id} value={c.id}>{c.name}{c.isArchived ? ' (скрыта)' : ''}</option>)}
        </select>
      </div>

      <select
        aria-label="Период"
        className={select}
        value={period.preset}
        onChange={(e) => onPeriod({ ...period, preset: e.target.value as PeriodChoice })}
      >
        {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
      </select>

      {period.preset === 'custom' && (
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs text-zinc-400">
            С
            <input type="date" className={cn(select, 'mt-1')} max={today} value={period.from} onChange={(e) => onPeriod({ ...period, from: e.target.value })} />
          </label>
          <label className="block text-xs text-zinc-400">
            По
            <input type="date" className={cn(select, 'mt-1')} max={today} value={period.to} onChange={(e) => onPeriod({ ...period, to: e.target.value })} />
          </label>
          {rangeInvalid && <p role="alert" className="col-span-2 text-xs text-danger">Начало периода позже конца</p>}
        </div>
      )}

      {isFilterActive(filter) && (
        <button type="button" onClick={onReset} className="flex min-h-11 items-center gap-1.5 px-1 text-sm text-accent-fg">
          <X className="size-4" aria-hidden /> Сбросить фильтры
        </button>
      )}
    </div>
  )
}
