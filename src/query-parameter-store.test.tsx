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

  describe('Basic Operations', () => {
    describe('Single Parameter', () => {
      it('gets and sets a single parameter', async () => {
        // Arrange
        const { useQueryParam } = createQueryParamStore(schema)
        const { result } = renderHook(() => useQueryParam('search'), {
          wrapper: MemoryRouterProvider,
        })
        const given = 'test query'

        // Act
        await act(async () => {
          await result.current[1](given)
        })

        // Assert
        expect(result.current[0]).toBe(given)
        expect(mockRouter.query.search).toBe(given)
      })

      it('correctly infers and updates single param with useQueryParam', async () => {
        // Arrange
        const { useQueryParam } = createQueryParamStore(schema)
        const { result } = renderHook(() => useQueryParam('page'), {
          wrapper: MemoryRouterProvider,
        })

        // Act
        await act(async () => {
          await result.current[1](5)
        })

        // Assert
        expect(result.current[0]).toBe(5)
      })
    })

    describe('Multiple Parameters', () => {
      it('gets and sets multiple parameters', async () => {
        // Arrange
        const { useQueryParams } = createQueryParamStore(schema)
        const { result } = renderHook(() => useQueryParams(), {
          wrapper: MemoryRouterProvider,
        })

        // Act
        await act(async () => {
          await result.current[1]({ search: 'test', page: 2 })
        })

        // Assert
        await waitFor(() => {
          expect(result.current[0]).toEqual({ search: 'test', page: 2 })
          expect(mockRouter.query).toEqual({ search: 'test', page: 2 })
        })
      })

      it('handles array parameters correctly', async () => {
        // Arrange
        const { useQueryParam } = createQueryParamStore(schema)
        const { result } = renderHook(() => useQueryParam('filters'), {
          wrapper: MemoryRouterProvider,
        })

        // Act
        await act(async () => {
          await result.current[1](['filter1', 'filter2'])
        })

        // Assert
        expect(result.current[0]).toEqual(['filter1', 'filter2'])
        expect(mockRouter.query.filters).toEqual(['filter1', 'filter2'])
      })
    })
  })

  describe('Schema Validation', () => {
    it('validates parameters against the schema', async () => {
      // Arrange
      const { useQueryParams } = createQueryParamStore(schema)
      const { result } = renderHook(() => useQueryParams(), {
        wrapper: MemoryRouterProvider,
      })

      // Act
      await act(async () => {
        await result.current[1]({ search: 'test', page: '2', invalidParam: 'value' } as any)
      })

      // Assert
      expect(result.current[0]).toEqual({ search: 'test', page: 2 })
      expect(mockRouter.query).not.toHaveProperty('invalidParam')
    })

    it('handles complex schemas', async () => {
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
      await act(async () => {
        await result.current[1]({
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

    describe('Edge Cases', () => {
      it('handles schema that cannot parse empty object', async () => {
        // Given
        const strictSchema = z.object({
          required: z.string().min(1), // Required field
          optional: z.string().optional(),
        })

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const { useQueryParams } = createQueryParamStore(strictSchema, { logErrorsToConsole: true })

        // When
        const { result } = renderHook(() => useQueryParams(), {
          wrapper: MemoryRouterProvider,
        })

        // Then - Should fallback to empty object
        expect(result.current[0]).toEqual({})
        expect(consoleErrorSpy).toHaveBeenCalled()

        consoleErrorSpy.mockRestore()
      })

      it('handles invalid params with schema validation', async () => {
        // Given
        const typedSchema = z.object({
          count: z.number().min(0).max(100),
          status: z.enum(['active', 'inactive']),
        })

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const { useQueryParams } = createQueryParamStore(typedSchema, { logErrorsToConsole: true })

        const { result } = renderHook(() => useQueryParams(), {
          wrapper: MemoryRouterProvider,
        })

        // When - Try to set invalid values
        const success = await act(async () => {
          return result.current[1]({
            count: 150, // Over max
            status: 'pending' as any, // Invalid enum
          })
        })

        // Then
        expect(success).toBe(false)
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'createQueryParamStore.store.setQueryParams.newParamsDoNotMatchSchema',
          expect.anything(),
        )

        consoleErrorSpy.mockRestore()
      })
    })
  })

  describe('Router Integration', () => {
    describe('Navigation Options', () => {
      it('handles shallow routing', async () => {
        // Arrange
        const { useQueryParam } = createQueryParamStore(schema)
        vi.spyOn(mockRouter, 'push')
        const { result } = renderHook(() => useQueryParam('search'), {
          wrapper: MemoryRouterProvider,
        })

        // Act
        await act(async () => {
          await result.current[1]('test', { shallow: true })
        })

        // Assert
        expect(mockRouter.push).toHaveBeenCalledWith(
          expect.anything(),
          undefined,
          expect.objectContaining({ shallow: true }),
        )
      })

      it('handles replace option', async () => {
        // Arrange
        const { useQueryParam } = createQueryParamStore(schema)
        vi.spyOn(mockRouter, 'replace')
        const { result } = renderHook(() => useQueryParam('search'), {
          wrapper: MemoryRouterProvider,
        })

        // Act
        await act(async () => {
          await result.current[1]('test', { replace: true })
        })

        // Assert
        expect(mockRouter.replace).toHaveBeenCalled()
      })

      it('applies custom router options', async () => {
        // Arrange
        const customOptions = { locale: 'en-US', scroll: false }
        const { useQueryParam } = createQueryParamStore(schema, customOptions)
        vi.spyOn(mockRouter, 'push')
        const { result } = renderHook(() => useQueryParam('search'), {
          wrapper: MemoryRouterProvider,
        })

        // Act
        await act(async () => {
          await result.current[1]('test')
        })

        // Assert
        expect(mockRouter.push).toHaveBeenCalledWith(
          expect.anything(),
          undefined,
          expect.objectContaining(customOptions),
        )
      })
    })

    describe('Pathname Option', () => {
      it('passes pathname to router.push', async () => {
        // Given
        const { useQueryParams } = createQueryParamStore(schema)
        vi.spyOn(mockRouter, 'push')
        const { result } = renderHook(() => useQueryParams(), {
          wrapper: MemoryRouterProvider,
        })

        // When
        await act(async () => {
          await result.current[1]({ search: 'test' }, { pathname: '/new-page' })
        })

        // Then - pathname option is passed to router.push
        expect(mockRouter.push).toHaveBeenCalledWith(
          expect.objectContaining({
            pathname: '/new-page',
            query: expect.objectContaining({ search: 'test' }),
          }),
          undefined,
          expect.anything(),
        )
      })

      it('supports pathname in clearQueryParams', async () => {
        // Given
        const { clearQueryParams } = createQueryParamStore(schema)
        vi.spyOn(mockRouter, 'push')
        await mockRouter.push({ pathname: '/original', query: { search: 'test', page: '2' } })

        // When
        await act(async () => {
          await clearQueryParams(undefined, { pathname: '/cleared' })
        })

        // Then - The last call should have the pathname option
        expect(mockRouter.push).toHaveBeenLastCalledWith(
          expect.objectContaining({
            pathname: '/cleared',
          }),
          undefined,
          expect.objectContaining({ shallow: true }),
        )
      })
    })

    describe('Locale Option', () => {
      it('passes locale to router.push', async () => {
        // Given
        const { useQueryParams } = createQueryParamStore(schema)
        vi.spyOn(mockRouter, 'push')
        const { result } = renderHook(() => useQueryParams(), {
          wrapper: MemoryRouterProvider,
        })

        // When
        await act(async () => {
          await result.current[1]({ search: 'test' }, { locale: 'fr' })
        })

        // Then
        expect(mockRouter.push).toHaveBeenCalledWith(
          expect.anything(),
          undefined,
          expect.objectContaining({ locale: 'fr' }),
        )
      })

      it('passes locale from global options', async () => {
        // Given
        const { useQueryParams } = createQueryParamStore(schema, { locale: 'de' })
        vi.spyOn(mockRouter, 'push')
        const { result } = renderHook(() => useQueryParams(), {
          wrapper: MemoryRouterProvider,
        })

        // When
        await act(async () => {
          await result.current[1]({ search: 'test' })
        })

        // Then
        expect(mockRouter.push).toHaveBeenCalledWith(
          expect.anything(),
          undefined,
          expect.objectContaining({ locale: 'de' }),
        )
      })
    })

    describe('Scroll Option', () => {
      it('controls scroll behavior on navigation', async () => {
        // Given
        const { useQueryParams } = createQueryParamStore(schema)
        vi.spyOn(mockRouter, 'push')
        const { result } = renderHook(() => useQueryParams(), {
          wrapper: MemoryRouterProvider,
        })

        // When
        await act(async () => {
          await result.current[1]({ search: 'test' }, { scroll: false })
        })

        // Then
        expect(mockRouter.push).toHaveBeenCalledWith(
          expect.anything(),
          undefined,
          expect.objectContaining({ scroll: false }),
        )
      })

      it('uses scroll from global options', async () => {
        // Given
        const { useQueryParams } = createQueryParamStore(schema, { scroll: false })
        vi.spyOn(mockRouter, 'push')
        const { result } = renderHook(() => useQueryParams(), {
          wrapper: MemoryRouterProvider,
        })

        // When
        await act(async () => {
          await result.current[1]({ search: 'test' })
        })

        // Then
        expect(mockRouter.push).toHaveBeenCalledWith(
          expect.anything(),
          undefined,
          expect.objectContaining({ scroll: false }),
        )
      })
    })
  })

  describe('State Management', () => {
    describe('Preservation', () => {
      it('preserves existing query parameters', async () => {
        // Arrange
        const { useQueryParams } = createQueryParamStore(schema)
        // Set up initial query with an extra parameter
        await mockRouter.push({ pathname: '/', query: { existingParam: 'value' } })
        const { result } = renderHook(() => useQueryParams(), {
          wrapper: MemoryRouterProvider,
        })

        // Act
        await act(async () => {
          await result.current[1]({ search: 'test' })
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
        await act(async () => {
          await result.current[1]({ search: 'test' })
        })

        // Assert
        await waitFor(() => expect(result.current[0]).toHaveProperty('search', 'test'))
        expect(mockRouter.query).toEqual({ id: '123', search: 'test' })
        expect(result.current[0]).toEqual({ search: 'test' })
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
        await act(async () => {
          await result.current[1]({ search: 'test' })
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
        await act(async () => {
          await result.current[1]({ search: 'test' })
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

    describe('Synchronization', () => {
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

      it('does not cause infinite loops when state and router query are updated simultaneously', async () => {
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

        // Act: Simulate simultaneous state and router updates
        await act(async () => {
          await result.current[1]({ search: 'test1' })
          await mockRouter.push({ query: { search: 'test2' } })
        })

        // Assert: Ensure that re-renders do not exceed a reasonable number
        expect(renderSpy.mock.calls.length).toBeLessThan(5)
      })
    })

    describe('Multiple Instances', () => {
      it('allows multiple instances to operate independently', async () => {
        // Arrange
        const schema1 = z.object({ param1: z.string().optional() })
        const schema2 = z.object({ param2: z.string().optional() })
        const { useQueryParams: useQueryParams1 } = createQueryParamStore(schema1)
        const { useQueryParams: useQueryParams2 } = createQueryParamStore(schema2)

        const { result: result1 } = renderHook(() => useQueryParams1(), { wrapper: MemoryRouterProvider })
        const { result: result2 } = renderHook(() => useQueryParams2(), { wrapper: MemoryRouterProvider })

        // Act
        await act(async () => {
          await result1.current[1]({ param1: 'value1' })
          await result2.current[1]({ param2: 'value2' })
        })

        // Assert
        expect(result1.current[0]).toEqual({ param1: 'value1' })
        expect(result2.current[0]).toEqual({ param2: 'value2' })
        expect(mockRouter.query).toEqual({ param1: 'value1', param2: 'value2' })
      })
    })
  })

  describe('Performance', () => {
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
      await act(async () => {
        await result.current[1]({ search: 'test' })
      })

      await waitFor(() => {
        expect(result.current[0]).toEqual({ search: 'test' })
      })

      await act(async () => {
        await result.current[1]({ search: 'test' })
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
      await act(async () => {
        await result.current[1]({ search: 'test' })
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
      await act(async () => {
        await result.current[1]({ search: 'test1' })
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

    describe('Debouncing', () => {
      it('cancels debounced setQueryParams on unmount', async () => {
        const { useQueryParams } = createQueryParamStore(schema)

        const { result, unmount } = renderHook(() => useQueryParams(), {
          wrapper: MemoryRouterProvider,
        })

        // Trigger a debounced update
        await act(async () => {
          await result.current[1]({ search: 'test' })
        })

        // Unmount should cancel any pending debounced calls
        unmount()

        // Verify no additional router updates happen after unmount
        const queryBefore = { ...mockRouter.query }
        // eslint-disable-next-line no-promise-executor-return
        await new Promise((resolve) => setTimeout(resolve, 400)) // Wait past debounce delay
        expect(mockRouter.query).toEqual(queryBefore)
      })
    })
  })

  describe('SSR and Initialization', () => {
    describe('Initial Query', () => {
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

      it('uses initial query on server for getSnapshot', () => {
        // Given
        const { useQueryParams } = createQueryParamStore(schema)
        const initialQuery = { search: 'server-value', page: '5' }

        // When
        const { result } = renderHook(() => useQueryParams(initialQuery), {
          wrapper: MemoryRouterProvider,
        })

        // Then
        expect(result.current[0]).toEqual({ search: 'server-value', page: 5 })
      })
    })

    describe('Default Values', () => {
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

      it('sets default query parameters in URL when not initially available', async () => {
        // Arrange
        const schemaWithDefaults = z.object({
          search: z.string().default('defaultSearch'),
          page: z.coerce.number().default(1),
          filters: z.array(z.string()).default(['defaultFilter']),
        })
        const { useQueryParams } = createQueryParamStore(schemaWithDefaults)

        // Act
        const { result } = renderHook(() => useQueryParams(), {
          wrapper: MemoryRouterProvider,
        })

        // Assert
        await waitFor(() => {
          expect(result.current[0]).toEqual({
            search: 'defaultSearch',
            page: 1,
            filters: ['defaultFilter'],
          })
          expect(mockRouter.query).toEqual({
            search: 'defaultSearch',
            page: 1,
            filters: ['defaultFilter'],
          })
        })
      })
    })

    describe('Hydration', () => {
      it('correctly synchronizes initial SSR state with client state', async () => {
        // Arrange
        const schemaWithDefault = z.object({
          status: z.string().default('all'),
          search: z.string().optional(),
        })
        const { useQueryParams } = createQueryParamStore(schemaWithDefault)

        // Simulate SSR by setting initial router state
        await mockRouter.push({ query: { status: 'draft' } })

        // Act
        const { result } = renderHook(() => useQueryParams(), {
          wrapper: MemoryRouterProvider,
        })

        // Assert
        await waitFor(() => {
          // Changed expectation to match the schema definition
          expect(result.current[0]).toEqual({ status: 'draft' })
          expect(mockRouter.query.status).toBe('draft')
        })
      })

      it('maintains router query value over default value during initialization', async () => {
        // Arrange
        const schemaWithDefault = z.object({
          status: z.string().default('all'),
        })
        const { useQueryParams } = createQueryParamStore(schemaWithDefault)

        // Set initial router state
        await mockRouter.push({ query: { status: 'draft' } })

        // Act
        const { result } = renderHook(() => useQueryParams(), {
          wrapper: MemoryRouterProvider,
        })

        // Assert
        await waitFor(() => {
          expect(result.current[0].status).toBe('draft')
        })

        // Update the value
        await act(async () => {
          await result.current[1]({ status: 'sent' })
        })

        // Assert the update worked
        await waitFor(() => {
          expect(result.current[0].status).toBe('sent')
        })
      })

      it('handles initialization order correctly with multiple sources', async () => {
        // Arrange
        const customSchema = z.object({
          status: z.string().default('all'),
          search: z.string().optional(),
        })

        const { useQueryParams } = createQueryParamStore(customSchema)

        // Set up different values from different sources
        const initialQuery = { status: 'initial' } as ParsedUrlQuery
        await mockRouter.push({ query: { status: 'router' } })

        // Act
        const { result } = renderHook(() => useQueryParams(initialQuery), {
          wrapper: MemoryRouterProvider,
        })

        // Assert - router query should take precedence
        await waitFor(() => {
          expect(result.current[0].status).toBe('router')
        })
      })

      it('preserves SSR values during hydration', async () => {
        // Arrange
        const customSchema = z.object({
          status: z.string(),
          search: z.string().optional(),
        })
        const { useQueryParams } = createQueryParamStore(customSchema)
        const ssrQuery = { status: 'sent', search: '' }

        // Act
        const { result } = renderHook(() => useQueryParams(ssrQuery), {
          wrapper: MemoryRouterProvider,
        })

        // Assert
        expect(result.current[0]).toEqual(ssrQuery)

        // Simulate client-side navigation
        await act(async () => {
          await mockRouter.push({ query: { status: 'draft' } })
        })

        // Check that new values are reflected
        await waitFor(() => {
          expect(result.current[0]).toEqual({ status: 'draft', search: '' })
        })
      })

      it('maintains query param order during initialization', async () => {
        // Arrange
        const customSchema = z.object({
          status: z.string().default('all'),
          search: z.string().optional(),
        })
        const { useQueryParams } = createQueryParamStore(customSchema)

        // Set up competing values
        const ssrQuery = { status: 'ssr', search: 'ssr-search' }
        await mockRouter.push({ query: { status: 'client', search: 'client-search' } })

        // Act
        const { result } = renderHook(() => useQueryParams(ssrQuery), {
          wrapper: MemoryRouterProvider,
        })

        // Assert - client values should take precedence
        await waitFor(() => {
          expect(result.current[0]).toEqual({
            status: 'client',
            search: 'client-search',
          })
        })
      })
    })

    describe('Redirects', () => {
      it('handles redirect scenarios correctly', async () => {
        // Arrange
        const customSchema = z.object({
          status: z.string(),
          page: z.string().optional(),
        })
        const { useQueryParams } = createQueryParamStore(customSchema)
        const initialQuery = { status: 'initial' }

        // Act - simulate a redirect scenario
        const { result, rerender } = renderHook(() => useQueryParams(initialQuery), {
          wrapper: MemoryRouterProvider,
        })

        // Simulate redirect by changing router query
        await act(async () => {
          await mockRouter.push({ query: { status: 'redirected', page: '2' } })
        })

        // Force rerender to simulate redirect completion
        rerender()

        // Assert
        await waitFor(() => {
          expect(result.current[0]).toEqual({ status: 'redirected', page: '2' })
        })
      })
    })

    describe('Reset Initialization', () => {
      it('maintains first initialization as documented', () => {
        // Given
        const { useQueryParams } = createQueryParamStore(schema)

        // When - First mount with initial query
        const { result, unmount } = renderHook(() => useQueryParams({ search: 'initial' }), {
          wrapper: MemoryRouterProvider,
        })

        // Then
        expect(result.current[0]).toEqual({ search: 'initial' })

        // When - Unmount and remount with different initial
        unmount()

        const { result: result2 } = renderHook(() => useQueryParams({ search: 'different' }), {
          wrapper: MemoryRouterProvider,
        })

        // Then - Store maintains first initialization as per documentation
        // Initial params are only used on first initialization
        expect(result2.current[0]).toEqual({ search: 'initial' })
      })
    })
  })

  describe('Server-Side Behavior', () => {
    it('warns when setQueryParams is called server-side', async () => {
      // Given
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { useQueryParams } = createQueryParamStore(schema, { logErrorsToConsole: true })

      // Render hook first while window exists
      const { result } = renderHook(() => useQueryParams(), {
        wrapper: MemoryRouterProvider,
      })

      // Mock server environment after rendering
      const originalWindow = global.window
      vi.stubGlobal('window', undefined)

      // When
      const success = await result.current[1]({ search: 'test' })

      // Then
      expect(success).toBe(false)
      expect(consoleWarnSpy).toHaveBeenCalledWith('createQueryParamStore.store.setQueryParams.serverSideUsageError')

      // Restore
      vi.unstubAllGlobals()
      global.window = originalWindow
      consoleWarnSpy.mockRestore()
    })

    it('returns false when clearQueryParams is called server-side', async () => {
      // Given
      const { clearQueryParams } = createQueryParamStore(schema)

      // Mock server environment
      const originalWindow = global.window
      vi.stubGlobal('window', undefined)

      // When
      const result = await clearQueryParams()

      // Then
      expect(result).toBe(false)

      // Restore
      vi.unstubAllGlobals()
      global.window = originalWindow
    })
  })

  describe('Router State', () => {
    it('handles the case when router is not ready', () => {
      // Arrange
      const { useQueryParams } = createQueryParamStore(schema)
      // eslint-disable-next-line global-require
      const useRouterMock = vi.spyOn(require('next/router'), 'useRouter')
      useRouterMock.mockReturnValue({ isReady: false })

      // Act
      const { result } = renderHook(() => useQueryParams(), {
        wrapper: MemoryRouterProvider,
      })

      // Assert
      expect(result.current[0]).toEqual({}) // Should return default/empty state
      // Clean up
      useRouterMock.mockRestore()
    })

    it('works with catch-all routes', async () => {
      // Arrange
      await mockRouter.push('/catch/all/route')
      const { useQueryParams } = createQueryParamStore(schema)
      const { result } = renderHook(() => useQueryParams(), {
        wrapper: MemoryRouterProvider,
      })

      // Act
      await act(async () => {
        await result.current[1]({ search: 'test' })
      })

      // Assert
      expect(mockRouter.query).toEqual(
        expect.objectContaining({
          catchAll: ['catch', 'all', 'route'],
          search: 'test',
        }),
      )
    })
  })

  describe('Error Handling', () => {
    it('handles errors when logErrorsToConsole is true', async () => {
      // Arrange
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { useQueryParams } = createQueryParamStore(schema, { logErrorsToConsole: true })
      const { result } = renderHook(() => useQueryParams(), {
        wrapper: MemoryRouterProvider,
      })

      // Act
      await act(async () => {
        await result.current[1]({ search: false } as any)
      })

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalled()
      consoleErrorSpy.mockRestore()
    })

    describe('Logging Variations', () => {
      it('logs error when params validation fails with options.logErrorsToConsole', async () => {
        // Given - Store WITHOUT logErrorsToConsole in routerOptions
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const { useQueryParams } = createQueryParamStore(schema)

        const { result } = renderHook(() => useQueryParams(), {
          wrapper: MemoryRouterProvider,
        })

        // When - Pass invalid params with logErrorsToConsole in options
        await act(async () => {
          await result.current[1](
            { page: 'not-a-number' } as any,
            { logErrorsToConsole: true }, // Only in options, not routerOptions
          )
        })

        // Then
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'createQueryParamStore.store.setQueryParams.newParamsDoNotMatchSchema',
          expect.anything(),
        )

        consoleErrorSpy.mockRestore()
      })

      it('does not log errors when logErrorsToConsole is false everywhere', async () => {
        // Given
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const { useQueryParams } = createQueryParamStore(schema) // No logErrorsToConsole

        const { result } = renderHook(() => useQueryParams(), {
          wrapper: MemoryRouterProvider,
        })

        // When
        await act(async () => {
          await result.current[1]({ page: 'invalid' } as any) // No logErrorsToConsole
        })

        // Then
        expect(consoleErrorSpy).not.toHaveBeenCalled()

        consoleErrorSpy.mockRestore()
      })
    })
  })

  describe('Empty Parameters', () => {
    it('removes empty parameters by default', async () => {
      // Arrange
      const { useQueryParams } = createQueryParamStore(schema)
      const { result } = renderHook(() => useQueryParams(), {
        wrapper: MemoryRouterProvider,
      })

      // Act
      await act(async () => {
        await result.current[1]({
          search: '',
          filters: [],
          page: undefined,
        })
      })

      // Assert
      await waitFor(() => {
        expect(mockRouter.query).toEqual({})
        expect(result.current[0]).toEqual({})
      })
    })

    it('keeps empty parameters when keepEmptyParams is true', async () => {
      // Arrange
      const { useQueryParams } = createQueryParamStore(schema)
      const { result } = renderHook(() => useQueryParams(), {
        wrapper: MemoryRouterProvider,
      })

      // Act
      await act(async () => {
        await result.current[1](
          {
            search: '',
            filters: [],
            page: undefined,
          },
          { keepEmptyParameters: true },
        )
      })

      // Assert
      await waitFor(() => {
        expect(mockRouter.query).toEqual({
          search: '',
          filters: [],
        })
        expect(result.current[0]).toEqual({
          search: '',
          filters: [],
        })
      })
    })

    it('preserves non-empty parameters while removing empty ones', async () => {
      // Arrange
      const { useQueryParams } = createQueryParamStore(schema)
      const { result } = renderHook(() => useQueryParams(), {
        wrapper: MemoryRouterProvider,
      })

      // Act
      await act(async () => {
        await result.current[1]({
          search: 'test',
          filters: [],
          page: 1,
        })
      })

      // Assert
      await waitFor(() => {
        expect(mockRouter.query).toEqual({
          search: 'test',
          page: 1,
        })
        expect(result.current[0]).toEqual({
          search: 'test',
          page: 1,
        })
      })
    })

    describe('Filter Empty Values', () => {
      it('removes null values from params', async () => {
        // Given
        const { useQueryParams } = createQueryParamStore(schema)
        const { result } = renderHook(() => useQueryParams(), {
          wrapper: MemoryRouterProvider,
        })

        // When - Note: null is not a valid value for the schema
        // The schema validation will fail before filterEmptyValues is called
        await act(async () => {
          const success = await result.current[1]({
            search: null as any,
            page: 1,
          })
          // This should fail validation
          expect(success).toBe(false)
        })

        // Then - No changes should have been made
        expect(mockRouter.query).toEqual({})
        expect(result.current[0]).toEqual({})
      })

      it('removes empty arrays from params', async () => {
        // Given
        const arraySchema = z.object({
          tags: z.array(z.string()).optional(),
          name: z.string().optional(),
        })
        const { useQueryParams } = createQueryParamStore(arraySchema)
        const { result } = renderHook(() => useQueryParams(), {
          wrapper: MemoryRouterProvider,
        })

        // When
        await act(async () => {
          await result.current[1]({
            tags: [],
            name: 'test',
          })
        })

        // Then
        await waitFor(() => {
          expect(mockRouter.query).toEqual({ name: 'test' })
          expect(result.current[0]).toEqual({ name: 'test' })
        })
      })
    })
  })

  describe('clearQueryParams', () => {
    it('clears all schema-defined parameters while preserving external ones', async () => {
      const { clearQueryParams } = createQueryParamStore(schema)

      // Set up router with both schema and non-schema params
      await mockRouter.push({
        pathname: '/',
        query: { search: 'test', page: '2', filters: ['a', 'b'], external: 'keep' },
      })

      // Clear all schema params
      await act(async () => {
        await clearQueryParams()
      })

      // Should only have external param left
      expect(mockRouter.query).toEqual({ external: 'keep' })
    })

    it('clears only specified parameters', async () => {
      const { clearQueryParams } = createQueryParamStore(schema)

      // Set up router with multiple params
      await mockRouter.push({
        pathname: '/',
        query: { search: 'test', page: '2', filters: ['a'], external: 'keep' },
      })

      // Clear only search and filters
      await act(async () => {
        await clearQueryParams(['search', 'filters'])
      })

      // Should keep page and external
      expect(mockRouter.query).toEqual({ page: '2', external: 'keep' })
    })

    it('preserves dynamic route parameters when clearing', async () => {
      const { clearQueryParams } = createQueryParamStore(schema)

      // Navigate to dynamic route with query params
      await mockRouter.push('/posts/123?search=test&page=2')
      expect(mockRouter.query).toEqual({ id: '123', search: 'test', page: '2' })

      // Clear all schema params
      await act(async () => {
        await clearQueryParams()
      })

      // Dynamic route param should remain
      expect(mockRouter.query).toEqual({ id: '123' })
    })

    it('respects keepEmptyParameters option when resetting to defaults', async () => {
      const { clearQueryParams } = createQueryParamStore(schema)

      await mockRouter.push({
        pathname: '/',
        query: { search: 'test', page: '2' },
      })

      // Clear with resetToDefaults and keepEmptyParameters
      await act(async () => {
        await clearQueryParams(undefined, { resetToDefaults: true, keepEmptyParameters: true })
      })

      // Should have empty values instead of removed
      expect(mockRouter.query).toHaveProperty('search')
      expect(mockRouter.query).toHaveProperty('page')
    })

    it('returns promise that resolves to success status', async () => {
      const { clearQueryParams } = createQueryParamStore(schema)

      await mockRouter.push({ pathname: '/', query: { search: 'test' } })

      let result: boolean = false
      await act(async () => {
        result = await clearQueryParams()
      })

      expect(result).toBe(true)
    })

    it('actually removes params from URL by default', async () => {
      const schemaWithDefaults = z.object({
        status: z.string().default('active'),
        count: z.coerce.number().default(0),
      })

      const { clearQueryParams } = createQueryParamStore(schemaWithDefaults)

      await mockRouter.push({
        pathname: '/',
        query: { status: 'inactive', count: '5', extra: 'keep' },
      })

      await act(async () => {
        await clearQueryParams()
      })

      // Default behavior: Actually clears from URL
      expect(mockRouter.query).toEqual({ extra: 'keep' })
    })

    it('resets to defaults when resetToDefaults option is true', async () => {
      const schemaWithDefaults = z.object({
        status: z.string().default('active'),
        count: z.coerce.number().default(0),
      })

      const { clearQueryParams } = createQueryParamStore(schemaWithDefaults)

      await mockRouter.push({
        pathname: '/',
        query: { status: 'inactive', count: '5', extra: 'keep' },
      })

      await act(async () => {
        await clearQueryParams(undefined, { resetToDefaults: true })
      })

      // With resetToDefaults: true, params are set to their default values
      expect(mockRouter.query).toEqual({
        extra: 'keep',
        status: 'active', // Default value
        count: 0, // Default value
      })
    })
  })

  describe('Options', () => {
    describe('Merging and Precedence', () => {
      it('correctly merges global, default, and per-call options', async () => {
        // Given - Global options
        const { useQueryParams } = createQueryParamStore(schema, {
          shallow: false,
          locale: 'en',
          scroll: false,
          replace: true,
        })

        vi.spyOn(mockRouter, 'replace') // Should use replace, not push

        const { result } = renderHook(() => useQueryParams(), {
          wrapper: MemoryRouterProvider,
        })

        // When - Override with per-call options
        await act(async () => {
          await result.current[1](
            { search: 'test' },
            {
              shallow: true, // Override global
              locale: 'fr', // Override global
              pathname: '/custom', // New option
              // scroll: false remains from global
              // replace: true remains from global
            },
          )
        })

        // Then
        expect(mockRouter.replace).toHaveBeenCalledWith(
          { pathname: '/custom', query: expect.objectContaining({ search: 'test' }) },
          undefined,
          expect.objectContaining({
            shallow: true, // Overridden
            locale: 'fr', // Overridden
            scroll: false, // From global
          }),
        )
      })

      it('shallow defaults to true when not specified', async () => {
        // Given
        const { useQueryParams } = createQueryParamStore(schema) // No options
        vi.spyOn(mockRouter, 'push')

        const { result } = renderHook(() => useQueryParams(), {
          wrapper: MemoryRouterProvider,
        })

        // When
        await act(async () => {
          await result.current[1]({ search: 'test' })
        })

        // Then
        expect(mockRouter.push).toHaveBeenCalledWith(
          expect.anything(),
          undefined,
          expect.objectContaining({ shallow: true }), // Default value
        )
      })
    })
  })
})
