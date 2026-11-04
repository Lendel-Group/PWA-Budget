import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

/** Сколько диалогов сейчас держат приложение недоступным (их может быть больше одного). */
let locks = 0

function lockBackground(root: HTMLElement | null) {
  locks++
  if (root) root.inert = true
  document.body.style.overflow = 'hidden'
}

function unlockBackground(root: HTMLElement | null) {
  if (--locks > 0) return
  if (root) root.inert = false
  document.body.style.overflow = ''
}

interface Props {
  /** Имя диалога для скринридера. */
  label: string
  onClose: () => void
  /** Классы панели (размеры, фон, отступы); позиционирование и фокус-логика уже внутри. */
  panelClassName: string
  children: ReactNode
}

/**
 * Модальное окно для `Sheet` и формы «+»:
 * — выносится в `document.body`, а остальное приложение становится `inert` (недоступно с клавиатуры и скринридера);
 * — при открытии фокус уходит на `[data-autofocus]` внутри (например, заголовок) или на саму панель;
 * — Tab / Shift+Tab ходят по кругу внутри панели, Esc закрывает;
 * — при закрытии фокус возвращается на элемент, открывший окно;
 * — подложка скрыта от скринридера и не фокусируется: в дереве остаётся одна кнопка «Закрыть» (в содержимом).
 */
export function Dialog({ label, onClose, panelClassName, children }: Props) {
  const panel = useRef<HTMLDivElement>(null)
  // onClose у родителей пересоздаётся на каждый рендер; эффект не должен из-за этого перезапускаться
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose })

  useEffect(() => {
    const el = panel.current!
    const initiator = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const root = document.getElementById('root')
    lockBackground(root)
    ;(el.querySelector<HTMLElement>('[data-autofocus]') ?? el).focus({ preventScroll: true })

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((n) => n.getClientRects().length > 0)
      if (items.length === 0) {
        e.preventDefault()
        el.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (!el.contains(active) || (active === el && !e.shiftKey)) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
      } else if (e.shiftKey && (active === first || active === el)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      unlockBackground(root)
      if (initiator?.isConnected) initiator.focus({ preventScroll: true })
    }
  }, [])

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div aria-hidden className="absolute inset-0 bg-black/60" onClick={() => closeRef.current()} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`relative outline-none ${panelClassName}`}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
