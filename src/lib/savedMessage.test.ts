import { describe, expect, it } from 'vitest'
import { savedMessage } from './savedMessage'

describe('savedMessage', () => {
  it('расход и доход', () => {
    expect(savedMessage({ type: 'expense', amount: 5000 }, 'KZT', false)).toBe('Расход 5 000 ₸ сохранён')
    expect(savedMessage({ type: 'income', amount: 12.5 }, 'USD', false)).toBe('Доход 12,50 $ сохранён')
  })
  it('перевод', () => {
    expect(savedMessage({ type: 'transfer', amount: 100 }, 'KZT', false)).toBe('Перевод 100 ₸ выполнен')
  })
  it('редактирование', () => {
    expect(savedMessage({ type: 'expense', amount: 5000 }, 'KZT', true)).toBe('Изменения сохранены')
  })
})
