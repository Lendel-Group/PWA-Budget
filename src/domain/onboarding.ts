import type { Account } from '../db/schema'

export type OnboardingStepId = 'account' | 'limits' | 'transaction'

export interface OnboardingStep {
  id: OnboardingStepId
  done: boolean
}

/**
 * Шаги первого запуска. Отмечаются автоматически по данным, в любом порядке:
 * счёт с остатком — добавлен ещё один счёт или у какого-то задан начальный остаток (сид создаёт один пустой);
 * лимиты — задан хотя бы один лимит; операция — есть хотя бы одна операция.
 */
export function onboardingSteps(input: {
  accounts: readonly Pick<Account, 'initialBalance'>[]
  limitsCount: number
  transactionsCount: number
}): OnboardingStep[] {
  return [
    { id: 'account', done: input.accounts.length > 1 || input.accounts.some((a) => a.initialBalance !== 0) },
    { id: 'limits', done: input.limitsCount > 0 },
    { id: 'transaction', done: input.transactionsCount > 0 },
  ]
}

export const isOnboardingComplete = (steps: readonly OnboardingStep[]): boolean => steps.every((s) => s.done)
