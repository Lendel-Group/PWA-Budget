import { DebtsTab } from '../components/debts/DebtsTab'
import { GoalsTab } from '../components/goals/GoalsTab'
import { SegmentedControl, TabPanel } from '../components/ui/SegmentedControl'
import type { PlansRoute } from '../domain/routes'
import type { Route } from '../lib/useHashRoute'

const TABS: readonly { value: PlansRoute; label: string }[] = [
  { value: 'goals', label: 'Цели' },
  { value: 'debts', label: 'Долги' },
]

/** «Планы»: цели и долги. Подраздел — это маршрут (`#/goals`, `#/debts`). */
export default function PlansPage({ route, onNavigate }: { route: PlansRoute; onNavigate: (r: Route) => void }) {
  return (
    <section className="space-y-4 p-4">
      <SegmentedControl
        variant="tabs"
        id="plans-tabs"
        label="Раздел планов"
        options={TABS}
        value={route}
        onChange={onNavigate}
        className="p-1"
        itemClassName="text-sm"
      />
      <TabPanel id="plans-tabs" value={route}>
        {route === 'goals' && <GoalsTab />}
        {route === 'debts' && <DebtsTab />}
      </TabPanel>
    </section>
  )
}
