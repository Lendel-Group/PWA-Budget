import { describe, expect, it } from 'vitest'
import { sortByDefaultOrder, sortCategoriesByUsage } from './categories'

const cats = ['a', 'b', 'c', 'd'].map((id) => ({ id }))
const ids = (list: { id: string }[]) => list.map((c) => c.id)
const tx = (categoryId: string | undefined, date: string) => ({ categoryId, date })
const TODAY = '2026-11-04'

describe('sortCategoriesByUsage', () => {
  it('без операций порядок по умолчанию', () => {
    expect(ids(sortCategoriesByUsage(cats, [], TODAY))).toEqual(['a', 'b', 'c', 'd'])
  })

  it('чаще используемые — выше', () => {
    const txs = [tx('c', '2026-11-01'), tx('c', '2026-11-02'), tx('c', '2026-11-03'), tx('b', '2026-11-01')]
    expect(ids(sortCategoriesByUsage(cats, txs, TODAY))).toEqual(['c', 'b', 'a', 'd'])
  })

  it('равная частота и неиспользованные сохраняют порядок по умолчанию', () => {
    const txs = [tx('d', '2026-10-30'), tx('b', '2026-10-30')]
    expect(ids(sortCategoriesByUsage(cats, txs, TODAY))).toEqual(['b', 'd', 'a', 'c'])
  })

  it('учитываются только последние 90 дней: граница включается, раньше — нет', () => {
    // 2026-11-04 − 90 дней = 2026-08-06
    const txs = [tx('d', '2026-08-06'), tx('c', '2026-08-05'), tx('c', '2026-08-01')]
    expect(ids(sortCategoriesByUsage(cats, txs, TODAY))).toEqual(['d', 'a', 'b', 'c'])
  })

  it('окно настраивается', () => {
    const txs = [tx('d', '2026-11-03'), tx('c', '2026-10-01'), tx('c', '2026-10-02')]
    expect(ids(sortCategoriesByUsage(cats, txs, TODAY, 7))).toEqual(['d', 'a', 'b', 'c'])
  })

  it('операции без категории и с неизвестной категорией не мешают, исходный массив не меняется', () => {
    const txs = [tx(undefined, '2026-11-03'), tx('zzz', '2026-11-03'), tx('b', '2026-11-03')]
    const input = [...cats]
    expect(ids(sortCategoriesByUsage(input, txs, TODAY))).toEqual(['b', 'a', 'c', 'd'])
    expect(input).toEqual(cats)
  })
})

describe('sortByDefaultOrder', () => {
  it('порядок как в списке по умолчанию, неизвестные — в конце в исходном порядке', () => {
    const list = ['x', 'c', 'a', 'y', 'b'].map((id) => ({ id }))
    expect(ids(sortByDefaultOrder(list, ['a', 'b', 'c']))).toEqual(['a', 'b', 'c', 'x', 'y'])
  })

  it('пустой список по умолчанию ничего не меняет', () => {
    expect(ids(sortByDefaultOrder(cats, []))).toEqual(['a', 'b', 'c', 'd'])
  })
})
