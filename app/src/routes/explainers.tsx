import { createFileRoute, Link, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/explainers')({
  component: ExplainersLayout,
})

function ExplainersLayout() {
  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-18 shrink-0 items-center gap-4 border-b border-line px-7 max-narrow:h-14 max-narrow:px-4">
        <Link to="/" className="text-lg font-bold text-teal">
          Cities Tool
        </Link>
        <Link to="/explainers" className="text-sm font-semibold text-ink-soft hover:text-teal">
          Explainers
        </Link>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
