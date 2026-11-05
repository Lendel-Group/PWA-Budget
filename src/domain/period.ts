export interface Month { year: number; month: number }

const index = (m: Month): number => m.year * 12 + m.month - 1

export function addMonths(m: Month, n: number): Month {
  const i = index(m) + n
  return { year: Math.floor(i / 12), month: (i % 12) + 1 }
}

export const sameMonth = (a: Month, b: Month): boolean => a.year === b.year && a.month === b.month

/** Месяц самой ранней даты «ГГГГ-ММ-ДД» из списка; null, если дат нет. */
export function earliestMonth(dates: (string | undefined)[]): Month | null {
  let best: Month | null = null
  for (const d of dates) {
    if (!d) continue
    const m = { year: Number(d.slice(0, 4)), month: Number(d.slice(5, 7)) }
    if (!best || index(m) < index(best)) best = m
  }
  return best
}

/**
 * Границы листания по месяцам: назад — до первых данных (но не позже текущего месяца),
 * вперёд — на `ahead` месяцев от текущего.
 */
export function monthBounds(current: Month, earliest: Month | null, ahead: number): { min: Month; max: Month } {
  const min = earliest && index(earliest) < index(current) ? earliest : current
  return { min, max: addMonths(current, ahead) }
}

/** Границы листания по годам: назад — до года первых данных, вперёд — текущий год. */
export function yearBounds(currentYear: number, earliest: Month | null): { min: number; max: number } {
  return { min: earliest ? Math.min(earliest.year, currentYear) : currentYear, max: currentYear }
}

/** Можно ли сделать шаг на `dir` (−1/+1) от месяца `m` внутри границ. */
export function canStepMonth(m: Month, dir: -1 | 1, bounds: { min: Month; max: Month }): boolean {
  const i = index(m) + dir
  return i >= index(bounds.min) && i <= index(bounds.max)
}
