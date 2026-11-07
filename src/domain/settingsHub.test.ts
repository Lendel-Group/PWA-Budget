import { describe, expect, it } from 'vitest'
import { aboutSummary, accountsSummary, backupSummary, ratesSummary } from './settingsHub'

describe('сводки «Настроек»', () => {
  it('счета: активные и архивные', () => {
    expect(accountsSummary([{ isArchived: false }, { isArchived: false }])).toBe('Активных: 2')
    expect(accountsSummary([{ isArchived: false }, { isArchived: true }])).toBe('Активных: 1 · В архиве: 1')
    expect(accountsSummary([])).toBe('Активных: 0')
  })

  it('курсы: источник и дата или «Не заданы»', () => {
    expect(ratesSummary()).toBe('Не заданы')
    expect(ratesSummary({ source: 'nbk', date: '2026-11-05' })).toBe('Нацбанк РК · 2026-11-05')
    expect(ratesSummary({ source: 'manual', date: '2026-11-06' })).toBe('Вручную · 2026-11-06')
  })

  it('резервные копии: состояние автобэкапа', () => {
    expect(backupSummary('granted', true)).toBe('Автобэкап включён')
    expect(backupSummary('none', true)).toBe('Автобэкап не настроен')
    expect(backupSummary('prompt', true)).toBe('Автобэкап приостановлен')
    expect(backupSummary('denied', true)).toBe('Автобэкап приостановлен')
    expect(backupSummary('none', false)).toBe('Только вручную')
  })

  it('о приложении', () => {
    expect(aboutSummary('1.27.0')).toBe('Версия 1.27.0')
  })
})
