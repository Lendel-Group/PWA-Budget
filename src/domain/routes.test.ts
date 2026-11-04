import { describe, expect, it } from 'vitest'
import { isPlansRoute, parseRoute, PLANS_ROUTES, ROUTES, screenOf } from './routes'

describe('parseRoute', () => {
  it('разбирает хэш с «#/» и без слэша', () => {
    expect(parseRoute('#/budget')).toBe('budget')
    expect(parseRoute('#budget')).toBe('budget')
    expect(parseRoute('#/transactions')).toBe('transactions')
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

describe('screenOf / isPlansRoute', () => {
  it('три подраздела — один экран «plans», остальные маршруты — свои экраны', () => {
    for (const r of PLANS_ROUTES) {
      expect(isPlansRoute(r)).toBe(true)
      expect(screenOf(r)).toBe('plans')
    }
    for (const r of ROUTES.filter((x) => !isPlansRoute(x))) {
      expect(isPlansRoute(r)).toBe(false)
      expect(screenOf(r)).toBe(r)
    }
  })
})
