import { useState } from 'react'
import { NoSpendTab } from '../components/challenge/NoSpendTab'
import { DebtsTab } from '../components/debts/DebtsTab'
import { GoalsTab } from '../components/goals/GoalsTab'
import { SegmentedControl, TabPanel } from '../components/ui/SegmentedControl'

const TABS = [
  { value: 'debts', label: 'Долги' },
  { value: 'goals', label: 'Финансовые цели' },
  { value: 'nospend', label: 'Дни без трат' },
] as const
type TabId = (typeof TABS)[number]['value']

export default function GoalsAndDebtsPage() {
  const [tab, setTab] = useState<TabId>('debts')
  return (
    <section className="space-y-4 p-4">
      <SegmentedControl
        variant="tabs"
        id="goals-tabs"
        label="Раздел"
        options={TABS}
        value={tab}
        onChange={setTab}
        className="p-1"
        itemClassName="text-xs"
      />
      <TabPanel id="goals-tabs" value={tab}>
        {tab === 'debts' && <DebtsTab />}
        {tab === 'goals' && <GoalsTab />}
        {tab === 'nospend' && <NoSpendTab />}
      </TabPanel>
    </section>
  )
}
