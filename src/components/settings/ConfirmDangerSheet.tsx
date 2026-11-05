import { useState, type ReactNode } from 'react'
import { Download, Check } from 'lucide-react'
import { Field, Sheet } from '../ui/Sheet'
import { inputClass } from '../ui/form'
import { isConfirmationWord } from '../../domain/dangerConfirm'
import { downloadBackupFile } from '../../services/backupService'

interface Props {
  title: string
  /** Что именно произойдёт и что будет потеряно. */
  children: ReactNode
  /** Слово, которое нужно ввести для подтверждения. */
  word: string
  actionLabel: string
  onConfirm: () => Promise<void>
  onClose: () => void
}

const SECONDARY = 'flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-zinc-800 text-sm active:bg-zinc-700 disabled:opacity-50'

/**
 * Подтверждение необратимого действия: описание последствий, предложение сначала скачать резервную копию
 * и ввод слова — кнопка действия включается только при точном совпадении.
 */
export function ConfirmDangerSheet({ title, children, word, actionLabel, onConfirm, onClose }: Props) {
  const [typed, setTyped] = useState('')
  const [backedUp, setBackedUp] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const confirmed = isConfirmationWord(typed, word)

  async function backup() {
    setError(undefined)
    try {
      await downloadBackupFile()
      setBackedUp(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось скачать копию')
    }
  }

  async function confirm() {
    setBusy(true)
    setError(undefined)
    try {
      await onConfirm()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось выполнить действие')
      setBusy(false)
    }
  }

  return (
    <Sheet title={title} onClose={onClose}>
      <div className="space-y-2 text-sm">{children}</div>
      <button type="button" className={SECONDARY} onClick={backup}>
        {backedUp ? <Check className="size-4 text-success" aria-hidden /> : <Download className="size-4" aria-hidden />}
        {backedUp ? 'Копия скачана — скачать ещё раз' : 'Сначала скачать резервную копию'}
      </button>
      <Field label={`Для подтверждения введите «${word}»`}>
        <input
          data-autofocus
          className={inputClass}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder={word}
        />
      </Field>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button
        type="button"
        disabled={!confirmed || busy}
        onClick={confirm}
        className="h-12 w-full rounded-2xl bg-danger font-semibold text-zinc-950 disabled:opacity-40"
      >
        {actionLabel}
      </button>
    </Sheet>
  )
}
