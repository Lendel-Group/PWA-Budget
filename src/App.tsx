import { useState } from 'react'
import { UpdatePrompt } from './components/pwa/UpdatePrompt'
import { AppLayout } from './components/layout/AppLayout'
import { ToastProvider } from './components/ui/Toast'
import { QuickAddModal } from './components/transactions/QuickAddModal'
import type { Transaction } from './db/schema'
import { useHashRoute, type Route } from './lib/useHashRoute'
import AnalyticsPage from './pages/AnalyticsPage'
import BudgetPage from './pages/BudgetPage'
import DashboardPage from './pages/DashboardPage'
import PlansPage from './pages/PlansPage'
import SettingsPage from './pages/SettingsPage'
import TransactionsPage from './pages/TransactionsPage'

function renderPage(route: Route, onNavigate: (r: Route) => void, onEdit: (t: Transaction) => void, onAdd: () => void) {
  switch (route) {
    case 'home': return <DashboardPage onEdit={onEdit} onAdd={onAdd} />
    case 'budget': return <BudgetPage />
    case 'goals':
    case 'debts':
    case 'nospend': return <PlansPage route={route} onNavigate={onNavigate} />
    case 'analytics': return <AnalyticsPage />
    case 'transactions': return <TransactionsPage onEdit={onEdit} />
    case 'settings': return <SettingsPage />
  }
}

export default function App() {
  const [route, navigate] = useHashRoute()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Transaction>()
  const closeForm = () => { setAdding(false); setEditing(undefined) }
  return (
    <ToastProvider>
      <AppLayout route={route} onNavigate={navigate} onAdd={() => setAdding(true)}>
        {renderPage(route, navigate, setEditing, () => setAdding(true))}
      </AppLayout>
      <QuickAddModal open={adding || !!editing} editing={editing} onClose={closeForm} />
      <UpdatePrompt />
    </ToastProvider>
  )
}
