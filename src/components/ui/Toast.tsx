import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type ShowToast, type ToastOptions } from '../../lib/toastContext'

interface ToastState extends ToastOptions {
  id: number
  message: string
}

const DEFAULT_MS = 4000
const ACTION_MS = 5000

/** Один тост за раз: новый заменяет предыдущий. Контейнер — `role="status"`, его читают скринридеры. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>()
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const nextId = useRef(0)

  const dismiss = useCallback(() => {
    clearTimeout(timer.current)
    setToast(undefined)
  }, [])

  const show = useCallback<ShowToast>((message, options = {}) => {
    clearTimeout(timer.current)
    setToast({ ...options, id: ++nextId.current, message })
    timer.current = setTimeout(() => setToast(undefined), options.duration ?? (options.action ? ACTION_MS : DEFAULT_MS))
  }, [])

  useEffect(() => () => clearTimeout(timer.current), [])

  const value = useMemo(() => show, [show])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5.75rem+var(--safe-bottom))] z-[60] mx-auto flex max-w-md justify-center px-4"
      >
        {toast && (
          <div
            key={toast.id}
            className="pointer-events-auto flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl border border-zinc-700 bg-zinc-800 py-1 pl-4 pr-1 text-sm text-zinc-100 shadow-xl motion-safe:animate-toast-in"
          >
            <span>{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                onClick={() => { toast.action?.onClick(); dismiss() }}
                className="min-h-11 shrink-0 rounded-xl px-3 font-semibold text-accent-fg active:bg-zinc-700"
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}
