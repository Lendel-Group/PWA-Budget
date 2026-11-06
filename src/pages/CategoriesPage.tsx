import { ChevronLeft } from 'lucide-react'
import { CategoriesScreen } from '../components/settings/CategoriesSection'
import type { Route } from '../domain/routes'

/** «Категории» (spec/05): открывается из «Настроек», «Назад» — в «Настройки». */
export default function CategoriesPage({ onNavigate }: { onNavigate: (r: Route) => void }) {
  return (
    <section className="space-y-4 p-4">
      <button type="button" onClick={() => onNavigate('settings')} className="-ml-2 flex min-h-11 items-center gap-1 px-2 text-sm text-fg-muted">
        <ChevronLeft className="size-4" aria-hidden /> Настройки
      </button>
      <CategoriesScreen />
    </section>
  )
}
