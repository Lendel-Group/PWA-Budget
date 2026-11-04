import { useState } from 'react'
import type { Transaction } from '../db/schema'
import { deleteTransaction } from '../services/transactionService'

/** Удаление операции с подтверждением; общий для главной и экрана «Операции». */
export function useDeleteTransaction(): { remove: (t: Transaction) => Promise<void>; error?: string } {
  const [error, setError] = useState<string>()
  async function remove(t: Transaction) {
    if (!window.confirm('Удалить операцию? Баланс счёта будет пересчитан.')) return
    setError(undefined)
    try {
      await deleteTransaction(t.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось удалить')
    }
  }
  return { remove, error }
}
