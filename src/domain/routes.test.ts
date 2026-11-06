import { describe, expect, it } from 'vitest'
import { ANALYTICS_ROUTES, defaultRoute, isAnalyticsRoute, isPlansRoute, parseRoute, PLANS_ROUTES, ROUTES, screenOf, type Screen } from './routes'

describe('parseRoute', () => {
  it('разбирает хэш с «#/» и без слэша', () => {
    expect(parseRoute('#/budget')).toBe('budget')
    expect(parseRoute('#budget')).toBe('budget')
    expect(parseRoute('#/transactions')).toBe('transactions')
    expect(parseRoute('#/categories')).toBe('categories')
  })

  it('подразделы «Планов» адресуются своими маршрутами, старый #/goals жив', () => {
    expect(parseRoute('#/goals')).toBe('goals')
    expect(parseRoute('#/debts')).toBe('debts')
    expect(parseRoute('#/nospend')).toBe('nospend')
  })

  it('пустой и неизвестный хэш — главная', () => {
    expect(parseRoute('')).toBe('home')
    expect(parseRoute('#/')).toBe('home')
    expect(parseRoute('#/nope')).toBe('home')
    expect(parseRoute('#/goals/extra')).toBe('home')
  })

  it('каждый маршрут из списка разбирается в себя', () => {
    for (const r of ROUTES) expect(parseRoute(`#/${r}`)).toBe(r)
  })
})

describe('screenOf / isPlansRoute / isAnalyticsRoute', () => {
  it('«Планы» — цели и долги; «Аналитика» — обзор и дни без трат', () => {
    for (const r of PLANS_ROUTES) {
      expect(isPlansRoute(r)).toBe(true)
      expect(isAnalyticsRoute(r)).toBe(false)
      expect(screenOf(r)).toBe('plans')
    }
    for (const r of ANALYTICS_ROUTES) {
      expect(isAnalyticsRoute(r)).toBe(true)
      expect(isPlansRoute(r)).toBe(false)
      expect(screenOf(r)).toBe('analytics')
    }
  })

  it('остальные маршруты — собственные экраны', () => {
    for (const r of ROUTES.filter((x) => !isPlansRoute(x) && !isAnalyticsRoute(x))) expect(screenOf(r)).toBe(r)
  })
})

describe('defaultRoute', () => {
  it('«Планы» открываются на целях, остальные экраны — на своём маршруте', () => {
    expect(defaultRoute('plans')).toBe('goals')
    const screens: Screen[] = ['home', 'budget', 'analytics', 'transactions', 'settings', 'categories']
    for (const s of screens) expect(defaultRoute(s)).toBe(s)
  })
})
