import { createContext, useContext } from 'react'

export interface ToastOptions {
  /** Кнопка действия справа (например, «Отменить»); по нажатию тост закрывается. */
  action?: { label: string; onClick: () => void }
  /** Время показа, мс. По умолчанию 4 с, с кнопкой действия — 5 с. */
  duration?: number
}

export type ShowToast = (message: string, options?: ToastOptions) => void

export const ToastContext = createContext<ShowToast | null>(null)

export function useToast(): ShowToast {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast нужно вызывать внутри ToastProvider')
  return ctx
}
