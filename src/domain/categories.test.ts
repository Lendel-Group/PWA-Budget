import { describe, expect, it } from 'vitest'
import { categoriesOfType, categoriesSummary, CATEGORY_NAME_MAX, categoryFieldErrors, resolveExcludedFromNoSpend, sortByDefaultOrder, sortCategoriesByUsage, validateCategoryInput } from './categories'

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

describe('sortByDefaultOrder: пользовательские категории', () => {
  it('идут после набора по умолчанию по возрастанию order, без order — в исходном порядке', () => {
    const list = [{ id: 'u3', order: 3 }, { id: 'b' }, { id: 'u1', order: 1 }, { id: 'a' }, { id: 'u2', order: 2 }]
    expect(ids(sortByDefaultOrder(list, ['a', 'b']))).toEqual(['a', 'b', 'u1', 'u2', 'u3'])
  })
})

describe('validateCategoryInput', () => {
  const input = { name: 'Подарки', type: 'expense' as const, icon: 'Gift', color: '#22c55e' }
  const existing = [
    { id: 'c1', name: 'Продукты', type: 'expense' as const },
    { id: 'c2', name: 'Старая', type: 'expense' as const, isArchived: true },
    { id: 'c3', name: 'Зарплата', type: 'income' as const },
  ]

  it('допускает корректные данные', () => {
    expect(validateCategoryInput(input, existing)).toBeUndefined()
  })
  it('пустое название и пробелы', () => {
    expect(validateCategoryInput({ ...input, name: '   ' }, existing)).toMatch(/название/i)
  })
  it('слишком длинное название', () => {
    expect(validateCategoryInput({ ...input, name: 'я'.repeat(CATEGORY_NAME_MAX + 1) }, existing)).toMatch(/не длиннее/)
    expect(validateCategoryInput({ ...input, name: 'я'.repeat(CATEGORY_NAME_MAX) }, existing)).toBeUndefined()
  })
  it('иконка и цвет обязательны', () => {
    expect(validateCategoryInput({ ...input, icon: '' }, existing)).toMatch(/иконку/)
    expect(validateCategoryInput({ ...input, color: 'red' }, existing)).toMatch(/цвет/)
    expect(validateCategoryInput({ ...input, color: '#FFAA00' }, existing)).toBeUndefined()
  })
  it('уникальность без учёта регистра и пробелов, в пределах типа', () => {
    expect(validateCategoryInput({ ...input, name: '  продУКТЫ ' }, existing)).toMatch(/уже есть/)
    expect(validateCategoryInput({ ...input, name: 'Зарплата' }, existing)).toBeUndefined() // другой тип
  })
  it('совпадение со скрытой категорией объясняется отдельно', () => {
    expect(validateCategoryInput({ ...input, name: 'старая' }, existing)).toMatch(/скрытых/)
  })
  it('своё же название при редактировании допустимо', () => {
    expect(validateCategoryInput({ ...input, name: 'Продукты' }, existing, 'c1')).toBeUndefined()
    expect(validateCategoryInput({ ...input, name: 'Продукты' }, existing, 'c2')).toMatch(/уже есть/)
  })
})

describe('resolveExcludedFromNoSpend', () => {
  it('без категории и без флага — false', () => {
    expect(resolveExcludedFromNoSpend(undefined)).toBe(false)
    expect(resolveExcludedFromNoSpend({})).toBe(false)
    expect(resolveExcludedFromNoSpend({ isExcludedFromNoSpend: false })).toBe(false)
  })
  it('флаг категории включает исключение автоматически', () => {
    expect(resolveExcludedFromNoSpend({ isExcludedFromNoSpend: true })).toBe(true)
  })
  it('ручной выбор переопределяет категорию в обе стороны', () => {
    expect(resolveExcludedFromNoSpend({ isExcludedFromNoSpend: true }, false)).toBe(false)
    expect(resolveExcludedFromNoSpend({ isExcludedFromNoSpend: false }, true)).toBe(true)
    expect(resolveExcludedFromNoSpend(undefined, true)).toBe(true)
  })
})

describe('categoryFieldErrors', () => {
  const input = { name: 'Подарки', type: 'expense' as const, icon: 'Gift', color: '#22c55e' }
  const existing = [{ id: 'c1', name: 'Продукты', type: 'expense' as const }]
  it('нет ошибок — пустой объект', () => expect(categoryFieldErrors(input, existing)).toEqual({}))
  it('название, иконка и цвет проверяются независимо', () => {
    expect(Object.keys(categoryFieldErrors({ ...input, name: '', icon: '', color: 'red' }, existing))).toEqual(['name', 'icon', 'color'])
    expect(Object.keys(categoryFieldErrors({ ...input, name: 'продукты' }, existing))).toEqual(['name'])
  })
})

describe('экран «Категории» (spec/05)', () => {
  const cats = [
    { id: 'cat-food', type: 'expense' as const },
    { id: 'my-old', type: 'expense' as const, isArchived: true, order: 0 },
    { id: 'my-new', type: 'expense' as const, order: 1 },
    { id: 'cat-salary', type: 'income' as const },
  ]
  const defaults = ['cat-food', 'cat-salary']

  it('строка в «Настройках»: число категорий по типам, вместе со скрытыми', () => {
    expect(categoriesSummary(cats)).toBe('Расходы: 3 · Доходы: 1')
    expect(categoriesSummary([])).toBe('Расходы: 0 · Доходы: 0')
  })

  it('вкладка: один тип, порядок по умолчанию, скрытые в конце', () => {
    expect(categoriesOfType(cats, 'expense', defaults).map((c) => c.id)).toEqual(['cat-food', 'my-new', 'my-old'])
    expect(categoriesOfType(cats, 'income', defaults).map((c) => c.id)).toEqual(['cat-salary'])
  })
})
