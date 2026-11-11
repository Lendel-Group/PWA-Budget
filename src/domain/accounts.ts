import type { Account } from '../db/schema'
import { MAX_AMOUNT, TOO_LARGE_AMOUNT } from './finance'

export interface AccountInput {
  name: string
  type: Account['type']
  currency: Account['currency']
  initialBalance: number
}

export type AccountField = 'name' | 'initialBalance'

/** Ошибки по полям формы счёта (нет ключа — поле в порядке). */
export function accountFieldErrors(a: AccountInput): Partial<Record<AccountField, string>> {
  const errors: Partial<Record<AccountField, string>> = {}
  if (!a.name.trim()) errors.name = 'Укажите название счёта'
  if (!Number.isFinite(a.initialBalance)) errors.initialBalance = 'Начальный остаток должен быть числом'
  else if (Math.abs(a.initialBalance) > MAX_AMOUNT) errors.initialBalance = TOO_LARGE_AMOUNT
  return errors
}

/** Первая ошибка или undefined. */
export function validateAccountInput(a: AccountInput): string | undefined {
  return Object.values(accountFieldErrors(a))[0]
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
