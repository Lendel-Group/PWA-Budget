import { useCallback, useState } from 'react'
import { invalidFields } from '../domain/forms'

/**
 * Валидация формы «по ходу ввода»: ошибки считаются всегда (кнопка отправки неактивна, пока они есть),
 * а у поля показываются только после того, как пользователь с ним поработал (blur).
 */
export function useFormValidation<K extends string>(errors: Partial<Record<K, string>>) {
  const [touched, setTouched] = useState<ReadonlySet<K>>(() => new Set())
  const touch = useCallback((key: K) => setTouched((prev) => (prev.has(key) ? prev : new Set(prev).add(key))), [])
  const invalid = invalidFields(errors)
  return {
    valid: invalid.length === 0,
    /** Поля с ошибками, в порядке проверок. */
    invalid,
    /** Пропсы для `FormField`: ошибка (после blur) и обработчик blur. */
    field: (key: K) => ({ error: touched.has(key) ? errors[key] : undefined, onBlur: () => touch(key) }),
  }
}
