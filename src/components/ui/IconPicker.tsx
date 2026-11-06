import { CategoryIcon } from '../../lib/icons'
import { ICON_CHOICES } from '../../lib/iconRegistry'
import { cn } from '../../lib/cn'

interface Props {
  value: string
  onChange: (name: string) => void
  /** Цвет выбранной иконки (цвет категории). */
  color: string
}

/** Выбор иконки: радиогруппа с названиями; выбранная подсвечена цветом категории. */
export function IconPicker({ value, onChange, color }: Props) {
  return (
    <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Иконка">
      {ICON_CHOICES.map((i) => {
        const selected = i.name === value
        return (
          <button
            key={i.name}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={i.label}
            onClick={() => onChange(i.name)}
            className={cn('grid size-11 place-items-center rounded-xl', selected ? 'ring-2 ring-fg' : 'bg-zinc-900 text-zinc-300')}
            style={selected ? { background: `${color}33`, color } : undefined}
          >
            <CategoryIcon name={i.name} className="size-5" />
          </button>
        )
      })}
    </div>
  )
}
