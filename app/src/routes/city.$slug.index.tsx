import { createFileRoute, redirect } from '@tanstack/react-router'

// /city/boston-ma → /city/boston-ma/fundamentals
export const Route = createFileRoute('/city/$slug/')({
  beforeLoad: ({ params, search }) => {
    throw redirect({ to: '/city/$slug/fundamentals', params, search })
  },
})
