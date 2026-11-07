import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { AboutSection } from '../components/settings/AboutSection'
import { AccountsSection } from '../components/settings/AccountsSection'
import { AppearanceSection } from '../components/settings/AppearanceSection'
import { DataSafetySection } from '../components/settings/DataSafetySection'
import { RatesSection } from '../components/settings/RatesSection'
import { RestoreSection } from '../components/settings/ResetRestore'
import type { Route } from '../domain/routes'

export type SubPage = 'accounts' | 'rates' | 'appearance' | 'backup' | 'about'

/** «Резервные копии»: после восстановления статус автобэкапа перечитывается. */
function BackupPage() {
  const [dataVersion, setDataVersion] = useState(0)
  return (
    <>
      <DataSafetySection refreshKey={dataVersion} />
      <RestoreSection onDataReplaced={() => setDataVersion((v) => v + 1)} />
    </>
  )
}

/** Экран «Настроек» (spec/05): «‹ Настройки» — назад, ниже содержимое раздела. */
export default function SettingsSubPage({ page, onNavigate }: { page: SubPage; onNavigate: (r: Route) => void }) {
  return (
    <section className="space-y-4 p-4">
      <button type="button" onClick={() => onNavigate('settings')} className="-ml-2 flex min-h-11 items-center gap-1 px-2 text-sm text-fg-muted">
        <ChevronLeft className="size-4" aria-hidden /> Настройки
      </button>
      {page === 'accounts' && <AccountsSection />}
      {page === 'rates' && <RatesSection />}
      {page === 'appearance' && <AppearanceSection />}
      {page === 'backup' && <BackupPage />}
      {page === 'about' && <AboutSection />}
    </section>
  )
}
