/** Поля с ошибкой: ключ без значения (в том числе `undefined`) — поле в порядке. Порядок — как в `errors`. */
export function invalidFields<K extends string>(errors: Partial<Record<K, string>>): K[] {
  return (Object.keys(errors) as K[]).filter((k) => errors[k] !== undefined)
}
