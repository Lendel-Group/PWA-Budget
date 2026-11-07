import { useEffect, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeftRight, ChevronRight, HardDriveDownload, Info, Palette, Tags, Wallet, type LucideIcon } from 'lucide-react'
import { ResetRow } from '../components/settings/ResetRestore'
import { db } from '../db/schema'
import { categoriesSummary } from '../domain/categories'
import type { Route, SettingsPageRoute } from '../domain/routes'
import { aboutSummary, accountsSummary, backupSummary, ratesSummary } from '../domain/settingsHub'
import { APP_INFO } from '../lib/appInfo'
import { THEME_OPTIONS, readThemeMode } from '../lib/theme'
import { useRates } from '../lib/useRates'
import { getAutoBackupPermission, isFileSystemAccessSupported, type AutoBackupPermission } from '../services/backupService'

/** Группа строк: подпись мелким серым над карточкой (spec/05). */
function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section aria-label={title}>
      {title && <h2 className="mb-2 px-1 text-xs font-medium text-fg-muted">{title}</h2>}
      <ul className="divide-y divide-zinc-800 rounded-2xl bg-zinc-900 px-4">{children}</ul>
    </section>
  )
}

/** Строка: значок в круге, название, серая сводка, стрелка — открывает экран «Настроек». */
function Row({ icon: Icon, title, summary, onOpen }: { icon: LucideIcon; title: string; summary?: string; onOpen: () => void }) {
  return (
    <li>
      <button type="button" onClick={onOpen} className="flex min-h-16 w-full items-center gap-3 py-2.5 text-left">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent/15 text-accent-fg"><Icon className="size-5" aria-hidden /></span>
        <span className="min-w-0 flex-1">
          <span className="block">{title}</span>
          <span className="block truncate text-xs text-fg-muted">{summary ?? '\u00a0'}</span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-fg-muted" aria-hidden />
      </button>
    </li>
  )
}

/** «Настройки» (spec/05): короткий список строк со сводкой; каждая открывает свой экран. */
export default function SettingsPage({ onNavigate }: { onNavigate: (r: Route) => void }) {
  const accounts = useLiveQuery(() => db.accounts.toArray(), [])
  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const { stored } = useRates()
  const [permission, setPermission] = useState<AutoBackupPermission>()
  useEffect(() => {
    let alive = true
    void getAutoBackupPermission().then((p) => alive && setPermission(p))
    return () => { alive = false }
  }, [])
  const theme = THEME_OPTIONS.find((o) => o.value === readThemeMode())?.label
  const open = (r: SettingsPageRoute) => () => onNavigate(r)

  return (
    <div className="space-y-4 p-4">
      <Group title="Учёт">
        <Row icon={Wallet} title="Счета" summary={accounts && accountsSummary(accounts)} onOpen={open('accounts')} />
        <Row icon={Tags} title="Категории" summary={categories && categoriesSummary(categories)} onOpen={open('categories')} />
        <Row icon={ArrowLeftRight} title="Курсы валют" summary={ratesSummary(stored)} onOpen={open('rates')} />
      </Group>
      <Group title="Приложение">
        <Row icon={Palette} title="Оформление" summary={theme} onOpen={open('appearance')} />
      </Group>
      <Group title="Данные">
        <Row
          icon={HardDriveDownload} title="Резервные копии"
          summary={permission && backupSummary(permission, isFileSystemAccessSupported())} onOpen={open('backup')}
        />
      </Group>
      <Group>
        <Row icon={Info} title="О приложении" summary={aboutSummary(APP_INFO.version)} onOpen={open('about')} />
      </Group>
      <ResetRow onReset={() => void getAutoBackupPermission().then(setPermission)} />
    </div>
  )
}
