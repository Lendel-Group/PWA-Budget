import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

/** Простой bottom-sheet для форм: Esc и тап по подложке закрывают. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Закрыть" className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative max-h-[calc(100dvh-env(safe-area-inset-top)-0.5rem)] w-full max-w-md space-y-3 overflow-y-auto rounded-t-3xl bg-zinc-950 p-4 pb-[max(1rem,var(--safe-bottom))]">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" aria-label="Закрыть" onClick={onClose} className="grid size-11 place-items-center rounded-xl bg-zinc-900">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs text-fg-muted">{label}</span>
      {children}
    </label>
  )
}
