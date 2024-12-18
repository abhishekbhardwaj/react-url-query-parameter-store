import type { ParsedUrlQuery } from 'querystring'

import debounce from 'lodash/debounce'
import isEqual from 'lodash/isEqual'
import pick from 'lodash/pick'
import Router, { useRouter } from 'next/router'
import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { z } from 'zod'

export interface SetRouterQueryParamsOptions {
  shallow?: boolean
  locale?: string
  scroll?: boolean
  replace?: boolean
  logErrorsToConsole?: boolean
  keepEmptyParameters?: boolean
}

export type SetQueryParamOptions = SetRouterQueryParamsOptions & {
  pathname?: string
}

type SetQueryParamsFn<T> = (newParams: Partial<T>, options?: SetQueryParamOptions) => Promise<boolean>

interface QueryParamStore<P> {
  getSnapshot: (initialQuery?: ParsedUrlQuery) => P
  subscribe: (callback: () => void) => () => void
  setQueryParams: SetQueryParamsFn<P>
  invalidate: () => void
  resetInitialization: () => void
}

const filterEmptyValues = (obj: Record<string, any>): Record<string, any> => {
  return Object.entries(obj).reduce(
    (acc, [key, value]) => {
      const isEmpty =
        value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)

      if (!isEmpty) {
        acc[key] = value
      }
      return acc
    },
    {} as Record<string, any>,
  )
}

const createStore = <P extends z.ZodType>(
  schema: P,
  routerOptions: SetRouterQueryParamsOptions = {},
): QueryParamStore<z.infer<P>> => {
  const subscribers = new Set<() => void>()
  let cachedSnapshot: z.infer<P> | null = null
  let previousQuery: ParsedUrlQuery = {}
  let isInitialized = false
  let initialQuery: ParsedUrlQuery = {}

  // Attempt to parse the query using the provided schema
  const parseQuery = (query: ParsedUrlQuery): z.infer<P> => {
    const parsedQuery = schema.safeParse(query)

    if (parsedQuery.success) {
      return parsedQuery.data as P
    }
    // If parsing fails, log the error and return an empty object that matches the schema
    if (routerOptions.logErrorsToConsole) {
      console.error('parseQuery.safeParse', parsedQuery.error)
    }

    // Use safeParse to avoid potential errors, and provide a default value that satisfies the schema
    const defaultValue = schema.safeParse({})
    if (defaultValue.success) {
      return defaultValue.data as P
    }

    return {} as z.infer<P>
  }

  const getSnapshot = (newInitialQuery?: ParsedUrlQuery): z.infer<P> => {
    if (!isInitialized && newInitialQuery) {
      initialQuery = newInitialQuery
      isInitialized = true
    }

    if (typeof window === 'undefined') {
      // On the server, use initialQuery
      return parseQuery(initialQuery)
    }

    // On the client, merge initialQuery with Router.query, giving priority to Router.query
    const mergedQuery = { ...initialQuery, ...Router.query }

    // Check if the query has changed before parsing
    if (!cachedSnapshot || !isEqual(previousQuery, mergedQuery)) {
      previousQuery = mergedQuery
      cachedSnapshot = parseQuery(mergedQuery)
    }

    return cachedSnapshot
  }

  const store: QueryParamStore<z.infer<P>> = {
    // Get the current query params
    getSnapshot,
    // Subscribe to changes
    subscribe: (callback: () => void) => {
      subscribers.add(callback)
      return () => subscribers.delete(callback)
    },
    // Invalidate the cache and notify subscribers
    invalidate: () => {
      cachedSnapshot = getSnapshot()
      subscribers.forEach((callback) => callback())
    },
    // Reset the store to its initial state
    resetInitialization: () => {
      isInitialized = false
      initialQuery = {}
    },
    // Set new query params
    setQueryParams: (newParams: Partial<z.infer<P>>, options: SetQueryParamOptions = {}) => {
      if (typeof window === 'undefined') {
        if (options.logErrorsToConsole || routerOptions.logErrorsToConsole) {
          console.warn('createQueryParamStore.store.setQueryParams.serverSideUsageError')
        }

        return Promise.resolve(false)
      }

      const parsedParams = schema.safeParse(newParams)
      if (parsedParams.success) {
        const pushOrReplace = options.replace || routerOptions.replace ? Router.replace : Router.push

        // Extract dynamic route parameters
        const dynamicParams = Object.keys(Router.query).reduce(
          (acc, key) => {
            if (Router.pathname.includes(`[${key}]`) || Router.pathname.includes(`[...${key}]`)) {
              acc[key] = Router.query[key]
            }
            return acc
          },
          {} as Record<string, string | string[] | undefined>,
        )

        // Get existing query params that are not dynamic or parsed
        const existingParams = Object.keys(Router.query).reduce(
          (acc, key) => {
            if (
              !Object.prototype.hasOwnProperty.call(dynamicParams, key) &&
              !Object.prototype.hasOwnProperty.call(parsedParams.data, key)
            ) {
              acc[key] = Router.query[key]
            }
            return acc
          },
          {} as Record<string, string | string[] | undefined>,
        )

        // Merge dynamic params with new params, prioritizing dynamic params
        const mergedParams = {
          ...existingParams,
          ...parsedParams.data,
          ...dynamicParams,
        } as z.infer<P>

        const finalParams =
          options.keepEmptyParameters || routerOptions.keepEmptyParameters
            ? mergedParams
            : filterEmptyValues(mergedParams)

        return pushOrReplace(
          {
            pathname: options.pathname || Router.pathname,
            query: finalParams,
          },
          undefined,
          pick(
            {
              // Merge default options, global routerOptions, and per-call options
              // defaults
              shallow: true,
              ...routerOptions,
              ...options,
            },
            ['shallow', 'locale', 'scroll'],
          ),
        )
          .then((success) => {
            // Invalidate cache to force re-fetch on next getSnapshot
            store.invalidate()
            return success
          })
          .catch((e) => {
            if (options.logErrorsToConsole || routerOptions.logErrorsToConsole) {
              console.error('createQueryParamStore.store.setQueryParams.routerPush', e)
            }

            return false
          })
      }

      // eslint-disable-next-line no-lonely-if
      if (options.logErrorsToConsole ?? routerOptions.logErrorsToConsole) {
        console.error('createQueryParamStore.store.setQueryParams.newParamsDoNotMatchSchema', parsedParams.error)
      }

      return Promise.resolve(false)
    },
  }

  return store
}

const createUseQueryParamStore = <P extends z.ZodType>(
  queryParamStore: QueryParamStore<z.TypeOf<P>>,
  routerOptions: SetRouterQueryParamsOptions = {},
) => {
  return (initialQuery: ParsedUrlQuery = {}) => {
    const router = useRouter()
    const { isReady } = router
    const initialQueryRef = useRef(initialQuery)
    const isInitializedRef = useRef(false)

    // Use an effect to initialize the store with the first call's initialQuery
    useEffect(() => {
      queryParamStore.resetInitialization()
      queryParamStore.getSnapshot(initialQueryRef.current)
    }, [])

    // Create a debounced version of router.push
    const debouncedSetQueryParams = useRef(
      debounce(
        (newParams: Partial<z.TypeOf<P>>, options?: SetQueryParamOptions) => {
          return queryParamStore.setQueryParams(newParams, options)
        },
        300,
        { leading: false, trailing: true },
      ),
    ).current

    const state = useSyncExternalStore(
      queryParamStore.subscribe,
      // Use the snapshot from the store
      () => queryParamStore.getSnapshot(initialQuery),
      // Server snapshot
      () => queryParamStore.getSnapshot(initialQuery),
    )

    useEffect(() => {
      if (!isReady) return

      const parsedRouterQuery = queryParamStore.getSnapshot()
      const isStateEqualToRouterQuery = isEqual(state, parsedRouterQuery)

      // Skip the initial update if the state is already equal to the router query
      if (!isInitializedRef.current) {
        isInitializedRef.current = true

        // Get zod defaults by parsing an empty object
        const zodDefaults = queryParamStore.getSnapshot({})

        // Check if there are any default values not present in the URL
        const defaultsNotInUrl = Object.keys({ ...zodDefaults, ...initialQueryRef.current }).reduce((acc, key) => {
          if (!(key in router.query)) {
            if (initialQueryRef.current[key] !== undefined) {
              acc[key] = initialQueryRef.current[key]
            } else if (zodDefaults[key as keyof typeof zodDefaults] !== undefined) {
              acc[key] = zodDefaults[key as keyof typeof zodDefaults]
            }
          }
          return acc
        }, {} as ParsedUrlQuery)

        if (Object.keys(defaultsNotInUrl).length > 0 || !isStateEqualToRouterQuery) {
          // Update state to match parsed router query on first render
          // Reorder merging priority:
          // 1. zodDefaults (lowest priority)
          // 2. initialQueryRef.current
          // 3. router.query
          // 4. parsedRouterQuery (highest priority - contains validated state)
          const mergedState = {
            ...zodDefaults,
            ...initialQueryRef.current,
            ...router.query,
            ...parsedRouterQuery,
          }
          queryParamStore.setQueryParams(mergedState, { replace: true, shallow: true }).catch(() => {})
        }

        return
      }

      // Update the router query if the state has changed
      if (!isStateEqualToRouterQuery) {
        debouncedSetQueryParams(state, { shallow: true, ...routerOptions })?.catch(() => {})
      }
    }, [isReady, state, router.query, router.pathname])

    useEffect(() => {
      const handleRouteChange = () => {
        queryParamStore.invalidate()
      }

      // Listen for route changes to update the query parameters made outside of the hook
      Router.events.on('routeChangeComplete', handleRouteChange)
      return () => {
        Router.events.off('routeChangeComplete', handleRouteChange)
      }
    }, [])

    return state
  }
}

export const createQueryParamStore = <P extends z.ZodType>(
  schema: P,
  routerOptions: SetRouterQueryParamsOptions = {},
) => {
  const store = createStore(schema, routerOptions)
  const useQueryParamStore = createUseQueryParamStore(store, routerOptions)

  const useQueryParam = <K extends keyof z.infer<P>>(
    key: K,
    initialQuery: ParsedUrlQuery = {},
  ): [z.infer<P>[K], (newValue: z.infer<P>[K], options?: SetQueryParamOptions) => Promise<boolean>] => {
    const params = useQueryParamStore(initialQuery)
    const setValue = (newValue: z.infer<P>[K], options?: SetQueryParamOptions) =>
      store.setQueryParams({ [key]: newValue } as Partial<z.infer<P>>, {
        ...routerOptions,
        ...options,
      })

    return [params?.[key], setValue]
  }

  const useQueryParams = (initialQuery: ParsedUrlQuery = {}): [z.infer<P>, SetQueryParamsFn<z.infer<P>>] => {
    const params = useQueryParamStore(initialQuery)

    const setQueryParams: SetQueryParamsFn<z.infer<P>> = (newParams, options) =>
      store.setQueryParams(newParams, { ...routerOptions, ...options })

    return [params, setQueryParams]
  }

  return { useQueryParam, useQueryParams }
}
