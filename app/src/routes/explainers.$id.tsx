import { createFileRoute, notFound } from '@tanstack/react-router'
import { explainerById } from '@/explainers/registry'

export const Route = createFileRoute('/explainers/$id')({
  // an unknown slug is a 404, not a blank page
  loader: ({ params }) => {
    if (!explainerById(params.id)) throw notFound()
  },
  notFoundComponent: () => <p className="p-8 text-ink-soft">No such explainer.</p>,
  component: ExplainerPage,
})

function ExplainerPage() {
  const { id } = Route.useParams()
  const explainer = explainerById(id)!
  return <explainer.Page />
}
