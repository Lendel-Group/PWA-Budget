import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useKeyboardInset } from '../../lib/keyboardInset'

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

/** Поля, для которых нужна экранная клавиатура. */
const TEXT_ENTRY = 'textarea,select,input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit])'

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
 * — при открытии фокус уходит на первое поле (`[data-autofocus]`), иначе на заголовок (`[data-autofocus-fallback]`) или на саму панель;
 * — Tab / Shift+Tab ходят по кругу внутри панели, Esc закрывает;
 * — при закрытии фокус возвращается на элемент, открывший окно;
 * — подложка скрыта от скринридера и не фокусируется: в дереве остаётся одна кнопка «Закрыть» (в содержимом);
 * — при открытой экранной клавиатуре панель поднимается над ней, а её высота ограничивается видимой областью
 *   (переменная `--vvh`; в классах панели — `var(--vvh,100dvh)` вместо `100dvh`), поле в фокусе остаётся на виду.
 */
export function Dialog({ label, onClose, panelClassName, children }: Props) {
  const panel = useRef<HTMLDivElement>(null)
  // onClose у родителей пересоздаётся на каждый рендер; эффект не должен из-за этого перезапускаться
  const closeRef = useRef(onClose)
  // Кто открыл окно (его фокус вернём при закрытии); запоминается один раз и переживает повторный запуск эффекта в StrictMode
  const initiatorRef = useRef<HTMLElement | null>(null)
  useEffect(() => { closeRef.current = onClose })
  const keyboard = useKeyboardInset()

  // Клавиатура открылась или поменяла высоту — возвращаем поле в фокусе в видимую часть панели
  useEffect(() => {
    if (keyboard.inset === 0) return
    const active = document.activeElement
    if (active instanceof HTMLElement && panel.current?.contains(active) && active.matches('input,textarea,select')) {
      requestAnimationFrame(() => active.scrollIntoView({ block: 'nearest' }))
    }
  }, [keyboard.inset, keyboard.visibleHeight])

  /**
   * Пока открыта клавиатура, касание кнопки, флажка или подложки не снимает фокус с поля. Иначе на Android клавиатура
   * прячется уже на касании, окно опускается под пальцем, и Chrome отменяет нажатие: крестик, «Сохранить» или
   * подложка не срабатывают. Нажатие (click) при этом приходит как обычно; клавиатура исчезает, когда окно закроется.
   */
  const keepKeyboard = (e: PointerEvent | MouseEvent) => {
    if (keyboard.inset === 0 || !(e.target instanceof Element)) return
    if (e.target.closest(TEXT_ENTRY)) return // в другое поле фокус переходит как обычно
    if (document.activeElement instanceof Element && document.activeElement.matches(TEXT_ENTRY)) e.preventDefault()
  }

  useEffect(() => {
    const el = panel.current!
    if (document.activeElement instanceof HTMLElement && !el.contains(document.activeElement)) initiatorRef.current = document.activeElement
    const root = document.getElementById('root')
    lockBackground(root)
    // Первое поле формы (`data-autofocus`) важнее заголовка (`data-autofocus-fallback`), иначе — сама панель
    ;(el.querySelector<HTMLElement>('[data-autofocus]') ?? el.querySelector<HTMLElement>('[data-autofocus-fallback]') ?? el).focus({ preventScroll: true })

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
      // Фокус возвращаем, только если окно действительно закрыто: в StrictMode эффект «размонтируется» и тут же
      // запускается снова, и возврат фокуса на кнопку-инициатор считался бы уходом с первого поля формы
      queueMicrotask(() => {
        const initiator = initiatorRef.current
        if (!el.isConnected && initiator?.isConnected) initiator.focus({ preventScroll: true })
      })
    }
  }, [])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={keyboard.inset > 0 ? ({ paddingBottom: keyboard.inset, '--vvh': `${keyboard.visibleHeight}px` } as CSSProperties) : undefined}
      onPointerDown={(e) => keepKeyboard(e.nativeEvent)}
      onMouseDown={(e) => keepKeyboard(e.nativeEvent)}
    >
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
