import { useCallback, useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Download, FileUp, HardDriveDownload, ShieldAlert, ShieldCheck } from 'lucide-react'
import { db } from '../../db/schema'
import { BackupValidationError, parseBackup } from '../../domain/backupValidation'
import {
  downloadBackupFile, getAutoBackupPermission, importDatabaseFromJson, isFileSystemAccessSupported,
  resumeAutoBackup, setupAutoBackupHandle, type AutoBackupPermission,
} from '../../services/backupService'
import { resetApplication } from '../../services/resetService'
import { requestPersistentStorage, type PersistenceStatus } from '../../services/storageService'

const mb = (n?: number) => (n === undefined ? '?' : `${(n / 1024 / 1024).toFixed(1)} МБ`)
const btn = 'flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-zinc-800 text-sm active:bg-zinc-700 disabled:opacity-50'

export function DataSafetySection() {
  const persisted = useLiveQuery(async () => (await db.config.get('storage_persisted'))?.value as boolean | undefined, [])
  const lastBackup = useLiveQuery(async () => (await db.config.get('last_backup_date'))?.value as string | undefined, [])
  const [storage, setStorage] = useState<PersistenceStatus>()
  const [permission, setPermission] = useState<AutoBackupPermission>('none')
  const [message, setMessage] = useState<{ ok: boolean; text: string }>()
  const fileInput = useRef<HTMLInputElement>(null)
  const supported = isFileSystemAccessSupported()

  const refreshPermission = useCallback(() => getAutoBackupPermission().then(setPermission), [])

  useEffect(() => {
    let alive = true
    void navigator.storage?.estimate?.().then((e) => alive && setStorage({ isPersisted: false, quota: e.quota, usage: e.usage }))
    void getAutoBackupPermission().then((p) => alive && setPermission(p))
    return () => { alive = false }
  }, [])

  const ok = (text: string) => setMessage({ ok: true, text })
  const fail = (e: unknown) => setMessage({ ok: false, text: e instanceof Error ? e.message : 'Что-то пошло не так' })

  async function restore(file: File) {
    try {
      const { data } = parseBackup(await file.text())
      const summary = `счетов: ${data.accounts.length}, операций: ${data.transactions.length}, долгов: ${data.debts.length}, целей: ${data.goals.length}`
      if (!window.confirm(`Заменить ВСЕ текущие данные данными из файла (${summary})? Это действие нельзя отменить.`)) return
      await importDatabaseFromJson(await file.text())
      ok(`Данные восстановлены (${summary})`)
    } catch (e) {
      setMessage({ ok: false, text: e instanceof BackupValidationError ? `Файл не подходит: ${e.message}` : 'Не удалось прочитать файл' })
    }
  }

  async function reset() {
    if (!window.confirm('Удалить ВСЕ данные приложения? Рекомендуем сначала скачать резервную копию.')) return
    if (!window.confirm('Точно сбросить приложение? Счета, операции, бюджеты, долги и цели будут удалены.')) return
    try {
      await resetApplication()
      await refreshPermission()
      ok('Приложение сброшено')
    } catch (e) { fail(e) }
  }

  return (
    <section aria-labelledby="safety-h" className="space-y-3 rounded-2xl bg-zinc-900 p-4">
      <h2 id="safety-h" className="font-medium">Сохранность данных</h2>

      <div className="flex items-start gap-3 rounded-xl bg-zinc-800/60 p-3" data-testid="persist-status">
        {persisted ? <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-400" aria-hidden /> : <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-400" aria-hidden />}
        <div className="text-sm">
          <p>{persisted ? 'Хранилище защищено от очистки' : 'Хранилище может быть очищено браузером'}</p>
          <p className="text-xs text-zinc-500">Занято {mb(storage?.usage)} из {mb(storage?.quota)}</p>
          {!persisted && (
            <button type="button" className="mt-1 text-xs text-emerald-400 underline" onClick={async () => { const s = await requestPersistentStorage(); setStorage(s); if (!s.isPersisted) setMessage({ ok: false, text: 'Браузер не дал защиту хранилища. Делайте резервные копии.' }) }}>
              Запросить защиту
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {supported ? (
          <>
            <button type="button" className={btn} onClick={async () => { try { if (await setupAutoBackupHandle()) ok('Автобэкап включён'); await refreshPermission() } catch (e) { fail(e) } }}>
              <HardDriveDownload className="size-4" aria-hidden /> {permission === 'none' ? 'Привязать файл автобэкапа' : 'Выбрать другой файл автобэкапа'}
            </button>
            {permission === 'prompt' && (
              <button type="button" className={btn} onClick={async () => { try { await resumeAutoBackup(); await refreshPermission() } catch (e) { fail(e) } }}>
                Возобновить автобэкап
              </button>
            )}
            <p className="text-xs text-zinc-500" data-testid="autobackup-status">
              {permission === 'none' && 'Автобэкап не настроен.'}
              {permission === 'granted' && 'Автобэкап активен: каждое изменение сохраняется в файл.'}
              {permission === 'prompt' && 'Автобэкап приостановлен — нужно подтвердить доступ к файлу.'}
              {permission === 'denied' && 'Доступ к файлу запрещён — выберите файл заново.'}
              {' '}Последняя копия: {lastBackup ? new Date(lastBackup).toLocaleString('ru-RU') : 'ещё не создавалась'}
            </p>
          </>
        ) : (
          <p className="text-xs text-zinc-500">
            Автобэкап в файл недоступен в этом браузере (например, iOS Safari). Скачивайте резервную копию вручную.
            Последняя копия: {lastBackup ? new Date(lastBackup).toLocaleString('ru-RU') : 'ещё не создавалась'}
          </p>
        )}
        <button type="button" className={btn} onClick={async () => { try { await downloadBackupFile(); ok('Резервная копия скачана') } catch (e) { fail(e) } }}>
          <Download className="size-4" aria-hidden /> Скачать резервную копию JSON
        </button>
        <button type="button" className={btn} onClick={() => fileInput.current?.click()}>
          <FileUp className="size-4" aria-hidden /> Восстановить из файла
        </button>
        <input
          ref={fileInput} type="file" accept="application/json,.json" hidden data-testid="restore-input"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void restore(f) }}
        />
        <button type="button" onClick={reset} className="flex h-11 w-full items-center justify-center rounded-xl bg-red-500/15 text-sm font-medium text-red-400 active:bg-red-500/25">
          Полный сброс приложения
        </button>
      </div>
      {message && <p role="status" className={message.ok ? 'text-xs text-emerald-400' : 'text-xs text-red-400'}>{message.text}</p>}
    </section>
  )
}
