import { describe, expect, it } from 'vitest'
import { slotAt, stepIndex } from './roving'

describe('stepIndex', () => {
  it('стрелки вправо и вниз — вперёд по кругу', () => {
    expect(stepIndex(0, 'ArrowRight', 3)).toBe(1)
    expect(stepIndex(2, 'ArrowRight', 3)).toBe(0)
    expect(stepIndex(1, 'ArrowDown', 3)).toBe(2)
  })
  it('стрелки влево и вверх — назад по кругу', () => {
    expect(stepIndex(1, 'ArrowLeft', 3)).toBe(0)
    expect(stepIndex(0, 'ArrowLeft', 3)).toBe(2)
    expect(stepIndex(2, 'ArrowUp', 3)).toBe(1)
  })
  it('Home и End — к краям', () => {
    expect(stepIndex(1, 'Home', 12)).toBe(0)
    expect(stepIndex(1, 'End', 12)).toBe(11)
  })
  it('остальные клавиши не навигационные', () => {
    expect(stepIndex(1, 'Enter', 3)).toBeUndefined()
    expect(stepIndex(1, 'a', 3)).toBeUndefined()
  })
  it('индекс -1 (ничего не выбрано): вправо — первый, влево — последний', () => {
    expect(stepIndex(-1, 'ArrowRight', 3)).toBe(0)
    expect(stepIndex(-1, 'ArrowLeft', 3)).toBe(1)
  })
})

describe('slotAt', () => {
  it('слот под точкой, 12 слотов по 25 px', () => {
    expect(slotAt(100, 100, 300, 12)).toBe(0)
    expect(slotAt(124, 100, 300, 12)).toBe(0)
    expect(slotAt(125, 100, 300, 12)).toBe(1)
    expect(slotAt(399, 100, 300, 12)).toBe(11)
  })
  it('за краями — ближайший слот', () => {
    expect(slotAt(0, 100, 300, 12)).toBe(0)
    expect(slotAt(1000, 100, 300, 12)).toBe(11)
  })
})
