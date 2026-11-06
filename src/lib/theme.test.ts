import { describe, expect, it } from 'vitest'
import { THEME_OPTIONS, THEME_SURFACE, parseThemeMode, resolveTheme } from './theme'

describe('theme', () => {
  it('варианты и тексты — spec/05, «Оформление»', () => {
    expect(THEME_OPTIONS.map((o) => o.label)).toEqual(['Как в системе', 'Светлая', 'Тёмная'])
    expect(THEME_OPTIONS.map((o) => o.value)).toEqual(['system', 'light', 'dark'])
  })

  it('нет или неизвестное значение — «Как в системе»', () => {
    expect(parseThemeMode(null)).toBe('system')
    expect(parseThemeMode('sepia')).toBe('system')
    expect(parseThemeMode('light')).toBe('light')
    expect(parseThemeMode('dark')).toBe('dark')
  })

  it('«Как в системе» следует устройству, явный выбор — нет', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('theme-color — surface темы', () => {
    expect(THEME_SURFACE).toEqual({ dark: '#09090b', light: '#f4f4f5' })
  })
})
