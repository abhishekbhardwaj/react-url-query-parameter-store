import { ParsedUrlQuery } from 'querystring'

import { act, renderHook, waitFor } from '@testing-library/react'
import mockRouter from 'next-router-mock'
import { createDynamicRouteParser } from 'next-router-mock/dynamic-routes'
import { MemoryRouterProvider } from 'next-router-mock/MemoryRouterProvider'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { createQueryParamStore } from './query-parameter-store'

// eslint-disable-next-line global-require
vi.mock('next/router', () => require('next-router-mock'))

// eslint-disable-next-line sonarjs/no-duplicate-string
mockRouter.useParser(createDynamicRouteParser(['/posts/[id]', '/[dynamic]/path', '/[...catchAll]']))

const schema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().optional(),
  filters: z.array(z.string()).optional(),
})

describe('createQueryParamStore', () => {
  beforeEach(() => {
    mockRouter.setCurrentUrl('/')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('gets and sets a single parameter', () => {
    // Arrange
    const { useQueryParam } = createQueryParamStore(schema)
    const { result } = renderHook(() => useQueryParam('search'), {
      wrapper: MemoryRouterProvider,
    })
    const given = 'test query'

    // Act
    act(() => {
      result.current[1](given)
    })

    // Assert
    expect(result.current[0]).toBe(given)
    expect(mockRouter.query.search).toBe(given)
  })

  it('gets and sets multiple parameters', async () => {
    // Arrange
    const { useQueryParams } = createQueryParamStore(schema)
    const { result } = renderHook(() => useQueryParams(), {
      wrapper: MemoryRouterProvider,
    })

    // Act
    act(() => {
      result.current[1]({ search: 'test', page: 2 })
    })

    // Assert
    await waitFor(() => {
      expect(result.current[0]).toEqual({ search: 'test', page: 2 })
      expect(mockRouter.query).toEqual({ search: 'test', page: 2 })
    })
  })

  it('validates parameters against the schema', () => {
    // Arrange
    const { useQueryParams } = createQueryParamStore(schema)
    const { result } = renderHook(() => useQueryParams(), {
      wrapper: MemoryRouterProvider,
    })

    // Act
    act(() => {
      result.current[1]({ search: 'test', page: '2', invalidParam: 'value' } as any)
    })

    // Assert
    expect(result.current[0]).toEqual({ search: 'test', page: 2 })
    expect(mockRouter.query).not.toHaveProperty('invalidParam')
  })

  it('handles array parameters correctly', () => {
    // Arrange
    const { useQueryParam } = createQueryParamStore(schema)
    const { result } = renderHook(() => useQueryParam('filters'), {
      wrapper: MemoryRouterProvider,
    })

    // Act
    act(() => {
      result.current[1](['filter1', 'filter2'])
    })

    // Assert
    expect(result.current[0]).toEqual(['filter1', 'filter2'])
    expect(mockRouter.query.filters).toEqual(['filter1', 'filter2'])
  })

  it('uses initial query on server-side', () => {
    // Arrange
    const { useQueryParams } = createQueryParamStore(schema)
    const initialQuery = { search: 'initial' }

    // Act
    const { result } = renderHook(() => useQueryParams(initialQuery), {
      wrapper: MemoryRouterProvider,
    })

    // Assert
    expect(result.current[0]).toEqual(initialQuery)
  })

  it('handles shallow routing', () => {
    // Arrange
    const { useQueryParam } = createQueryParamStore(schema)
    vi.spyOn(mockRouter, 'push')
    const { result } = renderHook(() => useQueryParam('search'), {
      wrapper: MemoryRouterProvider,
    })

    // Act
    act(() => {
      result.current[1]('test', { shallow: true })
    })

    // Assert
    expect(mockRouter.push).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
      expect.objectContaining({ shallow: true }),
    )
  })

  it('handles replace option', () => {
    // Arrange
    const { useQueryParam } = createQueryParamStore(schema)
    vi.spyOn(mockRouter, 'replace')
    const { result } = renderHook(() => useQueryParam('search'), {
      wrapper: MemoryRouterProvider,
    })

    // Act
    act(() => {
      result.current[1]('test', { replace: true })
    })

    // Assert
    expect(mockRouter.replace).toHaveBeenCalled()
  })

  it('preserves existing query parameters', async () => {
    // Arrange
    const { useQueryParams } = createQueryParamStore(schema)
    // Set up initial query with an extra parameter
    await mockRouter.push({ pathname: '/', query: { existingParam: 'value' } })
    const { result } = renderHook(() => useQueryParams(), {
      wrapper: MemoryRouterProvider,
    })

    // Act
    act(() => {
      result.current[1]({ search: 'test' })
    })

    // Assert
    await waitFor(() => {
      expect(mockRouter.query).toEqual({ existingParam: 'value', search: 'test' })
      expect(result.current[0]).toEqual({ search: 'test' })
    })
  })

  it('preserves dynamic route parameters', async () => {
    // Arrange
    const { useQueryParams } = createQueryParamStore(schema)
    await mockRouter.push('/posts/123')
    expect(mockRouter).toMatchObject({
      pathname: '/posts/[id]',
      query: { id: '123' },
    })
    const { result } = renderHook(() => useQueryParams(), {
      wrapper: MemoryRouterProvider,
    })

    // Act
    act(() => {
      result.current[1]({ search: 'test' })
    })

    // Assert
    await waitFor(() => expect(result.current[0]).toHaveProperty('search', 'test'))
    expect(mockRouter.query).toEqual({ id: '123', search: 'test' })
    expect(result.current[0]).toEqual({ search: 'test' })
  })

  it('updates state on external route changes', async () => {
    // Arrange
    const { useQueryParams } = createQueryParamStore(schema)
    const { result } = renderHook(() => useQueryParams(), {
      wrapper: MemoryRouterProvider,
    })

    // Act
    await act(async () => {
      await mockRouter.push({ pathname: '/', query: { search: 'external' } })
    })

    // Assert
    await waitFor(() => {}, { timeout: 5000 })
    expect(result.current[0]).toEqual({ search: 'external' })
  })

  it('minimizes unnecessary re-renders', async () => {
    // Arrange
    const { useQueryParams } = createQueryParamStore(schema)
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

    // Act
    act(() => {
      result.current[1]({ search: 'test' })
    })
    await waitFor(() => {
      expect(result.current[0]).toEqual({ search: 'test' })
    })
    act(() => {
      result.current[1]({ search: 'test' })
    })

    // Assert
    // Expect 4 renders:
    // 1. Initial render
    // 2. After setting the search param
    // 3. After the router update (due to the useEffect in createUseQueryParamStore)
    // 4. After the debounced router push completes
    expect(renderSpy).toHaveBeenCalledTimes(4)

    // Reset the spy count
    renderSpy.mockClear()

    // Act again with the same value
    act(() => {
      result.current[1]({ search: 'test' })
    })
    await waitFor(() => {
      expect(result.current[0]).toEqual({ search: 'test' })
    })

    // Assert again
    // Expect 1 additional render when setting the same value:
    // The hook still triggers a render due to the state update,
    // but skips the router update due to value equality check
    expect(renderSpy).toHaveBeenCalledTimes(1)

    // Reset the spy count again
    renderSpy.mockClear()

    // Act with a different value
    act(() => {
      result.current[1]({ search: 'test1' })
    })
    await waitFor(() => {
      expect(result.current[0]).toEqual({ search: 'test1' })
    })

    // Assert once more
    // Expect 2 additional renders when setting a different value:
    // 1. After setting the new search param
    // 2. After the router update
    expect(renderSpy).toHaveBeenCalledTimes(2)
  })

  it('handles errors when logErrorsToConsole is true', () => {
    // Arrange
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { useQueryParams } = createQueryParamStore(schema, { logErrorsToConsole: true })
    const { result } = renderHook(() => useQueryParams(), {
      wrapper: MemoryRouterProvider,
    })

    // Act
    act(() => {
      result.current[1]({ search: false } as any)
    })

    // Assert
    expect(consoleErrorSpy).toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })

  it('handles complex schemas', () => {
    // Arrange
    const complexSchema = z.object({
      nested: z.object({
        value: z.number(),
      }),
      arrayParam: z.array(z.string()),
      optionalParam: z.string().optional(),
    })
    const { useQueryParams } = createQueryParamStore(complexSchema)
    const { result } = renderHook(() => useQueryParams(), {
      wrapper: MemoryRouterProvider,
    })

    // Act
    act(() => {
      result.current[1]({
        nested: { value: 42 },
        arrayParam: ['a', 'b'],
        optionalParam: 'test',
      })
    })

    // Assert
    expect(result.current[0]).toEqual({
      nested: { value: 42 },
      arrayParam: ['a', 'b'],
      optionalParam: 'test',
    })
  })

  it('works with catch-all routes', async () => {
    // Arrange
    await mockRouter.push('/catch/all/route')
    const { useQueryParams } = createQueryParamStore(schema)
    const { result } = renderHook(() => useQueryParams(), {
      wrapper: MemoryRouterProvider,
    })

    // Act
    act(() => {
      result.current[1]({ search: 'test' })
    })

    // Assert
    expect(mockRouter.query).toEqual(
      expect.objectContaining({
        catchAll: ['catch', 'all', 'route'],
        search: 'test',
      }),
    )
  })

  it('handles invalid initial queries', () => {
    // Arrange
    const invalidInitialQuery = { invalidParam: 'value' }
    const { useQueryParams } = createQueryParamStore(schema)

    // Act
    const { result } = renderHook(() => useQueryParams(invalidInitialQuery as any), {
      wrapper: MemoryRouterProvider,
    })

    // Assert
    expect(result.current[0]).toEqual({})
  })

  it('correctly infers and updates single param with useQueryParam', () => {
    // Arrange
    const { useQueryParam } = createQueryParamStore(schema)
    const { result } = renderHook(() => useQueryParam('page'), {
      wrapper: MemoryRouterProvider,
    })

    // Act
    act(() => {
      result.current[1](5)
    })

    // Assert
    expect(result.current[0]).toBe(5)
  })

  it('applies custom router options', () => {
    // Arrange
    const customOptions = { locale: 'en-US', scroll: false }
    const { useQueryParam } = createQueryParamStore(schema, customOptions)
    vi.spyOn(mockRouter, 'push')
    const { result } = renderHook(() => useQueryParam('search'), {
      wrapper: MemoryRouterProvider,
    })

    // Act
    act(() => {
      result.current[1]('test')
    })

    // Assert
    expect(mockRouter.push).toHaveBeenCalledWith(expect.anything(), undefined, expect.objectContaining(customOptions))
  })

  it('prioritizes Zod defaults over initialQuery', async () => {
    // Arrange
    const schemaWithDefaults = z.object({
      page: z.coerce.number().default(1),
      limit: z.coerce.number().default(10),
      search: z.string().optional(),
    })

    const { useQueryParams } = createQueryParamStore(schemaWithDefaults)
    const initialQuery = { search: 'initial' } as ParsedUrlQuery

    // Act
    const { result } = renderHook(() => useQueryParams(initialQuery), {
      wrapper: MemoryRouterProvider,
    })

    // Assert
    await waitFor(() => {
      expect(result.current[0]).toEqual({
        page: 1, // Zod default is applied
        limit: 10, // Zod default is applied
        search: 'initial', // initialQuery value is used
      })
    })

    // Act: Update the URL
    await act(async () => {
      await mockRouter.push({ query: { page: '3', search: 'updated' } })
    })

    // Assert: Check that URL values take precedence
    await waitFor(() => {
      expect(result.current[0]).toEqual({
        page: 3, // URL value
        limit: 10, // Zod default is still applied
        search: 'updated', // URL value
      })
    })
  })

  it('sets initial query in both route and internal state', async () => {
    // Arrange
    const { useQueryParams } = createQueryParamStore(schema)
    const initialQuery = { search: 'initial', page: '2' } as ParsedUrlQuery
    const expectedQuery = { search: 'initial', page: 2 }

    // Act
    const { result } = renderHook(() => useQueryParams(initialQuery), {
      wrapper: MemoryRouterProvider,
    })

    // Assert
    await waitFor(() => {
      // Check internal state
      expect(result.current[0]).toEqual(expectedQuery)
      // Check router state
      expect(mockRouter.query).toEqual(expect.objectContaining(expectedQuery))
    })
  })

  it('preserves non-schema query parameters when setting new parameters', async () => {
    // Arrange
    const { useQueryParams } = createQueryParamStore(schema)
    // Set up initial query with a non-schema parameter
    await mockRouter.push({ pathname: '/', query: { nonSchemaParam: 'value' } })
    const { result } = renderHook(() => useQueryParams(), {
      wrapper: MemoryRouterProvider,
    })

    // Act
    act(() => {
      result.current[1]({ search: 'test' })
    })

    // Assert
    await waitFor(() => {
      expect(mockRouter.query).toEqual({ nonSchemaParam: 'value', search: 'test' })
      expect(result.current[0]).toEqual({ search: 'test' })
    })
  })

  it('preserves dynamic route parameters when setting new parameters', async () => {
    // Arrange
    const { useQueryParams } = createQueryParamStore(schema)
    // Set up initial route with dynamic parameters
    await mockRouter.push('/posts/123?existingParam=value')
    expect(mockRouter).toMatchObject({
      pathname: '/posts/[id]',
      query: { id: '123', existingParam: 'value' },
    })
    const { result } = renderHook(() => useQueryParams(), {
      wrapper: MemoryRouterProvider,
    })

    // Act
    act(() => {
      result.current[1]({ search: 'test' })
    })

    // Assert
    await waitFor(() => {
      expect(mockRouter.query).toEqual({ id: '123', existingParam: 'value', search: 'test' })
      expect(result.current[0]).toEqual({ search: 'test' })
    })
  })

  it('preserves existing route parameters when initial parameters are provided', async () => {
    // Arrange
    const { useQueryParams } = createQueryParamStore(schema)
    const initialQuery = { search: 'initial', page: '2' } as ParsedUrlQuery

    // Set up initial route with existing parameters not in the schema
    await mockRouter.push({ pathname: '/', query: { existingParam: 'value', anotherParam: '123' } })

    const { result } = renderHook(() => useQueryParams(initialQuery), {
      wrapper: MemoryRouterProvider,
    })

    // Assert
    await waitFor(() => {
      expect(mockRouter.query).toEqual({
        existingParam: 'value',
        anotherParam: '123',
        search: 'initial',
        page: 2,
      })
      expect(result.current[0]).toEqual({
        search: 'initial',
        page: 2,
      })
    })
  })
})
