export type NumpadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'backspace'

const MAX_INT_DIGITS = 10
const MAX_DECIMALS = 2

/** Применяет нажатие кнопки Numpad к строке суммы. */
export function applyNumpadKey(current: string, key: NumpadKey): string {
  if (key === 'backspace') return current.slice(0, -1)

  if (key === '.') {
    if (current.includes('.')) return current
    return current === '' ? '0.' : current + '.'
  }

  const [int, dec] = current.split('.')
  if (dec !== undefined) {
    return dec.length >= MAX_DECIMALS ? current : current + key
  }
  if (int === '0') return key === '0' ? current : key
  if (int.length >= MAX_INT_DIGITS) return current
  return current + key
}

/**
 * Ввод суммы в текстовом поле с теми же ограничениями, что у клавиатуры (spec/05, «Сумма зачисления»): запятая → точка,
 * только цифры и одна точка, до 10 цифр в целой части и до 2 после точки. Лишнее нажатие или вставка поле не меняет.
 */
export function applyAmountInput(current: string, raw: string): string {
  const next = raw.replace(/,/g, '.').replace(/[^\d.]/g, '')
  const [int, dec, ...rest] = next.split('.')
  if (rest.length > 0 || int.length > MAX_INT_DIGITS || (dec !== undefined && dec.length > MAX_DECIMALS)) return current
  return next
}

/** '' и '0.' → 0; иначе число. */
export function parseAmount(input: string): number {
  const n = Number(input)
  return Number.isFinite(n) ? n : 0
}

/** Отображаемая строка суммы: пустой ввод показывается как «0». */
export function displayAmount(input: string): string {
  return input === '' ? '0' : input
}
