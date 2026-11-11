export const inputClass =
  'min-h-11 w-full rounded-xl bg-zinc-800 px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-accent'

export const primaryButton =
  'h-12 w-full rounded-2xl bg-accent font-semibold text-zinc-950 disabled:opacity-40'

/** Парсит число из текстового поля: пусто/мусор → NaN. */
/** Ввод суммы: пустое, не число или бесконечность (`1e400`) → NaN (budget-spec, spec/02 «Ввод сумм в формах»). */
export const toNumber = (s: string): number => {
  const n = s.trim() === '' ? NaN : Number(s.replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}
