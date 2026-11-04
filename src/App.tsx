import { useState } from 'react'
import { AppLayout } from './components/layout/AppLayout'
import { QuickAddModal } from './components/transactions/QuickAddModal'
import { useHashRoute, type Route } from './lib/useHashRoute'
import BudgetPage from './pages/BudgetPage'
import DashboardPage from './pages/DashboardPage'
import GoalsAndDebtsPage from './pages/GoalsAndDebtsPage'
import { PlaceholderPage } from './pages/PlaceholderPage'

const TITLES: Record<Exclude<Route, 'home' | 'budget' | 'goals'>, string> = {
  analytics: 'Аналитика',
  settings: 'Настройки',
}

function renderPage(route: Route) {
  switch (route) {
    case 'home': return <DashboardPage />
    case 'budget': return <BudgetPage />
    case 'goals': return <GoalsAndDebtsPage />
    default: return <PlaceholderPage title={TITLES[route]} />
  }
}

export default function App() {
  const [route, navigate] = useHashRoute()
  const [adding, setAdding] = useState(false)
  return (
    <>
      <AppLayout route={route} onNavigate={navigate} onAdd={() => setAdding(true)}>
        {renderPage(route)}
      </AppLayout>
      <QuickAddModal open={adding} onClose={() => setAdding(false)} />
    </>
  )
}
