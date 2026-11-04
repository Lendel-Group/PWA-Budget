import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AppLayout } from './components/layout/AppLayout'
import { QuickAddModal } from './components/transactions/QuickAddModal'
import { RecentTransactions } from './components/transactions/RecentTransactions'
import { db } from './db/schema'
import { calculateNetWorth } from './domain/finance'
import { formatMoney } from './lib/format'
import { useHashRoute, type Route } from './lib/useHashRoute'
import { PlaceholderPage } from './pages/PlaceholderPage'

const TITLES: Record<Exclude<Route, 'home'>, string> = {
  budget: 'Бюджет',
  analytics: 'Аналитика',
  goals: 'Цели и долги',
  settings: 'Настройки',
}

function HomePreview() {
  const accounts = useLiveQuery(() => db.accounts.toArray(), [])
  return (
    <section className="space-y-4 py-4">
      <div className="px-4">
        <p className="text-sm text-zinc-500">Общий капитал</p>
        <p className="text-3xl font-semibold tabular-nums" data-testid="net-worth">
          {formatMoney(calculateNetWorth(accounts ?? []))}
        </p>
      </div>
      <RecentTransactions />
    </section>
  )
}

export default function App() {
  const [route, navigate] = useHashRoute()
  const [adding, setAdding] = useState(false)
  return (
    <>
      <AppLayout route={route} onNavigate={navigate} onAdd={() => setAdding(true)}>
        {route === 'home' ? <HomePreview /> : <PlaceholderPage title={TITLES[route]} />}
      </AppLayout>
      <QuickAddModal open={adding} onClose={() => setAdding(false)} />
    </>
  )
}
