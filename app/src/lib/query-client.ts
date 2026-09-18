import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // City-level datasets change rarely; avoid refetch churn while people
      // move between map and chart views.
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
})
