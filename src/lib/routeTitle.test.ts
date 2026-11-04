import { describe, expect, it } from 'vitest'
import { APP_TITLE, documentTitle } from './routeTitle'

describe('documentTitle', () => {
  it('«{Экран} · My Budget 2026»', () => {
    expect(APP_TITLE).toBe('My Budget 2026')
    expect(documentTitle('Операции')).toBe('Операции · My Budget 2026')
    expect(documentTitle('Мой бюджет')).toBe('Мой бюджет · My Budget 2026')
  })
})
