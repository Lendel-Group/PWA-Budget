import { useState } from 'react'
import { AppLayout } from './components/layout/AppLayout'
import { QuickAddModal } from './components/transactions/QuickAddModal'
import { useHashRoute, type Route } from './lib/useHashRoute'
import DashboardPage from './pages/DashboardPage'
import { PlaceholderPage } from './pages/PlaceholderPage'

const TITLES: Record<Exclude<Route, 'home'>, string> = {
  budget: 'Бюджет',
  analytics: 'Аналитика',
  goals: 'Цели и долги',
  settings: 'Настройки',
}

export default function App() {
  const [route, navigate] = useHashRoute()
  const [adding, setAdding] = useState(false)
  return (
    <>
      <AppLayout route={route} onNavigate={navigate} onAdd={() => setAdding(true)}>
        {route === 'home' ? <DashboardPage /> : <PlaceholderPage title={TITLES[route]} />}
      </AppLayout>
      <QuickAddModal open={adding} onClose={() => setAdding(false)} />
    </>
  )
}
