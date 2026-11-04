import type {
  Account, AppConfig, BudgetLimit, Category, Debt, FinancialGoal, Transaction,
} from '../db/schema'

export const BACKUP_APP_ID = 'pwa-budget'
export const BACKUP_SCHEMA_VERSION = 2
/** Ключи config, которые попадают в бэкап (handle и статус persist — локальные). */
export const EXPORTED_CONFIG_KEYS = ['fx_rates'] as const

export interface BackupData {
  accounts: Account[]
  categories: Category[]
  budgetLimits: BudgetLimit[]
  transactions: Transaction[]
  debts: Debt[]
  goals: FinancialGoal[]
  config: AppConfig[]
}

export interface BackupFile {
  app: typeof BACKUP_APP_ID
  schemaVersion: number
  exportedAt: string
  data: BackupData
}

export class BackupValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BackupValidationError'
  }
}

type FieldSpec = 'string' | 'number' | 'boolean' | 'string?' | 'number?' | 'boolean?' | readonly string[]
type TableSpec = Record<string, FieldSpec>

const TABLES: Record<Exclude<keyof BackupData, 'config'>, TableSpec> = {
  accounts: {
    id: 'string', name: 'string', type: ['card', 'cash', 'deposit'],
    currency: ['KZT', 'USD', 'RUB', 'EUR'], initialBalance: 'number', currentBalance: 'number',
    isArchived: 'boolean', createdAt: 'string',
  },
  categories: {
    id: 'string', name: 'string', type: ['expense', 'income'], icon: 'string', color: 'string',
    isDefault: 'boolean', isArchived: 'boolean?', order: 'number?',
  },
  budgetLimits: {
    id: 'string', year: 'number', month: 'number', categoryId: 'string', plannedAmount: 'number',
  },
  transactions: {
    id: 'string', date: 'string', timestamp: 'number', type: ['expense', 'income', 'transfer'],
    accountId: 'string', toAccountId: 'string?', toAmount: 'number?', categoryId: 'string?',
    debtId: 'string?', goalId: 'string?', amount: 'number', comment: 'string?',
    isExcludedFromNoSpend: 'boolean',
  },
  debts: {
    id: 'string', name: 'string', totalAmount: 'number', remainingAmount: 'number',
    monthlyPayment: 'number', dueDay: 'number', interestRate: 'number?', createdAt: 'string',
    isClosed: 'boolean',
  },
  goals: {
    id: 'string', title: 'string', targetAmount: 'number', currentAmount: 'number',
    targetDate: 'string', icon: 'string', color: 'string', isAchieved: 'boolean',
  },
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

function checkField(table: string, index: number, field: string, spec: FieldSpec, value: unknown) {
  const where = `${table}[${index}].${field}`
  if (Array.isArray(spec)) {
    if (!spec.includes(value as string)) throw new BackupValidationError(`${where}: недопустимое значение`)
    return
  }
  const optional = (spec as string).endsWith('?')
  const type = (spec as string).replace('?', '')
  if (value === undefined && optional) return
  if (type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new BackupValidationError(`${where}: ожидалось число`)
    }
    return
  }
  if (typeof value !== type) throw new BackupValidationError(`${where}: ожидался тип ${type}`)
}

/** Разбирает и валидирует JSON бэкапа. Бросает BackupValidationError. */
export function parseBackup(jsonString: string): BackupFile {
  let raw: unknown
  try {
    raw = JSON.parse(jsonString)
  } catch {
    throw new BackupValidationError('Файл не является корректным JSON')
  }
  if (!isObject(raw) || raw.app !== BACKUP_APP_ID) {
    throw new BackupValidationError('Это не файл резервной копии приложения')
  }
  if (raw.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new BackupValidationError(`Неподдерживаемая версия схемы: ${String(raw.schemaVersion)}`)
  }
  if (typeof raw.exportedAt !== 'string') throw new BackupValidationError('Нет даты экспорта')
  if (!isObject(raw.data)) throw new BackupValidationError('Нет блока data')
  const data = raw.data

  for (const [table, spec] of Object.entries(TABLES)) {
    const rows = data[table]
    if (!Array.isArray(rows)) throw new BackupValidationError(`${table}: ожидался массив`)
    const ids = new Set<string>()
    rows.forEach((row, i) => {
      if (!isObject(row)) throw new BackupValidationError(`${table}[${i}]: ожидался объект`)
      for (const [field, fieldSpec] of Object.entries(spec)) {
        checkField(table, i, field, fieldSpec, row[field])
      }
      const id = row.id as string
      if (ids.has(id)) throw new BackupValidationError(`${table}: повторяющийся id ${id}`)
      ids.add(id)
    })
  }

  const config = data.config
  if (!Array.isArray(config)) throw new BackupValidationError('config: ожидался массив')
  config.forEach((row, i) => {
    if (!isObject(row) || typeof row.key !== 'string' || !('value' in row)) {
      throw new BackupValidationError(`config[${i}]: некорректная запись`)
    }
  })

  const accountIds = new Set((data.accounts as Account[]).map((a) => a.id))
  for (const t of data.transactions as Transaction[]) {
    if (!accountIds.has(t.accountId) || (t.toAccountId && !accountIds.has(t.toAccountId))) {
      throw new BackupValidationError(`transactions: ссылка на несуществующий счёт (${t.id})`)
    }
  }

  return raw as unknown as BackupFile
}
