import { describe, expect, it } from 'vitest'
import { APP_TITLE, documentTitle } from './routeTitle'

describe('documentTitle', () => {
  it('«{Экран} · MBT»', () => {
    expect(APP_TITLE).toBe('MBT')
    expect(documentTitle('Операции')).toBe('Операции · MBT')
    expect(documentTitle('Мой бюджет')).toBe('Мой бюджет · MBT')
  })
})
