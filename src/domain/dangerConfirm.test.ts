import { describe, expect, it } from 'vitest'
import { isConfirmationWord, RESET_WORD, RESTORE_WORD } from './dangerConfirm'

describe('isConfirmationWord', () => {
  it('точное слово подтверждает', () => {
    expect(isConfirmationWord('СБРОС', RESET_WORD)).toBe(true)
    expect(isConfirmationWord('ЗАМЕНИТЬ', RESTORE_WORD)).toBe(true)
  })
  it('регистр и пробелы по краям не важны (телефонная клавиатура начинает со строчной)', () => {
    expect(isConfirmationWord('  сброс ', RESET_WORD)).toBe(true)
    expect(isConfirmationWord('Заменить', RESTORE_WORD)).toBe(true)
  })
  it('другое слово, часть слова и пустая строка не подтверждают', () => {
    expect(isConfirmationWord('', RESET_WORD)).toBe(false)
    expect(isConfirmationWord('сбро', RESET_WORD)).toBe(false)
    expect(isConfirmationWord('сброс!', RESET_WORD)).toBe(false)
    expect(isConfirmationWord('СБРОС', RESTORE_WORD)).toBe(false)
  })
  it('латинские буквы, похожие на русские, не подходят', () => {
    expect(isConfirmationWord('CБPOC', RESET_WORD)).toBe(false) // латиница C, P, O, C
  })
})
