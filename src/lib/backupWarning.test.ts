import { describe, expect, it } from 'vitest'
import { backupWarning } from './backupWarning'

describe('backupWarning', () => {
  const now = new Date('2026-11-20T12:00:00Z')

  it('копии нет или дата не читается — «ещё не создавалась»', () => {
    expect(backupWarning(undefined, now)).toBe('Резервная копия ещё не создавалась.')
    expect(backupWarning('не дата', now)).toBe('Резервная копия ещё не создавалась.')
  })

  it('до 7 полных суток включительно — без предупреждения', () => {
    expect(backupWarning('2026-11-19T12:00:00Z', now)).toBeUndefined()
    expect(backupWarning('2026-11-12T12:00:01Z', now)).toBeUndefined()
  })

  it('старше — сколько дней назад, со склонением', () => {
    expect(backupWarning('2026-11-12T11:00:00Z', now)).toBe('Последняя резервная копия — 8 дней назад.')
    expect(backupWarning('2026-10-30T12:00:00Z', now)).toBe('Последняя резервная копия — 21 день назад.')
    expect(backupWarning('2026-10-28T12:00:00Z', now)).toBe('Последняя резервная копия — 23 дня назад.')
  })
})
