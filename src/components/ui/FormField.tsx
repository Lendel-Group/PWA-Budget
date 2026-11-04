import { useId, type ReactNode } from 'react'
import { primaryButton } from './form'

interface InputA11y {
  'aria-invalid'?: true
  'aria-describedby'?: string
  onBlur: () => void
}

interface FieldProps {
  label: string
  /** Текст ошибки; показывается под полем, связан с ним через `aria-describedby`. */
  error?: string
  onBlur: () => void
  /** Поле получает `aria-invalid`, `aria-describedby` и `onBlur`. */
  children: (a11y: InputA11y) => ReactNode
}

/** Поле формы с подписью и ошибкой у поля (`aria-invalid` + `aria-describedby`, озвучивается через `role="alert"`). */
export function FormField({ label, error, onBlur, children }: FieldProps) {
  const errorId = useId()
  return (
    <div>
      <label className="block text-sm">
        <span className="mb-1 block text-xs text-fg-muted">{label}</span>
        {children({ onBlur, ...(error ? { 'aria-invalid': true as const, 'aria-describedby': errorId } : {}) })}
      </label>
      {error && <p id={errorId} role="alert" className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  )
}

interface SubmitProps {
  children: ReactNode
  onClick: () => void
  /** Названия невалидных обязательных полей: пока они есть, кнопка неактивна и объясняет почему. */
  missing: readonly string[]
  /** Другие причины заблокировать кнопку (идёт сохранение, нет счёта). */
  disabled?: boolean
}

/** Кнопка отправки: неактивна, пока форма невалидна, и подсказывает, какие поля нужно заполнить. */
export function SubmitButton({ children, onClick, missing, disabled }: SubmitProps) {
  const hintId = useId()
  const blocked = missing.length > 0
  return (
    <>
      {blocked && <p id={hintId} className="text-xs text-fg-muted">Проверьте поля: {missing.join(', ')}</p>}
      <button type="button" className={primaryButton} disabled={blocked || disabled} aria-describedby={blocked ? hintId : undefined} onClick={onClick}>
        {children}
      </button>
    </>
  )
}
