export interface Debounced {
  (): void
  /** Отменяет ожидающий вызов. */
  cancel: () => void
  /** true, если вызов ожидает выполнения. */
  pending: () => boolean
}

export function createDebounced(fn: () => void, ms: number): Debounced {
  let timer: ReturnType<typeof setTimeout> | undefined
  const debounced = (() => {
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      fn()
    }, ms)
  }) as Debounced
  debounced.cancel = () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
  }
  debounced.pending = () => timer !== undefined
  return debounced
}
