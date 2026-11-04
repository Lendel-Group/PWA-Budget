import Dexie from 'dexie'
import { db, type AppConfig, type ConfigKey } from '../db/schema'
import {
  BACKUP_APP_ID, BACKUP_SCHEMA_VERSION, EXPORTED_CONFIG_KEYS, parseBackup, type BackupFile,
} from '../domain/backupValidation'
import { createDebounced } from '../domain/debounce'
import { toLocalDateString } from '../domain/dates'

export const AUTO_BACKUP_DEBOUNCE_MS = 1500

/* ---------- Минимальные типы File System Access API (нет в lib.dom) ---------- */

type PermissionMode = { mode: 'readwrite' }
export interface BackupFileHandle {
  name: string
  queryPermission(d: PermissionMode): Promise<PermissionState>
  requestPermission(d: PermissionMode): Promise<PermissionState>
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>
}
type SaveFilePicker = (opts: {
  suggestedName?: string
  types?: { description: string; accept: Record<string, string[]> }[]
}) => Promise<BackupFileHandle>

/* ---------- Экспорт / импорт (L3) ---------- */

export async function buildBackup(): Promise<BackupFile> {
  return db.transaction('r', db.tables, async () => {
    const config = (await db.config.toArray()).filter((c) =>
      (EXPORTED_CONFIG_KEYS as readonly string[]).includes(c.key),
    )
    return {
      app: BACKUP_APP_ID,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      data: {
        accounts: await db.accounts.toArray(),
        categories: await db.categories.toArray(),
        budgetLimits: await db.budgetLimits.toArray(),
        transactions: await db.transactions.toArray(),
        debts: await db.debts.toArray(),
        goals: await db.goals.toArray(),
        config,
      },
    }
  })
}

export async function exportDatabaseToJson(): Promise<string> {
  return JSON.stringify(await buildBackup(), null, 2)
}

/** Локальные ключи config, которые импорт не трогает. */
const LOCAL_CONFIG_KEYS: ConfigKey[] = ['auto_backup_handle', 'storage_persisted', 'last_backup_date']

/**
 * Валидирует и атомарно заменяет данные. При невалидном файле бросает
 * BackupValidationError и не меняет БД. Возвращает true при успехе.
 */
export async function importDatabaseFromJson(jsonString: string): Promise<boolean> {
  const { data } = parseBackup(jsonString)
  await db.transaction('rw', db.tables, async () => {
    await Promise.all([
      db.accounts.clear(), db.categories.clear(), db.budgetLimits.clear(),
      db.transactions.clear(), db.debts.clear(), db.goals.clear(),
    ])
    await db.config.where('key').noneOf(LOCAL_CONFIG_KEYS).delete()
    await db.accounts.bulkAdd(data.accounts)
    await db.categories.bulkAdd(data.categories)
    await db.budgetLimits.bulkAdd(data.budgetLimits)
    await db.transactions.bulkAdd(data.transactions)
    await db.debts.bulkAdd(data.debts)
    await db.goals.bulkAdd(data.goals)
    await db.config.bulkPut([...data.config, { key: 'seeded', value: true }])
  })
  return true
}

async function markBackupDone() {
  await db.config.put({ key: 'last_backup_date', value: new Date().toISOString() })
}

export function backupFileName(date = new Date()): string {
  return `budget-backup-${toLocalDateString(date)}.json`
}

/** Скачивание JSON — универсальный fallback (в т.ч. iOS Safari). */
export async function downloadBackupFile(): Promise<void> {
  const json = await exportDatabaseToJson()
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = backupFileName()
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  await markBackupDone()
}

/* ---------- Автобэкап в файл (L2) ---------- */

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && typeof (window as { showSaveFilePicker?: unknown }).showSaveFilePicker === 'function'
}

/** Хранилище handle; подменяется в тестах (мок-объекты не клонируются IndexedDB). */
export interface HandleStore {
  load(): Promise<BackupFileHandle | undefined>
  save(handle: BackupFileHandle): Promise<void>
}
const dbHandleStore: HandleStore = {
  load: async () => (await db.config.get('auto_backup_handle'))?.value as BackupFileHandle | undefined,
  save: async (handle) => {
    await db.config.put({ key: 'auto_backup_handle', value: handle } satisfies AppConfig)
  },
}
let handleStore: HandleStore = dbHandleStore
export function _setHandleStoreForTests(store: HandleStore | null) {
  handleStore = store ?? dbHandleStore
}

export type AutoBackupPermission = 'granted' | 'prompt' | 'denied' | 'none'

export async function getAutoBackupPermission(): Promise<AutoBackupPermission> {
  const handle = await handleStore.load()
  if (!handle) return 'none'
  return handle.queryPermission({ mode: 'readwrite' })
}

async function writeToHandle(handle: BackupFileHandle) {
  const writable = await handle.createWritable()
  try {
    await writable.write(await exportDatabaseToJson())
  } finally {
    await writable.close()
  }
  await markBackupDone()
}

/** Диалог выбора файла + запрос прав + первая запись. false — пользователь отменил. */
export async function setupAutoBackupHandle(): Promise<boolean> {
  if (!isFileSystemAccessSupported()) return false
  let handle: BackupFileHandle
  try {
    handle = await (window as unknown as { showSaveFilePicker: SaveFilePicker }).showSaveFilePicker({
      suggestedName: backupFileName(),
      types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return false
    throw e
  }
  if ((await handle.requestPermission({ mode: 'readwrite' })) !== 'granted') return false
  await handleStore.save(handle)
  await writeToHandle(handle)
  return true
}

/** Вызывать из обработчика клика: после перезапуска браузера права нужно подтвердить жестом. */
export async function resumeAutoBackup(): Promise<boolean> {
  const handle = await handleStore.load()
  if (!handle) return false
  if ((await handle.requestPermission({ mode: 'readwrite' })) !== 'granted') return false
  await writeToHandle(handle)
  return true
}

let writeChain: Promise<void> = Promise.resolve()

/** Немедленная запись в привязанный файл. Без прав — молча пропускает. */
export function flushAutoBackup(): Promise<void> {
  writeChain = writeChain
    .then(async () => {
      const handle = await handleStore.load()
      if (!handle) return
      if ((await handle.queryPermission({ mode: 'readwrite' })) !== 'granted') return
      await writeToHandle(handle)
    })
    .catch((e) => console.warn('[backup] auto-backup failed', e))
  return writeChain
}

const debouncedFlush = createDebounced(() => void flushAutoBackup(), AUTO_BACKUP_DEBOUNCE_MS)

export function triggerDebouncedAutoBackup(): void {
  debouncedFlush()
}

/** Отменяет запланированную запись (нужно при полном сбросе). */
export function cancelPendingAutoBackup(): void {
  debouncedFlush.cancel()
}

let hooksInstalled = false
const watchedTx = new WeakSet<object>()

/** Подписывает автобэкап на любые изменения данных (кроме таблицы config). */
export function installAutoBackupHooks(): void {
  if (hooksInstalled) return
  hooksInstalled = true
  for (const table of db.tables) {
    if (table.name === 'config') continue
    const trigger = () => {
      const tx = Dexie.currentTransaction
      if (!tx) return triggerDebouncedAutoBackup()
      if (watchedTx.has(tx)) return
      watchedTx.add(tx)
      tx.on('complete', triggerDebouncedAutoBackup)
    }
    table.hook('creating', trigger)
    table.hook('updating', trigger)
    table.hook('deleting', trigger)
  }
}
