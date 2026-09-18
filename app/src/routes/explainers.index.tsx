import { createFileRoute, Link } from '@tanstack/react-router'
import { EXPLAINERS } from '@/explainers/registry'

export const Route = createFileRoute('/explainers/')({
  component: Gallery,
})

function Gallery() {
  return (
    <ul className="grid gap-6 p-8 sm:grid-cols-2">
      {EXPLAINERS.map((e) => (
        <li key={e.id}>
          <Link to="/explainers/$id" params={{ id: e.id }} className="block rounded border border-line p-4 hover:border-teal">
            <e.Thumb />
            <h2 className="mt-3 font-semibold">{e.title}</h2>
            <p className="text-sm text-ink-soft">{e.read}</p>
          </Link>
        </li>
      ))}
    </ul>
  )
}
