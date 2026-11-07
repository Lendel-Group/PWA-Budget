import { useRef, useState } from 'react'
import { FileUp, Trash2 } from 'lucide-react'
import { RESET_WORD, RESTORE_WORD } from '../../domain/dangerConfirm'
import { BackupValidationError, describeBackup, parseBackup } from '../../domain/backupValidation'
import { importDatabaseFromJson } from '../../services/backupService'
import { resetApplication } from '../../services/resetService'
import { ConfirmDangerSheet } from './ConfirmDangerSheet'

const DANGER_BTN = 'flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-danger/40 text-sm font-medium text-danger active:bg-danger/15'

type Message = { ok: boolean; text: string }

/**
 * «Восстановление» на экране «Резервные копии» (spec/05): файл проверяется сразу — непригодный отклоняется без листа,
 * годный ждёт подтверждения словом.
 */
export function RestoreSection({ onDataReplaced }: { onDataReplaced: () => void }) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<{ json: string; summary: string }>()
  const [message, setMessage] = useState<Message>()

  async function pickFile(file: File) {
    setMessage(undefined)
    try {
      const json = await file.text()
      const { data } = parseBackup(json)
      setPending({ json, summary: describeBackup(data) })
    } catch (e) {
      setMessage({ ok: false, text: e instanceof BackupValidationError ? `Файл не подходит: ${e.message}` : 'Не удалось прочитать файл' })
    }
  }

  return (
    <section aria-labelledby="restore-h" className="space-y-2 rounded-2xl bg-zinc-900 p-4" data-testid="restore">
      <h2 id="restore-h" className="font-medium">Восстановление</h2>
      <button type="button" className={DANGER_BTN} onClick={() => fileInput.current?.click()}>
        <FileUp className="size-4" aria-hidden /> Восстановить из файла
      </button>
      <input
        ref={fileInput} type="file" accept="application/json,.json" hidden data-testid="restore-input"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void pickFile(f) }}
      />
      <p className="text-xs text-fg-muted">Заменяет все данные приложения данными из файла. Сначала скачайте резервную копию.</p>
      {message && <p role="status" className={message.ok ? 'text-xs text-success' : 'text-xs text-danger'}>{message.text}</p>}

      {pending && (
        <ConfirmDangerSheet
          title="Заменить данные из файла?"
          word={RESTORE_WORD}
          actionLabel="Заменить все данные"
          onClose={() => setPending(undefined)}
          onConfirm={async () => {
            await importDatabaseFromJson(pending.json)
            onDataReplaced()
            setMessage({ ok: true, text: `Данные восстановлены (${pending.summary})` })
          }}
        >
          <p>Все текущие данные будут заменены данными из файла ({pending.summary}).</p>
          <p className="text-fg-muted">Действие нельзя отменить.</p>
        </ConfirmDangerSheet>
      )}
    </section>
  )
}

/** «Полный сброс приложения» — отдельная строка внизу «Настроек» (spec/05), сразу открывает лист подтверждения. */
export function ResetRow({ onReset }: { onReset?: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [message, setMessage] = useState<Message>()
  return (
    <div data-testid="reset">
      <button
        type="button"
        onClick={() => { setMessage(undefined); setConfirming(true) }}
        className="flex min-h-16 w-full items-center gap-3 rounded-2xl bg-zinc-900 px-4 py-3 text-left text-danger"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-danger/15"><Trash2 className="size-5" aria-hidden /></span>
        <span className="font-medium">Полный сброс приложения</span>
      </button>
      {message && <p role="status" className={message.ok ? 'mt-2 px-1 text-xs text-success' : 'mt-2 px-1 text-xs text-danger'}>{message.text}</p>}
      {confirming && (
        <ConfirmDangerSheet
          title="Сбросить приложение?"
          word={RESET_WORD}
          actionLabel="Удалить все данные"
          onClose={() => setConfirming(false)}
          onConfirm={async () => {
            await resetApplication()
            onReset?.()
            setMessage({ ok: true, text: 'Приложение сброшено' })
          }}
        >
          <p>Будут удалены все счета, операции, бюджеты, долги, цели и категории, а также привязка файла автобэкапа.</p>
          <p className="text-fg-muted">Действие нельзя отменить.</p>
        </ConfirmDangerSheet>
      )}
    </div>
  )
}
