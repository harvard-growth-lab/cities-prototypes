import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'

interface RouterContext {
  queryClient: QueryClient
}

const Devtools = import.meta.env.DEV
  ? lazy(() => import('@/components/devtools'))
  : () => null

// No shared chrome here: the landing and the tool each carry their own
// masthead, as in the prototypes.
export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <TooltipProvider>
      <Outlet />
      <Suspense>
        <Devtools />
      </Suspense>
    </TooltipProvider>
  ),
})
