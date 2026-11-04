import Dexie, { type Table } from 'dexie'

export type Currency = 'KZT' | 'USD' | 'RUB' | 'EUR'

export interface Account {
  id: string
  name: string
  type: 'card' | 'cash' | 'deposit'
  currency: Currency
  initialBalance: number
  currentBalance: number
  isArchived: boolean
  createdAt: string // ISO-8601
}

export interface Category {
  id: string
  name: string
  type: 'expense' | 'income'
  icon: string // Lucide icon identifier
  color: string
  isDefault: boolean
}

export interface BudgetLimit {
  id: string // `${year}-${month}-${categoryId}`
  year: number
  month: number // 1-12
  categoryId: string
  plannedAmount: number
}

export interface Transaction {
  id: string
  date: string // YYYY-MM-DD (local)
  timestamp: number
  type: 'expense' | 'income' | 'transfer'
  accountId: string
  toAccountId?: string
  /** Сумма зачисления на toAccountId, если валюты счетов различаются. */
  toAmount?: number
  categoryId?: string
  /** Платёж по долгу: уменьшает Debt.remainingAmount. */
  debtId?: string
  /** Пополнение цели: увеличивает FinancialGoal.currentAmount. */
  goalId?: string
  amount: number
  comment?: string
  isExcludedFromNoSpend: boolean
}

export interface Debt {
  id: string
  name: string
  totalAmount: number
  remainingAmount: number
  monthlyPayment: number
  dueDay: number // 1-31
  interestRate?: number
  createdAt: string
  isClosed: boolean
}

export interface FinancialGoal {
  id: string
  title: string
  targetAmount: number
  currentAmount: number
  targetDate: string // YYYY-MM-DD
  icon: string
  color: string
  isAchieved: boolean
}

export type ConfigKey =
  | 'storage_persisted'
  | 'auto_backup_handle'
  | 'last_backup_date'
  | 'seeded'
  | 'fx_rates'

export interface AppConfig {
  key: ConfigKey
  value: unknown
}

export class AppDatabase extends Dexie {
  accounts!: Table<Account, string>
  categories!: Table<Category, string>
  budgetLimits!: Table<BudgetLimit, string>
  transactions!: Table<Transaction, string>
  debts!: Table<Debt, string>
  goals!: Table<FinancialGoal, string>
  config!: Table<AppConfig, string>

  constructor(name = 'BudgetDatabase') {
    super(name)
    this.version(2).stores({
      accounts: 'id, type, isArchived',
      categories: 'id, type',
      budgetLimits: 'id, [year+month], categoryId',
      transactions: 'id, date, timestamp, type, accountId, categoryId',
      debts: 'id, isClosed',
      goals: 'id, isAchieved',
      config: 'key',
    })
  }
}

export const db = new AppDatabase()
