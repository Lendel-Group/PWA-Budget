import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface Segment<T extends string> {
  value: T
  label: string
}

interface Props<T extends string> {
  options: readonly Segment<T>[]
  value: T
  onChange: (value: T) => void
  /** Имя группы для скринридера. */
  label: string
  /**
   * `radio` — выбор одного значения (форма меняется, но панелей нет): `radiogroup`/`radio`.
   * `tabs` — переключение панелей: `tablist`/`tab` + `aria-controls`; содержимое оборачивается в `TabPanel`.
   */
  variant?: 'radio' | 'tabs'
  /** Нужен для `tabs`: связывает вкладки с панелями. */
  id?: string
  /** Классы контейнера (отступы, `flex-1`). */
  className?: string
  /** Классы кнопки (размер шрифта и т. п.). */
  itemClassName?: string
}

const tabId = (id: string, value: string) => `${id}-tab-${value}`
const panelId = (id: string, value: string) => `${id}-panel-${value}`

/**
 * Сегментированный переключатель с клавиатурой по ARIA-паттерну: в Tab-порядке только выбранный сегмент
 * (roving tabindex), стрелки / Home / End переключают и переносят фокус, выбор следует за фокусом.
 */
export function SegmentedControl<T extends string>({
  options, value, onChange, label, variant = 'radio', id, className, itemClassName,
}: Props<T>) {
  const group = useRef<HTMLDivElement>(null)
  const tabs = variant === 'tabs'

  function onKeyDown(e: KeyboardEvent) {
    const current = options.findIndex((o) => o.value === value)
    const last = options.length - 1
    const next =
      e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (current + 1) % options.length
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (current + last) % options.length
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : -1
    if (next < 0) return
    e.preventDefault()
    onChange(options[next].value)
    group.current?.querySelectorAll<HTMLElement>('button')[next]?.focus()
  }

  return (
    <div
      ref={group}
      role={tabs ? 'tablist' : 'radiogroup'}
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn('flex rounded-xl bg-zinc-900', className)}
    >
      {options.map((o) => {
        const selected = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role={tabs ? 'tab' : 'radio'}
            {...(tabs
              ? { id: id ? tabId(id, o.value) : undefined, 'aria-selected': selected, 'aria-controls': id ? panelId(id, o.value) : undefined }
              : { 'aria-checked': selected })}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cn(
              'min-h-11 flex-1 rounded-lg font-medium focus-visible:outline-2 focus-visible:outline-accent',
              selected ? 'bg-zinc-700 text-white' : 'text-zinc-400',
              itemClassName,
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** Панель вкладки для `SegmentedControl variant="tabs"` с тем же `id`. */
export function TabPanel({ id, value, children }: { id: string; value: string; children: ReactNode }) {
  return (
    <div role="tabpanel" id={panelId(id, value)} aria-labelledby={tabId(id, value)}>
      {children}
    </div>
  )
}
