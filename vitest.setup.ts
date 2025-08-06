import { afterAll, beforeAll, vi } from 'vitest'

// Store original console methods
const originalConsoleError = console.error
const originalConsoleWarn = console.warn

beforeAll(() => {
  // Mock console.error to suppress expected Zod validation errors in tests
  console.error = vi.fn((message, ...args) => {
    // Suppress expected Zod validation errors
    if (
      typeof message === 'string' &&
      (message.includes('parseQuery.safeParse') ||
        message.includes('ZodError') ||
        message.includes('createQueryParamStore.store.setQueryParams'))
    ) {
      return
    }
    // Log other errors normally
    originalConsoleError(message, ...args)
  })

  // Mock console.warn to suppress expected warnings
  console.warn = vi.fn((message, ...args) => {
    // Suppress expected warnings
    if (
      typeof message === 'string' &&
      message.includes('createQueryParamStore.store.setQueryParams.serverSideUsageError')
    ) {
      return
    }
    // Log other warnings normally
    originalConsoleWarn(message, ...args)
  })
})

afterAll(() => {
  // Restore original console methods
  console.error = originalConsoleError
  console.warn = originalConsoleWarn
})
