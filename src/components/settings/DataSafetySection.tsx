import { useCallback, useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Download, HardDriveDownload, ShieldAlert, ShieldCheck } from 'lucide-react'
import { db } from '../../db/schema'
import {
  downloadBackupFile, getAutoBackupPermission, isFileSystemAccessSupported,
  resumeAutoBackup, setupAutoBackupHandle, type AutoBackupPermission,
} from '../../services/backupService'
import { refreshAutoBackupStatus } from '../../lib/autoBackupStatus'
import { requestPersistentStorage, type PersistenceStatus } from '../../services/storageService'

const mb = (n?: number) => (n === undefined ? '?' : `${(n / 1024 / 1024).toFixed(1)} МБ`)
const btn = 'flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-zinc-800 text-sm active:bg-zinc-700 disabled:opacity-50'

/**
 * «Резервные копии»: автобэкап, скачать копию, защита хранилища (только PWA). `refreshKey` меняется, когда данные
 * заменены (восстановление): статус автобэкапа перечитывается.
 */
export function DataSafetySection({ refreshKey = 0 }: { refreshKey?: number }) {
  const persisted = useLiveQuery(async () => (await db.config.get('storage_persisted'))?.value as boolean | undefined, [])
  const lastBackup = useLiveQuery(async () => (await db.config.get('last_backup_date'))?.value as string | undefined, [])
  const [storage, setStorage] = useState<PersistenceStatus>()
  const [permission, setPermission] = useState<AutoBackupPermission>('none')
  const [message, setMessage] = useState<{ ok: boolean; text: string }>()
  const supported = isFileSystemAccessSupported()

  // Баннер «Автобэкап приостановлен» живёт в шапке: после любого изменения права обновляем и его
  const refreshPermission = useCallback(async () => {
    setPermission(await getAutoBackupPermission())
    await refreshAutoBackupStatus()
  }, [])

  useEffect(() => {
    let alive = true
    void navigator.storage?.estimate?.().then((e) => alive && setStorage({ isPersisted: false, quota: e.quota, usage: e.usage }))
    void getAutoBackupPermission().then((p) => alive && setPermission(p))
    return () => { alive = false }
  }, [refreshKey])

  const ok = (text: string) => setMessage({ ok: true, text })
  const fail = (e: unknown) => setMessage({ ok: false, text: e instanceof Error ? e.message : 'Что-то пошло не так' })

  const lastText = `Последняя копия: ${lastBackup ? new Date(lastBackup).toLocaleString('ru-RU') : 'ещё не создавалась'}`
  return (
    <>
      <section aria-labelledby="auto-h" className="space-y-2 rounded-2xl bg-zinc-900 p-4">
        <h2 id="auto-h" className="font-medium">Автобэкап</h2>
        {supported ? (
          <>
            <p className="text-xs text-fg-muted" data-testid="autobackup-status">
              {permission === 'none' && 'Автобэкап не настроен.'}
              {permission === 'granted' && 'Автобэкап активен: каждое изменение сохраняется в файл.'}
              {permission === 'prompt' && 'Автобэкап приостановлен — нужно подтвердить доступ к файлу.'}
              {permission === 'denied' && 'Доступ к файлу запрещён — выберите файл заново.'}
            </p>
            <button type="button" className={btn} onClick={async () => { try { if (await setupAutoBackupHandle()) ok('Автобэкап включён'); await refreshPermission() } catch (e) { fail(e) } }}>
              <HardDriveDownload className="size-4" aria-hidden /> {permission === 'none' ? 'Привязать файл автобэкапа' : 'Выбрать другой файл автобэкапа'}
            </button>
            {permission === 'prompt' && (
              <button type="button" className={btn} onClick={async () => { try { await resumeAutoBackup(); await refreshPermission() } catch (e) { fail(e) } }}>
                Возобновить автобэкап
              </button>
            )}
          </>
        ) : (
          <p className="text-xs text-fg-muted">
            Автобэкап в файл недоступен в этом браузере (например, iOS Safari). Скачивайте резервную копию вручную.
          </p>
        )}
      </section>

      <section aria-labelledby="manual-h" className="space-y-2 rounded-2xl bg-zinc-900 p-4">
        <h2 id="manual-h" className="font-medium">Вручную</h2>
        <button type="button" className={btn} onClick={async () => { try { await downloadBackupFile(); ok('Резервная копия скачана') } catch (e) { fail(e) } }}>
          <Download className="size-4" aria-hidden /> Скачать резервную копию JSON
        </button>
        <p className="text-xs text-fg-muted" data-testid="last-backup">{lastText}</p>
        {message && <p role="status" className={message.ok ? 'text-xs text-success' : 'text-xs text-danger'}>{message.text}</p>}
      </section>

      <div className="flex items-start gap-3 rounded-2xl bg-zinc-900 p-4" data-testid="persist-status">
        {persisted ? <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden /> : <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />}
        <div className="text-sm">
          <p>{persisted ? 'Хранилище защищено от очистки' : 'Хранилище может быть очищено браузером'}</p>
          <p className="text-xs text-fg-muted">Занято {mb(storage?.usage)} из {mb(storage?.quota)}</p>
          {!persisted && (
            <button type="button" className="-ml-1 mt-0.5 flex min-h-11 items-center px-1 text-xs text-accent-fg underline" onClick={async () => { const s = await requestPersistentStorage(); setStorage(s); if (!s.isPersisted) setMessage({ ok: false, text: 'Браузер не дал защиту хранилища. Делайте резервные копии.' }) }}>
              Запросить защиту
            </button>
          )}
        </div>
      </div>
    </>
  )
}
