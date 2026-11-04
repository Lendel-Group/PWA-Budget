import { db, type Account, type Category } from './schema'

const expense = (id: string, name: string, icon: string, color: string): Category => ({
  id, name, type: 'expense', icon, color, isDefault: true,
})
const income = (id: string, name: string, icon: string, color: string): Category => ({
  id, name, type: 'income', icon, color, isDefault: true,
})

export const DEFAULT_CATEGORIES: Category[] = [
  expense('cat-food', 'Продукты', 'ShoppingCart', '#22c55e'),
  expense('cat-cafe', 'Кафе и рестораны', 'Utensils', '#f97316'),
  expense('cat-transport', 'Транспорт', 'Bus', '#3b82f6'),
  expense('cat-housing', 'Жильё и коммуналка', 'Home', '#a855f7'),
  expense('cat-credit', 'Кредиты', 'Landmark', '#ef4444'),
  expense('cat-health', 'Здоровье', 'HeartPulse', '#ec4899'),
  expense('cat-fun', 'Развлечения', 'Gamepad2', '#eab308'),
  expense('cat-clothes', 'Одежда', 'Shirt', '#14b8a6'),
  expense('cat-comm', 'Связь и интернет', 'Smartphone', '#6366f1'),
  expense('cat-other', 'Прочее', 'MoreHorizontal', '#71717a'),
  income('cat-salary', 'Зарплата', 'Wallet', '#22c55e'),
  income('cat-bonus', 'Премия', 'Gift', '#eab308'),
  income('cat-side', 'Подработка', 'Briefcase', '#3b82f6'),
  income('cat-in-other', 'Прочий доход', 'PlusCircle', '#71717a'),
]

/** Заполняет БД стартовыми данными один раз (идемпотентно). */
export async function seedIfEmpty(): Promise<boolean> {
  return db.transaction('rw', [db.accounts, db.categories, db.config], async () => {
    if (await db.config.get('seeded')) return false
    const account: Account = {
      id: crypto.randomUUID(),
      name: 'Наличные KZT',
      type: 'cash',
      currency: 'KZT',
      initialBalance: 0,
      currentBalance: 0,
      isArchived: false,
      createdAt: new Date().toISOString(),
    }
    await db.accounts.add(account)
    await db.categories.bulkPut(DEFAULT_CATEGORIES)
    await db.config.put({ key: 'seeded', value: true })
    return true
  })
}
