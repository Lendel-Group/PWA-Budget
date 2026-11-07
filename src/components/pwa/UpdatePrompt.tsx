import { useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { applyUpdate } from '../../lib/applyUpdate'

const HOUR = 60 * 60 * 1000
/** Не чаще одной проверки в 5 минут при возвратах в приложение. */
const MIN_GAP_MS = 5 * 60 * 1000

/**
 * Показывает баннер, когда опубликована новая версия сервис-воркера, и «готово к офлайн» после первой установки.
 * Проверка обновлений: раз в час, при каждом возвращении в приложение и при появлении сети —
 * мобильные браузеры усыпляют страницу в фоне, и без этого новая версия находилась бы только после перезагрузки.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      let lastCheck = Date.now()
      const check = () => {
        lastCheck = Date.now()
        registration.update().catch(() => {}) // офлайн — просто попробуем позже
      }
      setInterval(check, HOUR)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && Date.now() - lastCheck >= MIN_GAP_MS) check()
      })
      window.addEventListener('online', check)
    },
    onRegisterError(error) {
      console.warn('[pwa] регистрация сервис-воркера не удалась', error)
    },
  })

  const [applying, setApplying] = useState(false)

  if (!needRefresh && !offlineReady) return null
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-[calc(6rem+var(--safe-bottom))] z-[45] mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-zinc-700 bg-zinc-900 p-3 text-sm shadow-xl"
      style={{ width: 'calc(100% - 2rem)' }}
    >
      <span>{needRefresh ? 'Доступна новая версия приложения' : 'Приложение готово к работе офлайн'}</span>
      <span className="flex shrink-0 gap-2">
        {needRefresh && (
          <button
            type="button"
            disabled={applying}
            onClick={() => { setApplying(true); void applyUpdate(navigator.serviceWorker, () => window.location.reload()) }}
            className="min-h-11 rounded-lg bg-accent px-3 font-medium text-on-accent disabled:opacity-70"
          >
            {applying ? 'Обновление…' : 'Обновить'}
          </button>
        )}
        <button
          type="button"
          onClick={() => (needRefresh ? setNeedRefresh(false) : setOfflineReady(false))}
          className="min-h-11 rounded-lg bg-zinc-800 px-3"
        >
          {needRefresh ? 'Позже' : 'Ок'}
        </button>
      </span>
    </div>
  )
}
