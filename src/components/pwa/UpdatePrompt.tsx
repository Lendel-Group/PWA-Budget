import { useRegisterSW } from 'virtual:pwa-register/react'

const HOUR = 60 * 60 * 1000

/** Показывает баннер, когда опубликована новая версия сервис-воркера, и «готово к офлайн» после первой установки. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => void registration.update(), HOUR)
    },
    onRegisterError(error) {
      console.warn('[pwa] регистрация сервис-воркера не удалась', error)
    },
  })

  if (!needRefresh && !offlineReady) return null
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-24 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-zinc-700 bg-zinc-900 p-3 text-sm shadow-xl"
      style={{ width: 'calc(100% - 2rem)' }}
    >
      <span>{needRefresh ? 'Доступна новая версия приложения' : 'Приложение готово к работе офлайн'}</span>
      <span className="flex shrink-0 gap-2">
        {needRefresh && (
          <button type="button" onClick={() => void updateServiceWorker(true)} className="rounded-lg bg-emerald-500 px-3 py-1.5 font-medium text-zinc-950">
            Обновить
          </button>
        )}
        <button
          type="button"
          onClick={() => (needRefresh ? setNeedRefresh(false) : setOfflineReady(false))}
          className="rounded-lg bg-zinc-800 px-3 py-1.5"
        >
          {needRefresh ? 'Позже' : 'Ок'}
        </button>
      </span>
    </div>
  )
}
