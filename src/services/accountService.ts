import { db, type Account } from '../db/schema'
import { validateAccountInput, type AccountInput } from '../domain/accounts'

export async function createAccount(input: AccountInput): Promise<string> {
  const error = validateAccountInput(input)
  if (error) throw new Error(error)
  const account: Account = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    type: input.type,
    currency: input.currency,
    initialBalance: input.initialBalance,
    currentBalance: input.initialBalance,
    isArchived: false,
    createdAt: new Date().toISOString(),
  }
  await db.accounts.add(account)
  return account.id
}

/** Архивация скрывает счёт из ввода и капитала; история операций сохраняется. */
export async function setAccountArchived(id: string, archived: boolean): Promise<void> {
  await db.transaction('rw', db.accounts, async () => {
    const account = await db.accounts.get(id)
    if (!account) throw new Error('Счёт не найден')
    if (archived) {
      const active = await db.accounts.filter((a) => !a.isArchived && a.id !== id).count()
      if (active === 0) throw new Error('Нельзя архивировать последний активный счёт')
    }
    await db.accounts.update(id, { isArchived: archived })
  })
}
