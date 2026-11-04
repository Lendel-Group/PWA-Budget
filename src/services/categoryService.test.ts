import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, type Category } from '../db/schema'
import { createCategory, deleteCategory, setCategoryArchived, updateCategory } from './categoryService'
import { seedIfEmpty } from '../db/seed'

const cat = (id: string, name: string, type: Category['type'] = 'expense', extra: Partial<Category> = {}): Category => ({
  id, name, type, icon: 'Circle', color: '#22c55e', isDefault: true, ...extra,
})
const input = { name: 'Подарки', type: 'expense' as const, icon: 'Gift', color: '#ec4899' }

beforeEach(async () => {
  await Promise.all([db.categories.clear(), db.transactions.clear(), db.budgetLimits.clear()])
  await db.categories.bulkAdd([cat('e1', 'Продукты'), cat('e2', 'Транспорт'), cat('i1', 'Зарплата', 'income')])
})

describe('createCategory', () => {
  it('создаёт пользовательскую категорию с обрезанным названием, id cat-… и isDefault=false', async () => {
    const id = await createCategory({ ...input, name: '  Подарки ' })
    expect(id).toMatch(/^cat-/)
    expect(await db.categories.get(id)).toMatchObject({ name: 'Подарки', type: 'expense', icon: 'Gift', color: '#ec4899', isDefault: false })
  })

  it('order растёт: каждая новая категория — в конец', async () => {
    const a = await createCategory(input)
    const b = await createCategory({ ...input, name: 'Спорт' })
    expect((await db.categories.get(a))!.order).toBe(1)
    expect((await db.categories.get(b))!.order).toBe(2)
  })

  it('отклоняет пустое и повторяющееся название; такое же в другом типе — можно', async () => {
    await expect(createCategory({ ...input, name: ' ' })).rejects.toThrow(/название/i)
    await expect(createCategory({ ...input, name: 'продукты' })).rejects.toThrow(/уже есть/)
    await expect(createCategory({ ...input, name: 'Зарплата' })).resolves.toMatch(/^cat-/)
    expect(await db.categories.count()).toBe(4)
  })

  it('название скрытой категории тоже занято', async () => {
    await setCategoryArchived('e1', true)
    await expect(createCategory({ ...input, name: 'Продукты' })).rejects.toThrow(/скрытых/)
  })
})

describe('updateCategory', () => {
  it('переименовывает и меняет иконку и цвет, тип остаётся', async () => {
    await updateCategory('e1', { name: ' Еда ', icon: 'Utensils', color: '#3b82f6' })
    expect(await db.categories.get('e1')).toMatchObject({ name: 'Еда', icon: 'Utensils', color: '#3b82f6', type: 'expense', isDefault: true })
  })

  it('можно сохранить своё же название, нельзя чужое', async () => {
    await expect(updateCategory('e1', { name: 'Продукты', icon: 'Gift', color: '#3b82f6' })).resolves.toBeUndefined()
    await expect(updateCategory('e1', { name: 'транспорт', icon: 'Gift', color: '#3b82f6' })).rejects.toThrow(/уже есть/)
    expect((await db.categories.get('e1'))!.name).toBe('Продукты')
  })

  it('неизвестная категория', async () => {
    await expect(updateCategory('zzz', { name: 'X', icon: 'Gift', color: '#3b82f6' })).rejects.toThrow(/не найдена/)
  })
})

describe('setCategoryArchived', () => {
  it('скрывает и возвращает; история и лимиты не затрагиваются', async () => {
    await db.budgetLimits.add({ id: '2026-11-e1', year: 2026, month: 11, categoryId: 'e1', plannedAmount: 100 })
    await setCategoryArchived('e1', true)
    expect((await db.categories.get('e1'))!.isArchived).toBe(true)
    expect(await db.budgetLimits.count()).toBe(1)
    await setCategoryArchived('e1', false)
    expect((await db.categories.get('e1'))!.isArchived).toBe(false)
  })

  it('последнюю активную категорию типа скрыть нельзя, в другом типе — отдельный счёт', async () => {
    await setCategoryArchived('e1', true)
    await expect(setCategoryArchived('e2', true)).rejects.toThrow(/последнюю/)
    await expect(setCategoryArchived('i1', true)).rejects.toThrow(/последнюю/)
    expect((await db.categories.get('e2'))!.isArchived).toBeUndefined()
  })

  it('неизвестная категория', async () => {
    await expect(setCategoryArchived('zzz', true)).rejects.toThrow(/не найдена/)
  })
})

describe('deleteCategory', () => {
  it('удаляет неиспользуемую пользовательскую категорию', async () => {
    const id = await createCategory(input)
    await deleteCategory(id)
    expect(await db.categories.get(id)).toBeUndefined()
  })

  it('стандартную категорию удалить нельзя', async () => {
    await expect(deleteCategory('e1')).rejects.toThrow(/только скрыть/)
    expect(await db.categories.get('e1')).toBeDefined()
  })

  it('с операциями или лимитами — отказ с подсказкой скрыть', async () => {
    const withTx = await createCategory(input)
    const withLimit = await createCategory({ ...input, name: 'Спорт' })
    await db.transactions.add({ id: 't', date: '2026-11-04', timestamp: 1, type: 'expense', accountId: 'a', amount: 1, categoryId: withTx, isExcludedFromNoSpend: false })
    await db.budgetLimits.add({ id: `2026-11-${withLimit}`, year: 2026, month: 11, categoryId: withLimit, plannedAmount: 5 })
    await expect(deleteCategory(withTx)).rejects.toThrow(/скройте/)
    await expect(deleteCategory(withLimit)).rejects.toThrow(/скройте/)
    expect(await db.categories.count()).toBe(5)
  })

  it('неизвестная категория', async () => {
    await expect(deleteCategory('zzz')).rejects.toThrow(/не найдена/)
  })
})

describe('флаг «не нарушает дни без трат»', () => {
  it('по умолчанию у новой категории поля нет (false)', async () => {
    const id = await createCategory(input)
    expect((await db.categories.get(id))!.isExcludedFromNoSpend).toBeUndefined()
  })

  it('создание расходной категории с флагом; для доходной флаг игнорируется', async () => {
    const expense = await createCategory({ ...input, isExcludedFromNoSpend: true })
    const income = await createCategory({ ...input, name: 'Бонус', type: 'income', isExcludedFromNoSpend: true })
    expect((await db.categories.get(expense))!.isExcludedFromNoSpend).toBe(true)
    expect((await db.categories.get(income))!.isExcludedFromNoSpend).toBeUndefined()
  })

  it('обновление включает и выключает флаг (false сохраняется явно), у доходной не появляется', async () => {
    await updateCategory('e1', { name: 'Продукты', icon: 'Gift', color: '#3b82f6', isExcludedFromNoSpend: true })
    expect((await db.categories.get('e1'))!.isExcludedFromNoSpend).toBe(true)
    await updateCategory('e1', { name: 'Продукты', icon: 'Gift', color: '#3b82f6', isExcludedFromNoSpend: false })
    expect((await db.categories.get('e1'))!.isExcludedFromNoSpend).toBe(false)
    await updateCategory('i1', { name: 'Зарплата', icon: 'Gift', color: '#3b82f6', isExcludedFromNoSpend: true })
    expect('isExcludedFromNoSpend' in (await db.categories.get('i1'))!).toBe(false)
  })

  it('обновление без флага снимает его; существующие операции не меняются', async () => {
    await db.categories.update('e1', { isExcludedFromNoSpend: true })
    await db.transactions.add({ id: 't', date: '2026-11-04', timestamp: 1, type: 'expense', accountId: 'a', amount: 1, categoryId: 'e1', isExcludedFromNoSpend: false })
    await updateCategory('e1', { name: 'Продукты', icon: 'Gift', color: '#3b82f6' })
    expect((await db.categories.get('e1'))!.isExcludedFromNoSpend).toBe(false)
    expect((await db.transactions.get('t'))!.isExcludedFromNoSpend).toBe(false)
  })

  it('сид: коммуналка и кредиты не нарушают дни без трат, остальные — нет', async () => {
    await db.categories.clear()
    await db.config.clear()
    await seedIfEmpty()
    const flagged = (await db.categories.toArray()).filter((c) => c.isExcludedFromNoSpend).map((c) => c.id).sort()
    expect(flagged).toEqual(['cat-credit', 'cat-housing'])
  })
})
