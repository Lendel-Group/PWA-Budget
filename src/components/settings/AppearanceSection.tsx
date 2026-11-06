import { useState } from 'react'
import { Check } from 'lucide-react'
import { THEME_OPTIONS, applyTheme, readThemeMode, saveThemeMode, type ThemeMode } from '../../lib/theme'

/** «Оформление» (spec/05): «Тема» — «Как в системе» | «Светлая» | «Тёмная», применяется сразу. */
export function AppearanceSection() {
  const [mode, setMode] = useState<ThemeMode>(readThemeMode)

  function choose(next: ThemeMode) {
    saveThemeMode(next)
    applyTheme(next)
    setMode(next)
  }

  return (
    <section aria-labelledby="appearance-h" className="space-y-2 rounded-2xl bg-zinc-900 p-4">
      <h2 id="appearance-h" className="font-medium">Оформление</h2>
      {/* Строки, а не сегменты: «Как в системе» не обрезается при крупном шрифте (spec/05, «Доступность») */}
      <div role="radiogroup" aria-labelledby="theme-label">
        <p id="theme-label" className="text-xs text-fg-muted">Тема</p>
        <ul className="divide-y divide-zinc-800">
          {THEME_OPTIONS.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                role="radio"
                aria-checked={mode === o.value}
                onClick={() => choose(o.value)}
                className="flex min-h-11 w-full items-center justify-between py-2 text-left text-sm"
              >
                {o.label}
                {mode === o.value && <Check className="size-5 text-accent-fg" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
