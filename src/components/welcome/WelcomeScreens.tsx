import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, Pencil, Plus } from 'lucide-react'
import { db, type Account } from '../../db/schema'
import { ACCOUNT_TYPE_LABELS } from '../../domain/accounts'
import { BackupValidationError, describeBackup, parseBackup } from '../../domain/backupValidation'
import { formatMoney } from '../../lib/format'
import { useToast } from '../../lib/toastContext'
import { importDatabaseFromJson } from '../../services/backupService'
import { finishWelcome } from '../../services/welcomeService'
import { AddAccountSheet, InitialBalanceSheet } from '../settings/AccountsSection'
import { Sheet } from '../ui/Sheet'
import { primaryButton } from '../ui/form'

const SECONDARY = 'h-12 w-full rounded-2xl bg-zinc-800 font-medium text-zinc-100 active:bg-zinc-700'
const TEXT_BTN = 'flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm text-fg-muted active:bg-zinc-900'

/** Экраны первого запуска (spec/05, «Первый запуск»): знакомство → остатки счетов → Главная. */
export function WelcomeScreens({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<1 | 2>(1)
  const finish = async () => { await finishWelcome(); onDone() }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-zinc-950 px-4 pt-[env(safe-area-inset-top)] pb-[max(1rem,var(--safe-bottom))] text-zinc-100">
      <header className="grid h-14 grid-cols-[1fr_auto_1fr] items-center">
        <div>
          {step === 2 && <button type="button" className={`${TEXT_BTN} -ml-3`} onClick={() => setStep(1)}><ChevronLeft className="size-4" aria-hidden />Назад</button>}
        </div>
        <span className="text-xs text-fg-muted">Шаг {step} из 2</span>
        <div className="flex justify-end">
          <button type="button" className={`${TEXT_BTN} -mr-3`} onClick={() => void finish()}>Пропустить</button>
        </div>
      </header>
      {step === 1 ? <IntroStep onStart={() => setStep(2)} onRestored={onDone} /> : <BalancesStep onDone={() => void finish()} />}
    </div>
  )
}

function IntroStep({ onStart, onRestored }: { onStart: () => void; onRestored: () => void }) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<{ json: string; summary: string }>()
  const [error, setError] = useState<string>()

  async function pickFile(file: File) {
    setError(undefined)
    try {
      const json = await file.text()
      const { data } = parseBackup(json)
      setPending({ json, summary: describeBackup(data) })
    } catch (e) {
      setError(e instanceof BackupValidationError ? `Файл не подходит: ${e.message}` : 'Не удалось прочитать файл')
    }
  }

  return (
    <main className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col justify-center space-y-4">
        <h1 tabIndex={-1} className="text-3xl font-bold tracking-tight text-zinc-50">MBT: My Budget Tracker</h1>
        <p className="text-zinc-300">Учёт личных финансов: расходы и доходы, бюджет на месяц, долги и цели.</p>
        <p className="text-fg-muted">Все данные хранятся только на этом устройстве — без аккаунта и сервера.</p>
      </div>
      <div className="space-y-3">
        <button type="button" className={primaryButton} onClick={onStart}>Начать</button>
        <button type="button" className={SECONDARY} onClick={() => fileInput.current?.click()}>Восстановить из резервной копии</button>
        <input
          ref={fileInput} type="file" accept="application/json,.json" hidden data-testid="welcome-restore-input"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void pickFile(f) }}
        />
        <p className="text-center text-xs text-fg-muted">Если вы уже вели учёт в MBT на другом устройстве или в браузере.</p>
        {error && <p role="alert" className="text-center text-sm text-danger">{error}</p>}
      </div>
      {pending && <RestoreSheet {...pending} onClose={() => setPending(undefined)} onRestored={onRestored} />}
    </main>
  )
}

/** Восстановление на свежей установке: операций ещё нет, поэтому без слова и без «Сначала скачать копию». */
function RestoreSheet({ json, summary, onClose, onRestored }: { json: string; summary: string; onClose: () => void; onRestored: () => void }) {
  const toast = useToast()
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  async function restore() {
    setBusy(true)
    setError(undefined)
    try {
      await importDatabaseFromJson(json)
      toast(`Данные восстановлены (${summary})`)
      onRestored()
    } catch (e) {
      setError(e instanceof BackupValidationError ? `Файл не подходит: ${e.message}` : 'Не удалось выполнить действие')
      setBusy(false)
    }
  }

  return (
    <Sheet title="Восстановить данные из файла?" onClose={onClose}>
      <p className="text-sm">В файле: {summary}.</p>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button type="button" className={primaryButton} disabled={busy} onClick={() => void restore()}>Восстановить</button>
      <button type="button" className={SECONDARY} onClick={onClose}>Отмена</button>
    </Sheet>
  )
}

function BalancesStep({ onDone }: { onDone: () => void }) {
  const accounts = useLiveQuery(() => db.accounts.toArray(), [])
  const used = useLiveQuery(async () => {
    const ids = new Set<string>()
    await db.transactions.each((t) => { ids.add(t.accountId); if (t.toAccountId) ids.add(t.toAccountId) })
    return ids
  }, [])
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Account>()
  if (!accounts || !used) return null
  const active = accounts.filter((a) => !a.isArchived).sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  return (
    <main className="flex flex-1 flex-col">
      <div className="flex-1 space-y-4 pt-4">
        <h1 tabIndex={-1} className="text-2xl font-bold tracking-tight text-zinc-50">Сколько у вас сейчас денег?</h1>
        <p className="text-zinc-300">Укажите остатки на счетах — с них начнётся учёт.</p>
        <ul className="divide-y divide-zinc-800 rounded-2xl bg-zinc-900 px-4">
          {active.map((a) => {
            const subtitle = `${ACCOUNT_TYPE_LABELS[a.type]} · ${formatMoney(a.currentBalance, a.currency)}`
            if (used.has(a.id)) {
              return (
                <li key={a.id} className="py-3">
                  <p className="truncate text-sm">{a.name}</p>
                  <p className="text-xs text-fg-muted">{subtitle}</p>
                </li>
              )
            }
            return (
              <li key={a.id}>
                <button
                  type="button" aria-label={`Изменить остаток счёта ${a.name}`} onClick={() => setEditing(a)}
                  className="flex min-h-14 w-full items-center justify-between gap-3 py-3 text-left"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{a.name}</span>
                    <span className="block text-xs text-fg-muted">{subtitle}</span>
                  </span>
                  <Pencil className="size-4 shrink-0 text-zinc-300" aria-hidden />
                </button>
              </li>
            )
          })}
        </ul>
        <button type="button" onClick={() => setAdding(true)} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 text-sm text-zinc-300">
          <Plus className="size-4" aria-hidden /> Добавить счёт
        </button>
        <p className="text-xs text-fg-muted">Остаток можно поменять и позже — в «Настройки → Счета», пока по счёту нет операций.</p>
      </div>
      <button type="button" className={`${primaryButton} mt-4`} onClick={onDone}>Готово</button>
      {adding && <AddAccountSheet onClose={() => setAdding(false)} />}
      {editing && <InitialBalanceSheet account={editing} onClose={() => setEditing(undefined)} />}
    </main>
  )
}
