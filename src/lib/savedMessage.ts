import type { Currency, Transaction } from '../db/schema'
import { formatMoney } from './format'

const LABELS: Record<Transaction['type'], string> = { expense: 'Расход', income: 'Доход', transfer: 'Перевод' }

/** Текст подтверждения после сохранения операции: «Расход 5 000 ₸ сохранён». */
export function savedMessage(
  tx: { type: Transaction['type']; amount: number },
  currency: Currency,
  edited: boolean,
): string {
  if (edited) return 'Изменения сохранены'
  return `${LABELS[tx.type]} ${formatMoney(tx.amount, currency)} ${tx.type === 'transfer' ? 'выполнен' : 'сохранён'}`
}
