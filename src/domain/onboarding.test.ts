import { describe, expect, it } from 'vitest'
import { isOnboardingComplete, onboardingSteps } from './onboarding'

const done = (input: Parameters<typeof onboardingSteps>[0]) => onboardingSteps(input).map((s) => s.done)
const empty = { accounts: [{ initialBalance: 0 }], limitsCount: 0, transactionsCount: 0 }

describe('onboardingSteps', () => {
  it('свежая установка: ни один шаг не выполнен, порядок — счёт, лимиты, операция', () => {
    expect(onboardingSteps(empty).map((s) => s.id)).toEqual(['account', 'limits', 'transaction'])
    expect(done(empty)).toEqual([false, false, false])
  })

  it('счёт с остатком: задан начальный остаток или добавлен ещё один счёт', () => {
    expect(done({ ...empty, accounts: [{ initialBalance: 50000 }] })[0]).toBe(true)
    expect(done({ ...empty, accounts: [{ initialBalance: -1000 }] })[0]).toBe(true)
    expect(done({ ...empty, accounts: [{ initialBalance: 0 }, { initialBalance: 0 }] })[0]).toBe(true)
    expect(done({ ...empty, accounts: [] })[0]).toBe(false)
  })

  it('лимиты и операция отмечаются независимо друг от друга', () => {
    expect(done({ ...empty, limitsCount: 2 })).toEqual([false, true, false])
    expect(done({ ...empty, transactionsCount: 1 })).toEqual([false, false, true])
  })
})

describe('isOnboardingComplete', () => {
  it('только когда выполнены все шаги', () => {
    expect(isOnboardingComplete(onboardingSteps(empty))).toBe(false)
    expect(isOnboardingComplete(onboardingSteps({ accounts: [{ initialBalance: 1 }], limitsCount: 1, transactionsCount: 0 }))).toBe(false)
    expect(isOnboardingComplete(onboardingSteps({ accounts: [{ initialBalance: 1 }], limitsCount: 1, transactionsCount: 1 }))).toBe(true)
  })
})
