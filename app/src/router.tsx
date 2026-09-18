import { createRouter } from '@tanstack/react-router'
import { queryClient } from '@/lib/query-client'
import { routeTree } from './routeTree.gen'

export const router = createRouter({
  routeTree,
  // Available to every route's loader/beforeLoad as `context.queryClient`.
  context: { queryClient },
  defaultPreload: 'intent',
  // TanStack Query owns cache freshness, so don't let the router add its own.
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
  // The tool scrolls inside <main id="pages">, not the window: a push to a
  // new section starts at its top, while Back restores where the reader was.
  scrollToTopSelectors: ['#pages'],
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
