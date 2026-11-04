import { useState } from 'react'
import { Download, ExternalLink, RefreshCw } from 'lucide-react'
import { db } from '../../db/schema'
import { BACKUP_SCHEMA_VERSION } from '../../domain/backupValidation'
import { APP_INFO } from '../../lib/appInfo'
import { isStandalone, promptInstall, useCanInstall } from '../../lib/install'

const formatDate = (iso: string) => (iso ? new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : '—')

export function AboutSection() {
  const [status, setStatus] = useState<string>()
  const [busy, setBusy] = useState(false)
  const canInstall = useCanInstall()

  async function checkUpdates() {
    setBusy(true)
    try {
      const registration = await navigator.serviceWorker?.getRegistration()
      if (!registration) {
        setStatus('Сервис-воркер не активен — обновления проверяются при перезагрузке страницы.')
      } else {
        await registration.update()
        setStatus('Проверка выполнена. Если есть новая версия, появится кнопка «Обновить».')
      }
    } catch {
      setStatus('Не удалось проверить обновления (нет сети?).')
    } finally {
      setBusy(false)
    }
  }

  const rows: [string, string][] = [
    ['Версия', APP_INFO.version],
    ['Дата сборки', formatDate(APP_INFO.buildDate)],
    ['Сборка', APP_INFO.commit],
    ['Режим', isStandalone() ? 'Установленное приложение' : 'В браузере'],
    ['Версия базы данных', String(db.verno)],
    ['Формат резервной копии', String(BACKUP_SCHEMA_VERSION)],
  ]

  return (
    <section aria-labelledby="about-h" className="space-y-3 rounded-2xl bg-zinc-900 p-4">
      <div>
        <h2 id="about-h" className="font-medium">О приложении</h2>
        <p className="text-xs text-zinc-500">{APP_INFO.name} — офлайн-учёт личных финансов</p>
      </div>
      <dl className="divide-y divide-zinc-800 text-sm" data-testid="about">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 py-2">
            <dt className="text-zinc-500">{k}</dt>
            <dd className="text-right tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      {canInstall && (
        <button
          type="button"
          onClick={() => void promptInstall()}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-medium text-zinc-950"
        >
          <Download className="size-4" aria-hidden /> Установить приложение
        </button>
      )}
      <button
        type="button"
        onClick={checkUpdates}
        disabled={busy}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-zinc-800 text-sm active:bg-zinc-700 disabled:opacity-50"
      >
        <RefreshCw className="size-4" aria-hidden /> Проверить обновления
      </button>
      {status && <p role="status" className="text-xs text-zinc-400">{status}</p>}
      <p className="text-xs leading-relaxed text-zinc-500">
        Конфиденциальность: все данные хранятся только на вашем устройстве, аккаунта и сервера нет.
        Единственный внешний запрос — загрузка курсов валют (копия официальных курсов Нацбанка РК на al-writer.github.io/nbk-rates).
      </p>
      <a
        href={APP_INFO.repoUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="flex items-center gap-1.5 text-xs text-emerald-400 underline"
      >
        Исходный код на GitHub <ExternalLink className="size-3" aria-hidden />
      </a>
      <p className="text-xs text-zinc-600">© 2026</p>
    </section>
  )
}
