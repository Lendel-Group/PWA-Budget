import { db, type Category } from '../db/schema'
import { validateCategoryInput, type CategoryInput } from '../domain/categories'

/** Добавляет пользовательскую категорию в конец списка своего типа. Возвращает id. */
export async function createCategory(input: CategoryInput): Promise<string> {
  return db.transaction('rw', db.categories, async () => {
    const all = await db.categories.toArray()
    const error = validateCategoryInput(input, all)
    if (error) throw new Error(error)
    const category: Category = {
      id: `cat-${crypto.randomUUID()}`,
      name: input.name.trim(),
      type: input.type,
      icon: input.icon,
      color: input.color,
      isDefault: false,
      order: Math.max(0, ...all.map((c) => c.order ?? 0)) + 1,
      // Флаг есть только у расходных и только когда включён: нет поля = false
      ...(input.type === 'expense' && input.isExcludedFromNoSpend ? { isExcludedFromNoSpend: true } : {}),
    }
    await db.categories.add(category)
    return category.id
  })
}

/** Переименование, иконка, цвет и флаг «не нарушает дни без трат». Тип менять нельзя: операции привязаны к нему. */
export async function updateCategory(id: string, patch: Pick<CategoryInput, 'name' | 'icon' | 'color' | 'isExcludedFromNoSpend'>): Promise<void> {
  await db.transaction('rw', db.categories, async () => {
    const category = await db.categories.get(id)
    if (!category) throw new Error('Категория не найдена')
    const error = validateCategoryInput({ ...patch, type: category.type }, await db.categories.toArray(), id)
    if (error) throw new Error(error)
    await db.categories.update(id, {
      name: patch.name.trim(),
      icon: patch.icon,
      color: patch.color,
      // Флаг только у расходных; false записываем явно, чтобы он переопределял значение из сида
      ...(category.type === 'expense' ? { isExcludedFromNoSpend: !!patch.isExcludedFromNoSpend } : {}),
    })
  })
}

/**
 * Скрытие убирает категорию из формы «+», история и лимиты остаются. Последнюю активную категорию
 * типа скрыть нельзя: иначе в форме нечего выбрать, а категория обязательна.
 */
export async function setCategoryArchived(id: string, archived: boolean): Promise<void> {
  await db.transaction('rw', db.categories, async () => {
    const category = await db.categories.get(id)
    if (!category) throw new Error('Категория не найдена')
    if (archived) {
      const active = await db.categories.filter((c) => c.type === category.type && !c.isArchived && c.id !== id).count()
      if (active === 0) throw new Error('Нельзя скрыть последнюю категорию этого типа')
    }
    await db.categories.update(id, { isArchived: archived })
  })
}

/**
 * Удаляет только пользовательскую категорию, на которую нет ни операций, ни лимитов;
 * иначе — ошибка с подсказкой скрыть её.
 */
export async function deleteCategory(id: string): Promise<void> {
  await db.transaction('rw', [db.categories, db.transactions, db.budgetLimits], async () => {
    const category = await db.categories.get(id)
    if (!category) throw new Error('Категория не найдена')
    if (category.isDefault) throw new Error('Стандартную категорию можно только скрыть')
    const used =
      (await db.transactions.where('categoryId').equals(id).count()) +
      (await db.budgetLimits.where('categoryId').equals(id).count())
    if (used > 0) throw new Error('Есть операции или лимиты — скройте категорию вместо удаления')
    await db.categories.delete(id)
  })
}
