import { AboutSection } from '../components/settings/AboutSection'
import { AccountsSection } from '../components/settings/AccountsSection'
import { DataSafetySection } from '../components/settings/DataSafetySection'
import { RatesSection } from '../components/settings/RatesSection'

export default function SettingsPage() {
  return (
    <section className="space-y-4 p-4">
      <AccountsSection />
      <RatesSection />
      <DataSafetySection />
      <AboutSection />
    </section>
  )
}
