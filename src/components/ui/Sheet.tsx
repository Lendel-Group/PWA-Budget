import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Dialog } from './Dialog'

/** Простой bottom-sheet для форм: Esc и тап по подложке закрывают; фокус и Tab держит `Dialog`. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <Dialog
      label={title}
      onClose={onClose}
      panelClassName="max-h-[calc(100dvh-env(safe-area-inset-top)-0.5rem)] w-full max-w-md space-y-3 overflow-y-auto rounded-t-3xl bg-zinc-950 p-4 pb-[max(1rem,var(--safe-bottom))]"
    >
      <div className="flex items-center justify-between">
        <h2 data-autofocus tabIndex={-1} className="text-lg font-semibold outline-none">{title}</h2>
        <button type="button" aria-label="Закрыть" onClick={onClose} className="grid size-11 place-items-center rounded-xl bg-zinc-900">
          <X className="size-5" aria-hidden />
        </button>
      </div>
      {children}
    </Dialog>
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
