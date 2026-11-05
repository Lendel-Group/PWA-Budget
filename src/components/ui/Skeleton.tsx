import { cn } from '../../lib/cn'

/** Блок-заглушка; пульсирует только если пользователь не просил убрать анимацию. */
export function Skeleton({ className }: { className: string }) {
  return <div aria-hidden className={cn('rounded-2xl bg-zinc-900 motion-safe:animate-pulse', className)} />
}

/** Скелетон экрана: одна «живая область» для скринридера и блоки с высотой, близкой к итоговой. */
export function ScreenSkeleton({ blocks, className }: { blocks: string[]; className?: string }) {
  return (
    <section aria-busy="true" aria-label="Загрузка" role="status" className={cn('space-y-4 p-4', className)}>
      {blocks.map((h, i) => <Skeleton key={i} className={h} />)}
    </section>
  )
}
