/**
 * Клавиатура для групп с одним активным элементом (radiogroup, tablist): новый индекс по нажатой клавише
 * или `undefined`, если клавиша не навигационная. Стрелки идут по кругу, Home и End — к краям.
 */
export function stepIndex(index: number, key: string, length: number): number | undefined {
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (index + 1) % length
    case 'ArrowLeft':
    case 'ArrowUp':
      return (index + length - 1) % length
    case 'Home':
      return 0
    case 'End':
      return length - 1
    default:
      return undefined
  }
}

/** Индекс слота под точкой `x` в контейнере `[left, left + width)`; за краями — ближайший слот. */
export function slotAt(x: number, left: number, width: number, count: number): number {
  return Math.min(count - 1, Math.max(0, Math.floor(((x - left) / width) * count)))
}
