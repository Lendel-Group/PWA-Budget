import { describe, expect, it } from 'vitest'
import { invalidFields } from './forms'

describe('invalidFields', () => {
  it('пустой объект — нет невалидных полей', () => {
    expect(invalidFields({})).toEqual([])
  })
  it('перечисляет поля с ошибками в порядке проверок', () => {
    expect(invalidFields({ name: 'Укажите название', amount: 'Сумма должна быть больше нуля' })).toEqual(['name', 'amount'])
  })
  it('ключ со значением undefined — поле в порядке', () => {
    expect(invalidFields<'amount' | 'name'>({ amount: undefined, name: 'Укажите название' })).toEqual(['name'])
    expect(invalidFields<'amount'>({ amount: undefined })).toEqual([])
  })
})
