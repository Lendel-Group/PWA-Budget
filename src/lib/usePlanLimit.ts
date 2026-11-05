import { useCallback, useEffect, useRef, useState } from 'react'
import { db } from '../db/schema'
import { limitId, parsePlanInput } from '../domain/budget'

/** Сколько показывать отметку «Сохранено», мс. */
const SAVED_VISIBLE_MS = 2000
const DEBOUNCE_MS = 500

export type LimitStatus = 'idle' | 'saved' | 'save-error' | 'invalid'

async function savePlan(year: number, month: number, categoryId: string, amount: number) {
  const id = limitId(year, month, categoryId)
  if (amount > 0) await db.budgetLimits.put({ id, year, month, categoryId, plannedAmount: amount })
  else await db.budgetLimits.delete(id)
}

/**
 * Лимит категории с автосохранением (через 500 мс после ввода и при потере фокуса) и видимым состоянием:
 * `saved` — отметка на пару секунд после записи, `save-error` — запись не удалась (остаётся, пока не сохранится или не начнут
 * править заново), `invalid` — введено не число (остаётся, пока ввод не исправят).
 */
export function usePlanLimit(stored: number, year: number, month: number, categoryId: string) {
  const [draft, setDraft] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<'idle' | 'saved' | 'save-error'>('idle')
  const hideSaved = useRef<ReturnType<typeof setTimeout>>(undefined)
  const parsed = draft === null ? null : parsePlanInput(draft)
  const invalid = draft !== null && parsed === null

  const persist = useCallback(async (amount: number) => {
    clearTimeout(hideSaved.current)
    try {
      await savePlan(year, month, categoryId, amount)
      setOutcome('saved')
      hideSaved.current = setTimeout(() => setOutcome('idle'), SAVED_VISIBLE_MS)
    } catch {
      setOutcome('save-error')
    }
  }, [year, month, categoryId])

  useEffect(() => {
    if (parsed === null || parsed === stored) return
    const id = setTimeout(() => void persist(parsed), DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [parsed, stored, persist])

  useEffect(() => () => clearTimeout(hideSaved.current), [])

  const status: LimitStatus = invalid ? 'invalid' : outcome

  return {
    value: draft ?? (stored > 0 ? String(stored) : ''),
    status,
    onChange: (text: string) => {
      clearTimeout(hideSaved.current)
      setOutcome('idle') // новая правка — прежний результат (отметка или ошибка) больше не актуален
      setDraft(text)
    },
    onBlur: () => {
      if (parsed !== null && parsed !== stored) void persist(parsed)
      setDraft(null)
    },
  }
}
