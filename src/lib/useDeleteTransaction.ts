import { useState } from 'react'
import type { Transaction } from '../db/schema'
import { deleteTransaction, restoreTransaction } from '../services/transactionService'
import { useToast } from './toastContext'

/** Удаление операции сразу, без confirm: тост «Операция удалена · Отменить». Общий для главной и «Операций». */
export function useDeleteTransaction(): { remove: (t: Transaction) => Promise<void>; error?: string } {
  const [error, setError] = useState<string>()
  const toast = useToast()

  async function undo(tx: Transaction) {
    try {
      await restoreTransaction(tx)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось восстановить операцию')
    }
  }

  async function remove(t: Transaction) {
    setError(undefined)
    try {
      const deleted = await deleteTransaction(t.id)
      if (deleted) toast('Операция удалена', { action: { label: 'Отменить', onClick: () => void undo(deleted) } })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось удалить')
    }
  }
  return { remove, error }
}
