import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus } from 'lucide-react'
import { ColorPicker } from '../ui/ColorPicker'
import { IconPicker } from '../ui/IconPicker'
import { SegmentedControl } from '../ui/SegmentedControl'
import { Field, Sheet } from '../ui/Sheet'
import { inputClass, primaryButton } from '../ui/form'
import { db, type Category } from '../../db/schema'
import { DEFAULT_CATEGORY_IDS } from '../../db/seed'
import { CATEGORY_NAME_MAX, sortByDefaultOrder } from '../../domain/categories'
import { cn } from '../../lib/cn'
import { CategoryIcon } from '../../lib/icons'
import { COLOR_CHOICES } from '../../lib/palette'
import { createCategory, deleteCategory, setCategoryArchived, updateCategory } from '../../services/categoryService'

const TYPES: { value: Category['type']; label: string }[] = [
  { value: 'expense', label: 'Расход' },
  { value: 'income', label: 'Доход' },
]

/** Добавление (`category` не задана) и редактирование категории. */
function CategorySheet({ category, onClose }: { category?: Category; onClose: () => void }) {
  const [type, setType] = useState<Category['type']>(category?.type ?? 'expense')
  const [name, setName] = useState(category?.name ?? '')
  const [icon, setIcon] = useState(category?.icon ?? 'ShoppingBag')
  const [color, setColor] = useState<string>(category?.color ?? COLOR_CHOICES[0].value)
  const [exempt, setExempt] = useState(!!category?.isExcludedFromNoSpend)
  const [error, setError] = useState<string>()

  async function run(action: () => Promise<unknown>) {
    setError(undefined)
    try {
      await action()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось выполнить действие')
    }
  }

  const archived = !!category?.isArchived
  return (
    <Sheet title={category ? 'Категория' : 'Новая категория'} onClose={onClose}>
      {!category && <SegmentedControl label="Тип категории" options={TYPES} value={type} onChange={setType} className="p-1" itemClassName="text-sm" />}
      <Field label="Название">
        <input className={inputClass} value={name} maxLength={CATEGORY_NAME_MAX} onChange={(e) => setName(e.target.value)} placeholder="Подарки" />
      </Field>
      <div className="space-y-1">
        <p className="text-xs text-fg-muted">Иконка</p>
        <IconPicker value={icon} onChange={setIcon} color={color} />
      </div>
      <div className="space-y-1">
        <p className="text-xs text-fg-muted">Цвет</p>
        <ColorPicker choices={COLOR_CHOICES} value={color} onChange={setColor} />
      </div>
      {type === 'expense' && (
        <label className="flex items-center justify-between gap-3 rounded-xl bg-zinc-900 px-3 py-2 text-sm">
          <span>
            Не нарушает дни без трат
            <span className="block text-xs text-fg-muted">Расходы в этой категории не прерывают серию. Для коммуналки, кредита, аренды.</span>
          </span>
          <input type="checkbox" checked={exempt} onChange={(e) => setExempt(e.target.checked)} className="size-5 shrink-0 accent-[var(--color-accent)]" />
        </label>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button
        type="button"
        className={primaryButton}
        onClick={() => run(() => (category ? updateCategory(category.id, { name, icon, color, isExcludedFromNoSpend: exempt }) : createCategory({ name, type, icon, color, isExcludedFromNoSpend: exempt })))}
      >
        {category ? 'Сохранить' : 'Добавить категорию'}
      </button>
      {category && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="min-h-11 rounded-xl bg-zinc-900 text-sm font-medium text-zinc-200"
            onClick={() => run(() => setCategoryArchived(category.id, !archived))}
          >
            {archived ? 'Вернуть' : 'Скрыть'}
          </button>
          {!category.isDefault && (
            <button
              type="button"
              className="min-h-11 rounded-xl bg-danger/15 text-sm font-medium text-danger active:bg-danger/25"
              onClick={() => run(() => deleteCategory(category.id))}
            >
              Удалить
            </button>
          )}
        </div>
      )}
      {category && <p className="text-xs text-fg-muted">Скрытая категория не предлагается при добавлении операции, но остаётся в истории и бюджете.</p>}
    </Sheet>
  )
}

function CategoryList({ title, items, onEdit }: { title: string; items: Category[]; onEdit: (c: Category) => void }) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-fg-muted">{title}</h3>
      <ul className="divide-y divide-zinc-800">
        {items.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onEdit(c)}
              aria-label={`${c.name}${c.isArchived ? ' (скрыта)' : ''}: изменить`}
              className={cn('flex min-h-14 w-full items-center gap-3 py-2 text-left', c.isArchived && 'opacity-50')}
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full" style={{ background: `${c.color}33`, color: c.color }}>
                <CategoryIcon name={c.icon} className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{c.name}</span>
                {c.isExcludedFromNoSpend && <span className="block truncate text-xs text-fg-muted">не нарушает дни без трат</span>}
              </span>
              {c.isArchived && <span className="shrink-0 text-xs text-fg-muted">скрыта</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function CategoriesSection() {
  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const [sheet, setSheet] = useState<{ category?: Category } | null>(null)
  if (!categories) return null
  const sorted = sortByDefaultOrder(categories, DEFAULT_CATEGORY_IDS)
  // Скрытые — в конце своего списка
  const byType = (type: Category['type']) => {
    const list = sorted.filter((c) => c.type === type)
    return [...list.filter((c) => !c.isArchived), ...list.filter((c) => c.isArchived)]
  }

  return (
    <section aria-labelledby="categories-h" className="space-y-3 rounded-2xl bg-zinc-900 p-4">
      <h2 id="categories-h" className="font-medium">Категории</h2>
      <CategoryList title="Расходы" items={byType('expense')} onEdit={(category) => setSheet({ category })} />
      <CategoryList title="Доходы" items={byType('income')} onEdit={(category) => setSheet({ category })} />
      <button type="button" onClick={() => setSheet({})} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 text-sm text-zinc-300">
        <Plus className="size-4" aria-hidden /> Добавить категорию
      </button>
      {sheet && <CategorySheet key={sheet.category?.id ?? 'new'} category={sheet.category} onClose={() => setSheet(null)} />}
    </section>
  )
}
