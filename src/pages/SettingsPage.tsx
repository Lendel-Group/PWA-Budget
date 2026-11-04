import { AccountsSection } from '../components/settings/AccountsSection'
import { DataSafetySection } from '../components/settings/DataSafetySection'
import { RatesSection } from '../components/settings/RatesSection'

export default function SettingsPage() {
  return (
    <section className="space-y-4 p-4">
      <h1 className="text-xl font-semibold">Настройки</h1>
      <AccountsSection />
      <RatesSection />
      <DataSafetySection />
    </section>
  )
}
