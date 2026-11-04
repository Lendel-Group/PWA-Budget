import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db/schema'
import { seedIfEmpty } from '../db/seed'
import { BackupValidationError } from '../domain/backupValidation'
import { addTransaction } from './transactionService'
import {
  _setHandleStoreForTests, backupFileName, downloadBackupFile, exportDatabaseToJson,
  flushAutoBackup, getAutoBackupPermission, importDatabaseFromJson, installAutoBackupHooks,
  isFileSystemAccessSupported, resumeAutoBackup, setupAutoBackupHandle, type BackupFileHandle,
} from './backupService'

const clearAll = () => Promise.all(db.tables.map((t) => t.clear()))

function mockHandle(permission: PermissionState = 'granted') {
  const writes: string[] = []
  const handle: BackupFileHandle = {
    name: 'b.json',
    queryPermission: vi.fn(async () => permission),
    requestPermission: vi.fn(async () => permission),
    createWritable: vi.fn(async () => ({
      write: async (d: string) => void writes.push(d),
      close: async () => {},
    })),
  }
  return { handle, writes }
}
function useStore(handle?: BackupFileHandle) {
  let current = handle
  _setHandleStoreForTests({ load: async () => current, save: async (h) => void (current = h) })
}

beforeEach(async () => {
  await clearAll()
  await seedIfEmpty()
})
afterEach(() => {
  _setHandleStoreForTests(null)
  vi.unstubAllGlobals()
})

describe('export / import', () => {
  it('round-trips the whole database 1:1', async () => {
    const acc = (await db.accounts.toArray())[0]
    await db.goals.add({ id: 'g', title: 'G', targetAmount: 5, currentAmount: 1, targetDate: '2027-01-01', icon: 'i', color: 'c', isAchieved: false })
    await db.budgetLimits.add({ id: '2026-11-cat-food', year: 2026, month: 11, categoryId: 'cat-food', plannedAmount: 1000.5 })
    await db.config.put({ key: 'fx_rates', value: { USD: 500 } })
    await addTransaction({ date: '2026-11-04', type: 'income', accountId: acc.id, amount: 1234.56, isExcludedFromNoSpend: false, categoryId: 'cat-salary', comment: 'зарплата' })
    const before = await exportDatabaseToJson()
    const snapshot = JSON.parse(before).data

    await clearAll()
    expect(await importDatabaseFromJson(before)).toBe(true)

    expect(JSON.parse(await exportDatabaseToJson()).data).toEqual(snapshot)
    expect((await db.config.get('seeded'))?.value).toBe(true)
  })

  it('пользовательские и скрытые категории входят в бэкап и возвращаются при импорте', async () => {
    await db.categories.bulkAdd([
      { id: 'cat-user', name: 'Спорт', type: 'expense', icon: 'Dumbbell', color: '#3b82f6', isDefault: false, order: 2 },
      { id: 'cat-hidden', name: 'Старая', type: 'income', icon: 'Gift', color: '#ec4899', isDefault: false, isArchived: true, order: 3 },
    ])
    const json = await exportDatabaseToJson()
    await clearAll()
    await importDatabaseFromJson(json)
    expect(await db.categories.get('cat-user')).toMatchObject({ name: 'Спорт', icon: 'Dumbbell', isDefault: false, order: 2 })
    expect(await db.categories.get('cat-hidden')).toMatchObject({ isArchived: true, order: 3 })
  })

  it('does not export local config (handle, persisted)', async () => {
    await db.config.bulkPut([
      { key: 'auto_backup_handle', value: 'h' }, { key: 'storage_persisted', value: true },
      { key: 'last_account_id', value: 'acc-1' }, { key: 'fx_rates', value: {} },
    ])
    const keys = JSON.parse(await exportDatabaseToJson()).data.config.map((c: { key: string }) => c.key)
    expect(keys).toEqual(['fx_rates'])
  })

  it('импорт сбрасывает запомненный счёт: id счетов из файла другие', async () => {
    await db.config.put({ key: 'last_account_id', value: 'old-account' })
    await importDatabaseFromJson(await exportDatabaseToJson())
    expect(await db.config.get('last_account_id')).toBeUndefined()
  })

  it('import keeps local config and leaves DB intact on invalid input', async () => {
    await db.config.put({ key: 'auto_backup_handle', value: 'h' })
    const json = await exportDatabaseToJson()
    await expect(importDatabaseFromJson('{"bad":1}')).rejects.toBeInstanceOf(BackupValidationError)
    expect(await db.categories.count()).toBeGreaterThan(0)
    await importDatabaseFromJson(json)
    expect((await db.config.get('auto_backup_handle'))?.value).toBe('h')
  })

  it('download creates a dated file and records the date', async () => {
    const click = vi.fn()
    const a = { href: '', download: '', click, remove: vi.fn() }
    vi.stubGlobal('document', { createElement: () => a, body: { appendChild: vi.fn() } })
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    await downloadBackupFile()
    expect(a.download).toMatch(/^budget-backup-\d{4}-\d{2}-\d{2}\.json$/)
    expect(click).toHaveBeenCalled()
    expect(await db.config.get('last_backup_date')).toBeTruthy()
    expect(backupFileName(new Date(2026, 0, 5))).toBe('budget-backup-2026-01-05.json')
  })
})

describe('auto-backup (File System Access)', () => {
  it('detects support', () => {
    vi.stubGlobal('window', {})
    expect(isFileSystemAccessSupported()).toBe(false)
    vi.stubGlobal('window', { showSaveFilePicker: () => {} })
    expect(isFileSystemAccessSupported()).toBe(true)
  })

  it('setup: picks file, stores handle, writes initial dump', async () => {
    const { handle, writes } = mockHandle()
    useStore()
    vi.stubGlobal('window', { showSaveFilePicker: vi.fn(async () => handle) })
    expect(await setupAutoBackupHandle()).toBe(true)
    expect(writes).toHaveLength(1)
    expect(JSON.parse(writes[0]).app).toBe('pwa-budget')
    expect(await getAutoBackupPermission()).toBe('granted')
  })

  it('setup: unsupported, cancelled, denied, and picker errors', async () => {
    useStore()
    vi.stubGlobal('window', {})
    expect(await setupAutoBackupHandle()).toBe(false)
    vi.stubGlobal('window', { showSaveFilePicker: async () => { throw new DOMException('x', 'AbortError') } })
    expect(await setupAutoBackupHandle()).toBe(false)
    vi.stubGlobal('window', { showSaveFilePicker: async () => { throw new Error('boom') } })
    await expect(setupAutoBackupHandle()).rejects.toThrow('boom')
    vi.stubGlobal('window', { showSaveFilePicker: async () => mockHandle('denied').handle })
    expect(await setupAutoBackupHandle()).toBe(false)
  })

  it('flush writes only with granted permission', async () => {
    const granted = mockHandle('granted')
    useStore(granted.handle)
    await flushAutoBackup()
    expect(granted.writes).toHaveLength(1)

    const prompt = mockHandle('prompt')
    useStore(prompt.handle)
    expect(await getAutoBackupPermission()).toBe('prompt')
    await flushAutoBackup()
    expect(prompt.writes).toHaveLength(0)

    useStore()
    expect(await getAutoBackupPermission()).toBe('none')
    await flushAutoBackup()
  })

  it('flush swallows write errors', async () => {
    const { handle } = mockHandle()
    handle.createWritable = vi.fn(async () => { throw new Error('disk') })
    useStore(handle)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(flushAutoBackup()).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('resume requests permission on user gesture and writes', async () => {
    useStore()
    expect(await resumeAutoBackup()).toBe(false)
    const denied = mockHandle('denied')
    useStore(denied.handle)
    expect(await resumeAutoBackup()).toBe(false)
    const ok = mockHandle('granted')
    useStore(ok.handle)
    expect(await resumeAutoBackup()).toBe(true)
    expect(ok.writes).toHaveLength(1)
  })

  it('a new transaction triggers a debounced write to the file', async () => {
    const { handle, writes } = mockHandle()
    useStore(handle)
    installAutoBackupHooks()
    installAutoBackupHooks() // idempotent
    const acc = (await db.accounts.toArray())[0]
    await addTransaction({ date: '2026-11-04', type: 'income', accountId: acc.id, amount: 10, isExcludedFromNoSpend: false, categoryId: 'cat-salary' })
    await addTransaction({ date: '2026-11-04', type: 'income', accountId: acc.id, amount: 20, isExcludedFromNoSpend: false, categoryId: 'cat-salary' })
    await vi.waitFor(() => expect(writes.length).toBe(1), { timeout: 4000 })
    const dump = JSON.parse(writes[0])
    expect(dump.data.transactions).toHaveLength(2)
  })
})
