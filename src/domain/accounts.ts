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
