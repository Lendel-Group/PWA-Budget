import { useState } from 'react'
import { NoSpendTab } from '../components/challenge/NoSpendTab'
import { DebtsTab } from '../components/debts/DebtsTab'
import { GoalsTab } from '../components/goals/GoalsTab'
import { cn } from '../lib/cn'

const TABS = [
  { id: 'debts', label: 'Долги' },
  { id: 'goals', label: 'Финансовые цели' },
  { id: 'nospend', label: 'Дни без трат' },
] as const
type TabId = (typeof TABS)[number]['id']

export default function GoalsAndDebtsPage() {
  const [tab, setTab] = useState<TabId>('debts')
  return (
    <section className="space-y-4 p-4">
      <div className="flex rounded-xl bg-zinc-900 p-1" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={cn('min-h-11 flex-1 rounded-lg text-xs font-medium', tab === t.id ? 'bg-zinc-700 text-white' : 'text-zinc-400')}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'debts' && <DebtsTab />}
      {tab === 'goals' && <GoalsTab />}
      {tab === 'nospend' && <NoSpendTab />}
    </section>
  )
}
