import { Check } from 'lucide-react'
import { cn } from '../../lib/cn'

interface Props {
  choices: readonly { value: string; name: string }[]
  value: string
  onChange: (value: string) => void
  label?: string
}

/** Выбор цвета: радиогруппа с названиями цветов, выбранный помечен кольцом и галочкой. */
export function ColorPicker({ choices, value, onChange, label = 'Цвет' }: Props) {
  return (
    <div className="flex flex-wrap gap-x-1 gap-y-0" role="radiogroup" aria-label={label}>
      {choices.map((c) => {
        const selected = c.value === value
        return (
          <button key={c.value} type="button" role="radio" aria-checked={selected} aria-label={c.name} onClick={() => onChange(c.value)} className="grid size-11 place-items-center">
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
  )
}
