/** Слова, которые нужно ввести, чтобы подтвердить необратимое действие. */
export const RESET_WORD = 'СБРОС'
export const RESTORE_WORD = 'ЗАМЕНИТЬ'

/** Введено ли слово подтверждения: без учёта регистра и пробелов по краям. */
export function isConfirmationWord(input: string, word: string): boolean {
  return input.trim().toLocaleUpperCase('ru-RU') === word
}
