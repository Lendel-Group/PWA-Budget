import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus } from 'lucide-react'
import { ColorPicker } from '../ui/ColorPicker'
import { IconPicker } from '../ui/IconPicker'
import { SegmentedControl } from '../ui/SegmentedControl'
import { FormField, SubmitButton } from '../ui/FormField'
import { Sheet } from '../ui/Sheet'
import { inputClass } from '../ui/form'
import { db, type Category } from '../../db/schema'
import { DEFAULT_CATEGORY_IDS } from '../../db/seed'
import { CATEGORY_NAME_MAX, categoriesOfType, categoryFieldErrors, type CategoryField } from '../../domain/categories'
import { cn } from '../../lib/cn'
import { CategoryIcon } from '../../lib/icons'
import { COLOR_CHOICES } from '../../lib/palette'
import { useFormValidation } from '../../lib/useFormValidation'
import { createCategory, deleteCategory, setCategoryArchived, updateCategory } from '../../services/categoryService'

const TYPES: { value: Category['type']; label: string }[] = [
  { value: 'expense', label: 'Расход' },
  { value: 'income', label: 'Доход' },
]

const CATEGORY_FIELD_LABELS: Record<CategoryField, string> = { name: 'название', icon: 'иконка', color: 'цвет' }

/** Добавление (`category` не задана) и редактирование категории. */
function CategorySheet({ category, initialType = 'expense', onClose, onSaved }: {
  category?: Category
  /** Тип новой категории — вкладка, с которой её добавляют (spec/05). */
  initialType?: Category['type']
  onClose: () => void
  /** После создания: тип новой категории — экран открывает её вкладку. */
  onSaved?: (type: Category['type']) => void
}) {
  const [type, setType] = useState<Category['type']>(category?.type ?? initialType)
  const [name, setName] = useState(category?.name ?? '')
  const [icon, setIcon] = useState(category?.icon ?? 'ShoppingBag')
  const [color, setColor] = useState<string>(category?.color ?? COLOR_CHOICES[0].value)
  const [exempt, setExempt] = useState(!!category?.isExcludedFromNoSpend)
  const [error, setError] = useState<string>()
  const existing = useLiveQuery(() => db.categories.toArray(), [])
  const v = useFormValidation(categoryFieldErrors({ name, type, icon, color }, existing ?? [], category?.id))

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
      <FormField label="Название" {...v.field('name')}>
        {(a11y) => <input {...a11y} data-autofocus className={inputClass} value={name} maxLength={CATEGORY_NAME_MAX} onChange={(e) => setName(e.target.value)} placeholder="Подарки" />}
      </FormField>
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
      <SubmitButton
        missing={v.invalid.map((k) => CATEGORY_FIELD_LABELS[k])}
        onClick={() => run(async () => {
          if (category) return updateCategory(category.id, { name, icon, color, isExcludedFromNoSpend: exempt })
          await createCategory({ name, type, icon, color, isExcludedFromNoSpend: exempt })
          onSaved?.(type)
        })}
      >
        {category ? 'Сохранить' : 'Добавить категорию'}
      </SubmitButton>
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
    </Sheet>
  )
}

function CategoryList({ items, onEdit }: { items: Category[]; onEdit: (c: Category) => void }) {
  return (
    <div>
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

const TABS: { value: Category['type']; label: string }[] = [
  { value: 'expense', label: 'Расходы' },
  { value: 'income', label: 'Доходы' },
]

/** Экран «Категории» (spec/05): вкладки «Расходы | Доходы», список открытой вкладки, «+ Добавить категорию». */
export function CategoriesScreen() {
  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const [tab, setTab] = useState<Category['type']>('expense')
  const [sheet, setSheet] = useState<{ category?: Category } | null>(null)
  if (!categories) return null
  const items = categoriesOfType(categories, tab, DEFAULT_CATEGORY_IDS)

  return (
    <div className="space-y-4">
      <SegmentedControl label="Тип категорий" options={TABS} value={tab} onChange={setTab} className="p-1" itemClassName="text-sm" />
      {/* Без заголовка «Расходы» / «Доходы» над списком: тип уже показан выбранной вкладкой */}
      <section aria-label={TABS.find((t) => t.value === tab)?.label} className="rounded-2xl bg-zinc-900 px-4 py-2">
        <CategoryList items={items} onEdit={(category) => setSheet({ category })} />
      </section>
      <button type="button" onClick={() => setSheet({})} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 text-sm text-zinc-300">
        <Plus className="size-4" aria-hidden /> Добавить категорию
      </button>
      <p className="text-xs text-fg-muted">Скрытая категория не предлагается при добавлении операции, но остаётся в истории и бюджете.</p>
      {sheet && (
        <CategorySheet
          key={sheet.category?.id ?? `new-${tab}`}
          category={sheet.category}
          initialType={tab}
          onClose={() => setSheet(null)}
          onSaved={setTab}
        />
      )}
    </div>
  )
}
