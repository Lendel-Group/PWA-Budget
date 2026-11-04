import { db } from '../db/schema'

export interface PersistenceStatus {
  isPersisted: boolean
  quota?: number
  usage?: number
}

/** Запрашивает persistent storage (L1) и сохраняет статус в config. */
export async function requestPersistentStorage(): Promise<PersistenceStatus> {
  const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined
  if (!storage?.persist) return { isPersisted: false }

  let isPersisted = (await storage.persisted?.()) ?? false
  if (!isPersisted) isPersisted = await storage.persist()

  const estimate = await storage.estimate?.()
  const status: PersistenceStatus = {
    isPersisted,
    quota: estimate?.quota,
    usage: estimate?.usage,
  }
  await db.config.put({ key: 'storage_persisted', value: isPersisted })
  console.info(
    `[storage] persisted=${isPersisted} usage=${status.usage ?? '?'} quota=${status.quota ?? '?'}`,
  )
  return status
}
