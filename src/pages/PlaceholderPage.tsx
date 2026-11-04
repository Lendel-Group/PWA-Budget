export function PlaceholderPage({ title }: { title: string }) {
  return (
    <section className="p-4">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-zinc-500">Раздел появится в одной из следующих фаз.</p>
    </section>
  )
}
