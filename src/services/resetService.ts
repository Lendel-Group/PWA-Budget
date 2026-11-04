import { db } from '../db/schema'
import { seedIfEmpty } from '../db/seed'
import { cancelPendingAutoBackup } from './backupService'

/**
 * Полный сброс: удаляет все данные и привязку файла автобэкапа (чтобы пустое
 * состояние не перезаписало существующий файл копии), затем заново сеет базу.
 */
export async function resetApplication(): Promise<void> {
  cancelPendingAutoBackup()
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()))
  })
  await seedIfEmpty()
  cancelPendingAutoBackup()
}
