import { describe, expect, it } from 'vitest'
import {
  addDays, clampDueDay, daysInMonth, daysLeftInMonth, monthStart, parseDate, toLocalDateString,
} from './dates'

describe('dates', () => {
  it('toLocalDateString uses local components and pads', () => {
    expect(toLocalDateString(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
  it('parseDate', () => {
    expect(parseDate('2026-03-09')).toEqual({ year: 2026, month: 3, day: 9 })
  })
  it('addDays crosses month/year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
  })
  it('daysInMonth handles leap years', () => {
    expect(daysInMonth(2024, 2)).toBe(29)
    expect(daysInMonth(2026, 2)).toBe(28)
    expect(daysInMonth(2026, 4)).toBe(30)
  })
  it('daysLeftInMonth includes today', () => {
    expect(daysLeftInMonth('2026-11-04')).toBe(27)
    expect(daysLeftInMonth('2026-11-30')).toBe(1)
  })
  it('clampDueDay', () => {
    expect(clampDueDay(2026, 2, 31)).toBe(28)
    expect(clampDueDay(2026, 3, 15)).toBe(15)
  })
  it('monthStart', () => {
    expect(monthStart('2026-11-04')).toBe('2026-11-01')
  })
})
