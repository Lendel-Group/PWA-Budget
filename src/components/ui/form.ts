export const inputClass =
  'w-full rounded-xl bg-zinc-900 px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-emerald-500'

export const primaryButton =
  'h-12 w-full rounded-2xl bg-emerald-500 font-semibold text-zinc-950 disabled:opacity-40'

/** Парсит число из текстового поля: пусто/мусор → NaN. */
export const toNumber = (s: string): number => (s.trim() === '' ? NaN : Number(s.replace(/\s/g, '').replace(',', '.')))
