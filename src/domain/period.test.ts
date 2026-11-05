import { describe, expect, it } from 'vitest'
import { addMonths, canStepMonth, earliestMonth, monthBounds, sameMonth, yearBounds } from './period'

describe('period', () => {
  it('addMonths переходит через границы года', () => {
    expect(addMonths({ year: 2026, month: 11 }, 3)).toEqual({ year: 2027, month: 2 })
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 })
    expect(addMonths({ year: 2026, month: 12 }, 0)).toEqual({ year: 2026, month: 12 })
  })

  it('sameMonth', () => {
    expect(sameMonth({ year: 2026, month: 5 }, { year: 2026, month: 5 })).toBe(true)
    expect(sameMonth({ year: 2026, month: 5 }, { year: 2025, month: 5 })).toBe(false)
    expect(sameMonth({ year: 2026, month: 5 }, { year: 2026, month: 6 })).toBe(false)
  })

  it('earliestMonth берёт минимальный месяц и пропускает пустые значения', () => {
    expect(earliestMonth([])).toBeNull()
    expect(earliestMonth([undefined])).toBeNull()
    expect(earliestMonth(['2026-03-10', undefined, '2025-12-31', '2026-01-01'])).toEqual({ year: 2025, month: 12 })
    expect(earliestMonth(['2025-12-31', '2026-03-10'])).toEqual({ year: 2025, month: 12 })
  })

  it('monthBounds: назад до первых данных, вперёд +N месяцев', () => {
    const cur = { year: 2026, month: 11 }
    expect(monthBounds(cur, { year: 2026, month: 8 }, 12)).toEqual({ min: { year: 2026, month: 8 }, max: { year: 2027, month: 11 } })
    expect(monthBounds(cur, null, 12).min).toEqual(cur)
    // данные «из будущего» не сдвигают нижнюю границу за текущий месяц
    expect(monthBounds(cur, { year: 2027, month: 1 }, 12).min).toEqual(cur)
    expect(monthBounds(cur, cur, 0)).toEqual({ min: cur, max: cur })
  })

  it('yearBounds', () => {
    expect(yearBounds(2026, null)).toEqual({ min: 2026, max: 2026 })
    expect(yearBounds(2026, { year: 2024, month: 5 })).toEqual({ min: 2024, max: 2026 })
    expect(yearBounds(2026, { year: 2030, month: 1 })).toEqual({ min: 2026, max: 2026 })
  })

  it('canStepMonth учитывает обе границы', () => {
    const b = { min: { year: 2026, month: 8 }, max: { year: 2026, month: 12 } }
    expect(canStepMonth({ year: 2026, month: 8 }, -1, b)).toBe(false)
    expect(canStepMonth({ year: 2026, month: 8 }, 1, b)).toBe(true)
    expect(canStepMonth({ year: 2026, month: 12 }, 1, b)).toBe(false)
    expect(canStepMonth({ year: 2026, month: 12 }, -1, b)).toBe(true)
  })
})
