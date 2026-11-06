import { useState } from 'react'
import { AboutSection } from '../components/settings/AboutSection'
import { AccountsSection } from '../components/settings/AccountsSection'
import { AppearanceSection } from '../components/settings/AppearanceSection'
import { CategoriesRow } from '../components/settings/CategoriesSection'
import { DangerZoneSection } from '../components/settings/DangerZoneSection'
import { DataSafetySection } from '../components/settings/DataSafetySection'
import { RatesSection } from '../components/settings/RatesSection'
import type { Route } from '../domain/routes'

export default function SettingsPage({ onNavigate }: { onNavigate: (r: Route) => void }) {
  // Растёт, когда данные заменены в «Опасной зоне»: «Сохранность данных» перечитывает статус автобэкапа
  const [dataVersion, setDataVersion] = useState(0)
  return (
    <section className="space-y-4 p-4">
      <AccountsSection />
      <CategoriesRow onOpen={() => onNavigate('categories')} />
      <RatesSection />
      <AppearanceSection />
      <DataSafetySection refreshKey={dataVersion} />
      <AboutSection />
      <DangerZoneSection onDataReplaced={() => setDataVersion((v) => v + 1)} />
    </section>
  )
}
