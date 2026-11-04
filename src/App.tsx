import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db/schema'

export default function App() {
  const categories = useLiveQuery(() => db.categories.count(), [])
  const persisted = useLiveQuery(() => db.config.get('storage_persisted'), [])
  return (
    <main className="mx-auto min-h-screen max-w-md bg-zinc-950 p-4 text-zinc-100">
      <h1 className="text-xl font-semibold">My Budget 2026</h1>
      <p className="mt-2 text-sm text-zinc-400">Категорий: {categories ?? '…'}</p>
      <p className="text-sm text-zinc-400">
        Хранилище: {persisted?.value ? 'защищено от очистки' : 'не гарантировано'}
      </p>
    </main>
  )
}
