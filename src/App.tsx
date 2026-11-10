import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { UpdatePrompt } from './components/pwa/UpdatePrompt'
import { AppLayout } from './components/layout/AppLayout'
import { ToastProvider } from './components/ui/Toast'
import { QuickAddModal } from './components/transactions/QuickAddModal'
import type { Transaction } from './db/schema'
import { useHashRoute, type Route } from './lib/useHashRoute'
import AnalyticsPage from './pages/AnalyticsPage'
import BudgetPage from './pages/BudgetPage'
import CategoriesPage from './pages/CategoriesPage'
import DashboardPage from './pages/DashboardPage'
import PlansPage from './pages/PlansPage'
import SettingsPage from './pages/SettingsPage'
import SettingsSubPage from './pages/SettingsSubPage'
import TransactionsPage from './pages/TransactionsPage'
import { WelcomeScreens } from './components/welcome/WelcomeScreens'
import { getWelcomeState } from './services/welcomeService'

function renderPage(route: Route, onNavigate: (r: Route) => void, onEdit: (t: Transaction) => void, onAdd: () => void) {
  switch (route) {
    case 'home': return <DashboardPage onEdit={onEdit} onAdd={onAdd} />
    case 'budget': return <BudgetPage />
    case 'goals':
    case 'debts': return <PlansPage route={route} onNavigate={onNavigate} />
    case 'analytics':
    case 'nospend': return <AnalyticsPage route={route} onNavigate={onNavigate} />
    case 'transactions': return <TransactionsPage onEdit={onEdit} />
    case 'settings': return <SettingsPage onNavigate={onNavigate} />
    case 'categories': return <CategoriesPage onNavigate={onNavigate} />
    case 'accounts':
    case 'rates':
    case 'appearance':
    case 'backup':
    case 'about': return <SettingsSubPage page={route} onNavigate={onNavigate} />
  }
}

export default function App() {
  const [route, navigate] = useHashRoute()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Transaction>()
  const closeForm = () => { setAdding(false); setEditing(undefined) }
  // Обёртка отличает «ещё читается» (undefined) от «ключа нет» ({ state: undefined }): без неё мелькнула бы Главная
  const welcome = useLiveQuery(async () => ({ state: await getWelcomeState() }), [])
  const [welcomeClosed, setWelcomeClosed] = useState(false)
  if (!welcome) return null
  const showWelcome = welcome.state === 'active' && !welcomeClosed
  return (
    <ToastProvider>
      {showWelcome ? (
        // Первый запуск (spec/05): вместо приложения, без нижней панели и баннера обновления
        <WelcomeScreens onDone={() => { setWelcomeClosed(true); navigate('home') }} />
      ) : (
        <>
          <AppLayout route={route} onNavigate={navigate} onAdd={() => setAdding(true)}>
            {renderPage(route, navigate, setEditing, () => setAdding(true))}
          </AppLayout>
          <QuickAddModal open={adding || !!editing} editing={editing} onClose={closeForm} />
          <UpdatePrompt />
        </>
      )}
    </ToastProvider>
  )
}
