import { useEffect, useState } from 'react'

export interface ViewportFit {
  /** Сколько пикселей снизу закрыто экранной клавиатурой (0 — клавиатуры нет). */
  inset: number
  /** Высота видимой области, px; `undefined` — клавиатуры нет, годится обычный 100dvh. */
  visibleHeight?: number
}

/**
 * Насколько экранная клавиатура перекрывает низ страницы.
 * На Android (Chrome, установленное приложение) клавиатура уменьшает только видимую область (visual viewport),
 * а не страницу: `position: fixed; bottom: 0` остаётся под клавиатурой. На iOS видимая область ещё и
 * сдвигается вниз (`offsetTop`). Низ видимой области — `offsetTop + height`, всё ниже него закрыто.
 */
export function keyboardInset(layoutHeight: number, viewport?: { height: number; offsetTop: number } | null): ViewportFit {
  if (!viewport) return { inset: 0 }
  const inset = Math.round(layoutHeight - viewport.height - viewport.offsetTop)
  // Мелкие расхождения (дробные пиксели, полоса адреса) — не клавиатура
  return inset >= 40 ? { inset, visibleHeight: Math.round(viewport.height) } : { inset: 0 }
}

/** Следит за экранной клавиатурой через `visualViewport`; без него (старые браузеры) — всегда `{ inset: 0 }`. */
export function useKeyboardInset(): ViewportFit {
  const [fit, setFit] = useState<ViewportFit>(() => keyboardInset(window.innerHeight, window.visualViewport))
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      const next = keyboardInset(window.innerHeight, vv)
      setFit((prev) => (prev.inset === next.inset && prev.visibleHeight === next.visibleHeight ? prev : next))
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])
  return fit
}
