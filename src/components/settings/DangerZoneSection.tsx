import { useRef, useState } from 'react'
import { FileUp, TriangleAlert } from 'lucide-react'
import { RESET_WORD, RESTORE_WORD } from '../../domain/dangerConfirm'
import { BackupValidationError, describeBackup, parseBackup } from '../../domain/backupValidation'
import { importDatabaseFromJson } from '../../services/backupService'
import { resetApplication } from '../../services/resetService'
import { ConfirmDangerSheet } from './ConfirmDangerSheet'

const DANGER_BTN = 'flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-danger/40 text-sm font-medium text-danger active:bg-danger/15'

type Pending = { kind: 'reset' } | { kind: 'restore'; json: string; summary: string }

/**
 * «Опасная зона»: действия, которые заменяют или удаляют все данные. Отдельный блок внизу страницы,
 * подтверждение — диалог с вводом слова и предложением сначала скачать копию (вместо `window.confirm`).
 */
export function DangerZoneSection({ onDataReplaced }: { onDataReplaced: () => void }) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<Pending>()
  const [message, setMessage] = useState<{ ok: boolean; text: string }>()

  /** Файл проверяется сразу: непригодный отклоняется без диалога; годный ждёт подтверждения. */
  async function pickFile(file: File) {
    setMessage(undefined)
    try {
      const json = await file.text()
      const { data } = parseBackup(json)
      setPending({ kind: 'restore', json, summary: describeBackup(data) })
    } catch (e) {
      setMessage({ ok: false, text: e instanceof BackupValidationError ? `Файл не подходит: ${e.message}` : 'Не удалось прочитать файл' })
    }
  }

  return (
    <section aria-labelledby="danger-h" className="space-y-3 rounded-2xl border border-danger/40 bg-danger/5 p-4" data-testid="danger-zone">
      <h2 id="danger-h" className="flex items-center gap-2 font-medium text-danger">
        <TriangleAlert className="size-5" aria-hidden /> Опасная зона
      </h2>
      <p className="text-xs text-fg-muted">Эти действия заменяют или удаляют все данные приложения. Сначала скачайте резервную копию.</p>

      <button type="button" className={DANGER_BTN} onClick={() => fileInput.current?.click()}>
        <FileUp className="size-4" aria-hidden /> Восстановить из файла
      </button>
      <input
        ref={fileInput} type="file" accept="application/json,.json" hidden data-testid="restore-input"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void pickFile(f) }}
      />
      <button type="button" className={DANGER_BTN} onClick={() => { setMessage(undefined); setPending({ kind: 'reset' }) }}>
        Полный сброс приложения
      </button>
      {message && <p role="status" className={message.ok ? 'text-xs text-success' : 'text-xs text-danger'}>{message.text}</p>}

      {pending?.kind === 'reset' && (
        <ConfirmDangerSheet
          title="Сбросить приложение?"
          word={RESET_WORD}
          actionLabel="Удалить все данные"
          onClose={() => setPending(undefined)}
          onConfirm={async () => {
            await resetApplication()
            onDataReplaced()
            setMessage({ ok: true, text: 'Приложение сброшено' })
          }}
        >
          <p>Будут удалены все счета, операции, бюджеты, долги, цели и категории, а также привязка файла автобэкапа.</p>
          <p className="text-fg-muted">Действие нельзя отменить.</p>
        </ConfirmDangerSheet>
      )}
      {pending?.kind === 'restore' && (
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
