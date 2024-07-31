import type { ParsedUrlQuery } from 'querystring'

import isEqual from 'lodash/isEqual'
import pick from 'lodash/pick'
import Router, { useRouter } from 'next/router'
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import type { z } from 'zod'

export interface SetRouterQueryParamsOptions {
  useExistingParams?: boolean
  shallow?: boolean
  locale?: string
  scroll?: boolean
  replace?: boolean
  logErrorsToConsole?: boolean
}

export type SetQueryParamOptions = SetRouterQueryParamsOptions & {
  pathname?: string
}

type SetQueryParamsFn<T> = (newParams: Partial<T>, options?: SetQueryParamOptions) => void

interface QueryParamStore<P> {
  getSnapshot: (initialQuery?: ParsedUrlQuery) => P
  subscribe: (callback: () => void) => () => void
  setQueryParams: SetQueryParamsFn<P>
}

const createStore = <P extends z.ZodType>(
  schema: P,
  routerOptions: SetRouterQueryParamsOptions = {},
): QueryParamStore<z.infer<P>> => {
  const subscribers = new Set<() => void>()
  let cachedSnapshot: z.infer<P> | null = null

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

    return {} as P
  }

  const store: QueryParamStore<z.infer<P>> = {
    // Get the current query params
    getSnapshot: (initialQuery: ParsedUrlQuery = {}) => {
      // Server-side
      if (typeof window === 'undefined') {
        return parseQuery(initialQuery) as P
      }

      // Client-side
      if (Router.isReady) {
        const newSnapshot = parseQuery(Router.query)
        if (!cachedSnapshot || !isEqual(cachedSnapshot, newSnapshot)) {
          cachedSnapshot = newSnapshot
        }
      } else if (!cachedSnapshot) {
        cachedSnapshot = parseQuery(Router.query)
      }

      return cachedSnapshot as P
    },
    // Subscribe to changes
    subscribe: (callback: () => void) => {
      subscribers.add(callback)
      return () => subscribers.delete(callback)
    },
    // Set new query params
    setQueryParams: (newParams: Partial<z.infer<P>>, options: SetQueryParamOptions = {}) => {
      if (typeof window === 'undefined' && (options.logErrorsToConsole || routerOptions.logErrorsToConsole)) {
        console.warn('createQueryParamStore.store.setQueryParams.serverSideUsageError')
        return
      }

      const currentParams = Router.query
      const updatedParams = options.useExistingParams ? { ...currentParams, ...newParams } : newParams

      const parsedParams = schema.safeParse(updatedParams)
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

        pushOrReplace(
          {
            pathname: options.pathname || Router.pathname,
            query: mergedParams,
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
          .then(() => {
            // Invalidate cache to force re-fetch on next getSnapshot
            cachedSnapshot = null
            subscribers.forEach((callback) => callback())
          })
          .catch((e) => {
            if (options.logErrorsToConsole || routerOptions.logErrorsToConsole) {
              console.error('createQueryParamStore.store.setQueryParams.routerPush', e)
            }
          })
      } else {
        // eslint-disable-next-line no-lonely-if
        if (options.logErrorsToConsole ?? routerOptions.logErrorsToConsole) {
          console.error('createQueryParamStore.store.setQueryParams.newParamsDoNotMatchSchema', parsedParams.error)
        }
      }
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
    const lastParsedQueryRef = useRef<z.infer<P> | null>(null)
    const isInitializedRef = useRef(false)

    const state = useSyncExternalStore(
      queryParamStore.subscribe,
      useCallback(() => {
        // Use the appropriate snapshot based on whether the router is ready
        const snapshot = isReady ? queryParamStore.getSnapshot() : queryParamStore.getSnapshot(initialQuery)

        lastParsedQueryRef.current = snapshot
        return snapshot as P
      }, [isReady, initialQuery]),
      () => queryParamStore.getSnapshot(initialQuery), // Server snapshot
    )

    useEffect(() => {
      if (!isReady) return

      const parsedRouterQuery = queryParamStore.getSnapshot(router.query)
      const isStateEqualToRouterQuery = isEqual(state, parsedRouterQuery)

      // Compare only the keys present in the state
      const relevantRouterQuery = pick(router.query, Object.keys(state))
      const isRelevantQueryEqual = isEqual(relevantRouterQuery, state)

      // Skip the initial update if the state is already equal to the router query
      if (!isInitializedRef.current) {
        isInitializedRef.current = true

        if (!isStateEqualToRouterQuery || !isRelevantQueryEqual) {
          // Update state to match parsed router query on first render
          const mergedState = { ...router.query, ...state, ...parsedRouterQuery }
          queryParamStore.setQueryParams(mergedState, { replace: true, shallow: true })
        }

        lastParsedQueryRef.current = parsedRouterQuery
        return
      }

      // Update the router query if the state has changed
      if (!isStateEqualToRouterQuery || !isRelevantQueryEqual) {
        const { pathname } = router
        const query = { ...router.query, ...state }

        router.push({ pathname, query }, undefined, { shallow: true }).catch((e) => {
          if (routerOptions.logErrorsToConsole) {
            console.error('createUseQueryParamStore.routerReplace', e)
          }
        })
        lastParsedQueryRef.current = state
      }
    }, [isReady, state, router.query, router.pathname])

    useEffect(() => {
      const handleRouteChange = () => {
        const newSnapshot = queryParamStore.getSnapshot()
        if (!isEqual(newSnapshot, lastParsedQueryRef.current)) {
          lastParsedQueryRef.current = newSnapshot
          queryParamStore.subscribe(() => {
            // Trigger update with an empty object to force re-render
          })
        }
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
  ): [z.infer<P>[K], (newValue: z.infer<P>[K], options?: SetQueryParamOptions) => void] => {
    const params = useQueryParamStore(initialQuery)
    const setValue = (newValue: z.infer<P>[K], options?: SetQueryParamOptions) =>
      store.setQueryParams({ [key]: newValue } as Partial<z.infer<P>>, {
        ...routerOptions,
        ...options,
      })

    return [params[key], setValue]
  }

  const useQueryParams = (initialQuery: ParsedUrlQuery = {}): [z.infer<P>, SetQueryParamsFn<z.infer<P>>] => {
    const params = useQueryParamStore(initialQuery)
    return [params, store.setQueryParams]
  }

  return { useQueryParam, useQueryParams }
}
