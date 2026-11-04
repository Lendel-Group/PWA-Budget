import type { Account } from '../db/schema'

export interface AccountInput {
  name: string
  type: Account['type']
  currency: Account['currency']
  initialBalance: number
}

export function validateAccountInput(a: AccountInput): string | undefined {
  if (!a.name.trim()) return 'Укажите название счёта'
  if (!Number.isFinite(a.initialBalance)) return 'Начальный остаток должен быть числом'
  return undefined
}

export const ACCOUNT_TYPE_LABELS: Record<Account['type'], string> = {
  card: 'Карта', cash: 'Наличные', deposit: 'Депозит',
}

/**
 * Счёт для формы «+»: выбранный пользователем → счёт последней операции (если он не в архиве) →
 * первый активный → первый в списке. В редактировании архивный счёт самой операции найдётся по `selectedId`.
 */
export function pickAccount<A extends Pick<Account, 'id' | 'isArchived'>>(
  accounts: readonly A[],
  selectedId?: string,
  lastUsedId?: string,
): A | undefined {
  return (
    accounts.find((a) => a.id === selectedId) ??
    accounts.find((a) => a.id === lastUsedId && !a.isArchived) ??
    accounts.find((a) => !a.isArchived) ??
    accounts[0]
  )
}
