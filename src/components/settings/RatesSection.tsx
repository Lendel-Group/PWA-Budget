import { useState } from 'react'
import { Field } from '../ui/Sheet'
import { inputClass, toNumber } from '../ui/form'
import { useRates } from '../../lib/useRates'
import { useToday } from '../../lib/useToday'
import { refreshRates, setManualRates } from '../../services/ratesService'

const CURRENCIES = ['USD', 'EUR', 'RUB'] as const

export function RatesSection() {
  const today = useToday()
  const { rates, stored } = useRates()
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<{ ok: boolean; text: string }>()
  const [busy, setBusy] = useState(false)

  const value = (c: (typeof CURRENCIES)[number]) => draft[c] ?? (rates[c] !== undefined ? String(rates[c]) : '')

  async function saveManual() {
    const next: Record<string, number> = {}
    for (const c of CURRENCIES) {
      const raw = value(c).trim()
      if (raw === '') continue
      const n = toNumber(raw)
      if (!(n > 0)) return setMessage({ ok: false, text: `Некорректный курс ${c}` })
      next[c] = n
    }
    await setManualRates(next, today)
    setDraft({})
    setMessage({ ok: true, text: 'Курсы сохранены' })
  }

  async function fetchNbk() {
    setBusy(true)
    const result = await refreshRates(today, fetch, true)
    setBusy(false)
    setDraft({})
    setMessage(result.fetched
      ? { ok: true, text: `Курсы Нацбанка РК обновлены (на ${result.rates?.date})` }
      : { ok: false, text: 'Не удалось получить курсы (нет сети?). Остаются сохранённые или введённые вручную.' })
  }

  return (
    <section aria-labelledby="rates-h" className="space-y-3 rounded-2xl bg-zinc-900 p-4">
      <div>
        <h2 id="rates-h" className="font-medium">Курсы валют к тенге</h2>
        <p className="text-xs text-zinc-500">
          {stored ? `${stored.source === 'nbk' ? 'Нацбанк РК' : 'Вручную'} · ${stored.date}` : 'Курсы не заданы — счета в валюте не входят в капитал'}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {CURRENCIES.map((c) => (
          <Field key={c} label={`1 ${c} = ₸`}>
            <input className={inputClass} inputMode="decimal" aria-label={`Курс ${c}`} value={value(c)} onChange={(e) => setDraft((d) => ({ ...d, [c]: e.target.value }))} />
          </Field>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={saveManual} className="h-11 rounded-xl bg-emerald-500 text-sm font-medium text-zinc-950">Сохранить</button>
        <button type="button" onClick={fetchNbk} disabled={busy} className="h-11 rounded-xl bg-zinc-800 text-sm disabled:opacity-50">
          {busy ? 'Загрузка…' : 'Обновить курсы'}
        </button>
      </div>
      {message && <p role="status" className={message.ok ? 'text-xs text-emerald-400' : 'text-xs text-amber-400'}>{message.text}</p>}
    </section>
  )
}
