import { AboutSection } from '../components/settings/AboutSection'
import { AccountsSection } from '../components/settings/AccountsSection'
import { CategoriesSection } from '../components/settings/CategoriesSection'
import { DataSafetySection } from '../components/settings/DataSafetySection'
import { RatesSection } from '../components/settings/RatesSection'

export default function SettingsPage() {
  return (
    <section className="space-y-4 p-4">
      <AccountsSection />
      <CategoriesSection />
      <RatesSection />
      <DataSafetySection />
      <AboutSection />
    </section>
  )
}
