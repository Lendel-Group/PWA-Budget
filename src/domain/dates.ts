/** Все даты — строки YYYY-MM-DD в локальном часовом поясе. */

const pad = (n: number) => String(n).padStart(2, '0')

export function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseDate(s: string): { year: number; month: number; day: number } {
  const [year, month, day] = s.split('-').map(Number)
  return { year, month, day }
}

export function addDays(date: string, n: number): string {
  const { year, month, day } = parseDate(date)
  const d = new Date(Date.UTC(year, month - 1, day + n))
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** Кол-во дней до конца месяца, включая сегодняшний. */
export function daysLeftInMonth(date: string): number {
  const { year, month, day } = parseDate(date)
  return daysInMonth(year, month) - day + 1
}

/** Ограничивает день платежа длиной месяца (31 → 28/29/30). */
export function clampDueDay(year: number, month: number, day: number): number {
  return Math.min(day, daysInMonth(year, month))
}

export function monthStart(date: string): string {
  const { year, month } = parseDate(date)
  return `${year}-${pad(month)}-01`
}

const MONTHS_SHORT_GEN = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

/** Короткая подпись даты для чипа: «Сегодня», «Вчера» или «12 ноя». */
export function formatDateChip(date: string, today: string): string {
  if (date === today) return 'Сегодня'
  if (date === addDays(today, -1)) return 'Вчера'
  const { day, month } = parseDate(date)
  return `${day} ${MONTHS_SHORT_GEN[month - 1]}`
}
