import { useState } from 'react'
import { AboutSection } from '../components/settings/AboutSection'
import { AccountsSection } from '../components/settings/AccountsSection'
import { AppearanceSection } from '../components/settings/AppearanceSection'
import { CategoriesSection } from '../components/settings/CategoriesSection'
import { DangerZoneSection } from '../components/settings/DangerZoneSection'
import { DataSafetySection } from '../components/settings/DataSafetySection'
import { RatesSection } from '../components/settings/RatesSection'

export default function SettingsPage() {
  // Растёт, когда данные заменены в «Опасной зоне»: «Сохранность данных» перечитывает статус автобэкапа
  const [dataVersion, setDataVersion] = useState(0)
  return (
    <section className="space-y-4 p-4">
      <AccountsSection />
      <CategoriesSection />
      <RatesSection />
      <AppearanceSection />
      <DataSafetySection refreshKey={dataVersion} />
      <AboutSection />
      <DangerZoneSection onDataReplaced={() => setDataVersion((v) => v + 1)} />
    </section>
  )
}
