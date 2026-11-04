import { useState } from 'react'
import { UpdatePrompt } from './components/pwa/UpdatePrompt'
import { AppLayout } from './components/layout/AppLayout'
import { QuickAddModal } from './components/transactions/QuickAddModal'
import { useHashRoute, type Route } from './lib/useHashRoute'
import AnalyticsPage from './pages/AnalyticsPage'
import BudgetPage from './pages/BudgetPage'
import DashboardPage from './pages/DashboardPage'
import GoalsAndDebtsPage from './pages/GoalsAndDebtsPage'
import SettingsPage from './pages/SettingsPage'

function renderPage(route: Route) {
  switch (route) {
    case 'home': return <DashboardPage />
    case 'budget': return <BudgetPage />
    case 'goals': return <GoalsAndDebtsPage />
    case 'analytics': return <AnalyticsPage />
    case 'settings': return <SettingsPage />
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
      <UpdatePrompt />
    </>
  )
}
