import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/schema'
import { seedIfEmpty } from '../db/seed'
import { deleteTransaction } from './transactionService'
import { createDebt, createGoal, deleteDebt, deleteGoal, payDebt, topUpGoal } from './planningService'

const debtInput = { name: ' Кредит ', totalAmount: 1000, remainingAmount: 1000, monthlyPayment: 100, dueDay: 5 }
let kzt: string

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  await seedIfEmpty()
  const acc = (await db.accounts.toArray())[0]
  kzt = acc.id
  await db.accounts.update(kzt, { currentBalance: 5000 })
})

describe('debts', () => {
  it('validates and trims on create', async () => {
    await expect(createDebt({ ...debtInput, name: '' })).rejects.toThrow(/название/)
    const id = await createDebt({ ...debtInput, interestRate: 12 })
    expect(await db.debts.get(id)).toMatchObject({ name: 'Кредит', interestRate: 12, isClosed: false })
    const id2 = await createDebt(debtInput)
    expect((await db.debts.get(id2))!.interestRate).toBeUndefined()
  })

  it('payment lowers account balance AND debt remainder; flagged as no-spend exempt', async () => {
    const id = await createDebt(debtInput)
    const txId = await payDebt(id, kzt, 400, '2026-11-04')
    expect((await db.accounts.get(kzt))!.currentBalance).toBe(4600)
    expect((await db.debts.get(id))!.remainingAmount).toBe(600)
    expect(await db.transactions.get(txId)).toMatchObject({
      type: 'expense', debtId: id, categoryId: 'cat-credit', isExcludedFromNoSpend: true,
    })
    await deleteTransaction(txId)
    expect((await db.debts.get(id))!.remainingAmount).toBe(1000)
    expect((await db.accounts.get(kzt))!.currentBalance).toBe(5000)
  })

  it('full payment closes the debt; overpayment is rejected atomically', async () => {
    const id = await createDebt(debtInput)
    await expect(payDebt(id, kzt, 1001, '2026-11-04')).rejects.toThrow(/превышает/)
    expect((await db.accounts.get(kzt))!.currentBalance).toBe(5000)
    await payDebt(id, kzt, 1000, '2026-11-04')
    expect((await db.debts.get(id))!.isClosed).toBe(true)
  })

  it('works without the cat-credit category, rejects missing debt, missing and foreign-currency accounts', async () => {
    const id = await createDebt(debtInput)
    await db.categories.delete('cat-credit')
    const txId = await payDebt(id, kzt, 10, '2026-11-04')
    expect((await db.transactions.get(txId))!.categoryId).toBeUndefined()
    await expect(payDebt('nope', kzt, 10, '2026-11-04')).rejects.toThrow(/Долг/)
    await expect(payDebt(id, 'nope', 10, '2026-11-04')).rejects.toThrow(/Счёт/)
    await db.accounts.add({ id: 'usd', name: 'USD', type: 'card', currency: 'USD', initialBalance: 0, currentBalance: 100, isArchived: false, createdAt: '' })
    await expect(payDebt(id, 'usd', 10, '2026-11-04')).rejects.toThrow(/KZT/)
  })

  it('delete is blocked while payments exist', async () => {
    const id = await createDebt(debtInput)
    const txId = await payDebt(id, kzt, 10, '2026-11-04')
    await expect(deleteDebt(id)).rejects.toThrow(/платежи/)
    await deleteTransaction(txId)
    await deleteDebt(id)
    expect(await db.debts.count()).toBe(0)
  })
})

describe('goals', () => {
  const goalInput = { title: ' Отпуск ', targetAmount: 1000, targetDate: '2027-01-01' }

  it('validates, applies defaults, and accepts custom icon/color', async () => {
    await expect(createGoal({ ...goalInput, targetAmount: 0 }, '2026-11-04')).rejects.toThrow(/сумма/)
    const id = await createGoal(goalInput, '2026-11-04')
    expect(await db.goals.get(id)).toMatchObject({ title: 'Отпуск', currentAmount: 0, icon: 'Target', isAchieved: false })
    const id2 = await createGoal({ ...goalInput, icon: 'Plane', color: '#fff' }, '2026-11-04')
    expect(await db.goals.get(id2)).toMatchObject({ icon: 'Plane', color: '#fff' })
  })

  it('top-up moves money from the account to the goal; achieves at target', async () => {
    const id = await createGoal(goalInput, '2026-11-04')
    const txId = await topUpGoal(id, kzt, 600, '2026-11-04')
    expect((await db.accounts.get(kzt))!.currentBalance).toBe(4400)
    expect(await db.goals.get(id)).toMatchObject({ currentAmount: 600, isAchieved: false })
    await topUpGoal(id, kzt, 400, '2026-11-04')
    expect((await db.goals.get(id))!.isAchieved).toBe(true)
    await deleteTransaction(txId)
    expect(await db.goals.get(id)).toMatchObject({ currentAmount: 400, isAchieved: false })
  })

  it('rejects unknown goal / account and blocks deletion with top-ups', async () => {
    const id = await createGoal(goalInput, '2026-11-04')
    await expect(topUpGoal('nope', kzt, 1, '2026-11-04')).rejects.toThrow(/Цель/)
    await expect(topUpGoal(id, 'nope', 1, '2026-11-04')).rejects.toThrow(/Счёт/)
    const txId = await topUpGoal(id, kzt, 10, '2026-11-04')
    await expect(deleteGoal(id)).rejects.toThrow(/пополнения/)
    await deleteTransaction(txId)
    await deleteGoal(id)
    expect(await db.goals.count()).toBe(0)
  })
})
