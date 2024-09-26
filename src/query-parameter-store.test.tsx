import { act, renderHook, waitFor } from '@testing-library/react'
import mockRouter from 'next-router-mock'
import { createDynamicRouteParser } from 'next-router-mock/dynamic-routes'
import { MemoryRouterProvider } from 'next-router-mock/MemoryRouterProvider'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { createQueryParamStore } from './query-parameter-store'

// eslint-disable-next-line global-require
vi.mock('next/router', () => require('next-router-mock'))

mockRouter.useParser(createDynamicRouteParser(['/posts/[id]', '/[dynamic]/path', '/[...catchAll]']))

const schema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().optional(),
  filters: z.array(z.string()).optional(),
})

describe('createQueryParamStore', () => {
  const { useQueryParam, useQueryParams } = createQueryParamStore(schema)

  beforeEach(() => {
    mockRouter.setCurrentUrl('/')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('gets and sets a single parameter', () => {
    const { result } = renderHook(() => useQueryParam('search'), {
      wrapper: MemoryRouterProvider,
    })

    const given = 'test query'

    act(() => {
      result.current[1](given)
    })

    expect(result.current[0]).toBe(given)
    expect(mockRouter.query.search).toBe(given)
  })

  it('gets and sets multiple parameters', async () => {
    const { result } = renderHook(() => useQueryParams(), {
      wrapper: MemoryRouterProvider,
    })

    act(() => {
      result.current[1]({ search: 'test', page: 2 })
    })

    await waitFor(() => {
      expect(result.current[0]).toEqual({ search: 'test', page: 2 })
      expect(mockRouter.query).toEqual({ search: 'test', page: 2 })
    })
  })

  it('validates parameters against the schema', () => {
    const { result } = renderHook(() => useQueryParams(), {
      wrapper: MemoryRouterProvider,
    })

    act(() => {
      result.current[1]({ search: 'test', page: '2', invalidParam: 'value' } as any)
    })

    expect(result.current[0]).toEqual({ search: 'test', page: 2 })
    expect(mockRouter.query).not.toHaveProperty('invalidParam')
  })

  it('handles array parameters correctly', () => {
    const { result } = renderHook(() => useQueryParam('filters'), {
      wrapper: MemoryRouterProvider,
    })

    act(() => {
      result.current[1](['filter1', 'filter2'])
    })

    expect(result.current[0]).toEqual(['filter1', 'filter2'])
    expect(mockRouter.query.filters).toEqual(['filter1', 'filter2'])
  })

  it('uses initial query on server-side', () => {
    const initialQuery = { search: 'initial' }
    const { result } = renderHook(() => useQueryParams(initialQuery), {
      wrapper: MemoryRouterProvider,
    })

    expect(result.current[0]).toEqual(initialQuery)
  })

  it('handles shallow routing', () => {
    vi.spyOn(mockRouter, 'push')
    const { result } = renderHook(() => useQueryParam('search'), {
      wrapper: MemoryRouterProvider,
    })

    act(() => {
      result.current[1]('test', { shallow: true })
    })

    expect(mockRouter.push).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
      expect.objectContaining({ shallow: true }),
    )
  })

  it('handles replace option', () => {
    vi.spyOn(mockRouter, 'replace')
    const { result } = renderHook(() => useQueryParam('search'), {
      wrapper: MemoryRouterProvider,
    })

    act(() => {
      result.current[1]('test', { replace: true })
    })

    expect(mockRouter.replace).toHaveBeenCalled()
  })

  it('preserves existing query parameters', async () => {
    // Set up initial query with an extra parameter
    await mockRouter.push({ pathname: '/', query: { existingParam: 'value' } })

    const { result } = renderHook(() => useQueryParams(), {
      wrapper: MemoryRouterProvider,
    })

    act(() => {
      result.current[1]({ search: 'test' })
    })

    await waitFor(() => {
      expect(mockRouter.query).toEqual({ existingParam: 'value', search: 'test' })
      expect(result.current[0]).toEqual({ search: 'test' })
    })
  })

  it('preserves dynamic route parameters', async () => {
    await mockRouter.push('/posts/123')

    expect(mockRouter).toMatchObject({
      pathname: '/posts/[id]',
      query: { id: '123' },
    })

    const { result } = renderHook(() => useQueryParams(), {
      wrapper: MemoryRouterProvider,
    })

    act(() => {
      result.current[1]({ search: 'test' })
    })

    await waitFor(() => expect(result.current[0]).toHaveProperty('search', 'test'))

    expect(mockRouter.query).toEqual({ id: '123', search: 'test' })
    expect(result.current[0]).toEqual({ search: 'test' })
  })

  it('updates state on external route changes', async () => {
    const { result } = renderHook(() => useQueryParams(), {
      wrapper: MemoryRouterProvider,
    })

    await act(async () => {
      await mockRouter.push({ pathname: '/', query: { search: 'external' } })
    })

    await waitFor(() => {}, { timeout: 5000 })

    expect(result.current[0]).toEqual({ search: 'external' })
  })

  it('minimizes unnecessary re-renders', async () => {
    const renderSpy = vi.fn()
    const { result } = renderHook(
      () => {
        renderSpy()
        return useQueryParams()
      },
      {
        wrapper: MemoryRouterProvider,
      },
    )

    act(() => {
      result.current[1]({ search: 'test' })
    })

    await waitFor(() => {
      expect(result.current[0]).toEqual({ search: 'test' })
    })

    act(() => {
      result.current[1]({ search: 'test' })
    })

    await waitFor(() => {})

    // Expect 5 renders:
    // 1. Initial render
    // 2. After setting the search param
    // 3. After the router update (due to the useEffect in createUseQueryParamStore)
    // 4. After setting the same search param again
    // 5. After the router update (even though the value didn't change)
    expect(renderSpy).toHaveBeenCalledTimes(5)
  })
})

describe('custom router options', () => {
  it('applies custom router options', () => {
    const customOptions = { locale: 'en-US', scroll: false }
    const { useQueryParam } = createQueryParamStore(schema, customOptions)
    vi.spyOn(mockRouter, 'push')

    const { result } = renderHook(() => useQueryParam('search'), {
      wrapper: MemoryRouterProvider,
    })

    act(() => {
      result.current[1]('test')
    })

    expect(mockRouter.push).toHaveBeenCalledWith(expect.anything(), undefined, expect.objectContaining(customOptions))
  })
})
