import type { ParsedUrlQuery } from 'querystring'

import isEqual from 'lodash/isEqual'
import pick from 'lodash/pick'
// eslint-disable-next-line import/no-extraneous-dependencies
import Router, { useRouter } from 'next/router'
// eslint-disable-next-line import/no-extraneous-dependencies
import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { z } from 'zod'

export interface SetRouterQueryParamsOptions {
  useExistingParams?: boolean
  shallow?: boolean
  locale?: string
  scroll?: boolean
}

type SetQueryParamsFn<T> = (newParams: Partial<T>, options?: SetRouterQueryParamsOptions) => void

interface QueryParamStore<P> {
  getSnapshot: (initialQuery?: ParsedUrlQuery) => P
  subscribe: (callback: () => void) => () => void
  setQueryParams: SetQueryParamsFn<P>
}

const createQueryParamStore = <P extends z.ZodType>(
  schema: P,
  routerPushOptions: SetRouterQueryParamsOptions = {},
): QueryParamStore<z.infer<P>> => {
  const subscribers = new Set<() => void>()
  let cachedSnapshot: z.infer<P> | null = null

  const parseQuery = (query: ParsedUrlQuery): z.infer<P> => {
    const parsedQuery = schema.safeParse(query)

    if (parsedQuery.success) {
      return parsedQuery.data as P
    }

    console.error('parseQuery.safeParse', parsedQuery.error)
    return schema.parse({}) as Partial<z.infer<P>>
  }

  const store: QueryParamStore<z.infer<P>> = {
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
    subscribe: (callback: () => void) => {
      subscribers.add(callback)
      return () => subscribers.delete(callback)
    },
    setQueryParams: (newParams: Partial<z.infer<P>>, options: SetRouterQueryParamsOptions = {}) => {
      if (typeof window === 'undefined') {
        console.warn('createQueryParamStore.store.setQueryParams.serverSideUsageError')
        return
      }

      const currentParams = Router.query

      const updatedParams = options.useExistingParams ? { ...currentParams, ...newParams } : newParams
      const parsedParams = schema.safeParse(updatedParams)
      if (parsedParams.success) {
        Router.push(
          {
            pathname: Router.pathname,
            query: parsedParams.data as z.infer<P>,
          },
          undefined,
          pick(
            {
              // defaults
              shallow: true,
              ...routerPushOptions,
              ...options,
            },
            ['shallow', 'locale', 'scroll'],
          ),
        )
          .then(() => {
            cachedSnapshot = null // Invalidate cache
            subscribers.forEach((callback) => callback())
          })
          .catch((e) => {
            console.error('createQueryParamStore.store.setQueryParams.routerPush', e)
          })
      } else {
        console.error('createQueryParamStore.store.setQueryParams.newParamsDoNotMatchSchema', parsedParams.error)
      }
    },
  }

  return store
}

const createUseQueryParamStore = <P extends z.ZodType>(queryParamStore: QueryParamStore<z.TypeOf<P>>) => {
  return (initialQuery: ParsedUrlQuery = {}) => {
    const router = useRouter()
    const { isReady } = router
    const lastParsedQueryRef = useRef<z.infer<P> | null>(null)

    const state = useSyncExternalStore(
      queryParamStore.subscribe,
      () => {
        const snapshot = isReady ? queryParamStore.getSnapshot() : queryParamStore.getSnapshot(initialQuery)

        lastParsedQueryRef.current = snapshot
        return snapshot as P
      },

      () => queryParamStore.getSnapshot(initialQuery), // Server snapshot
    )

    useEffect(() => {
      const handleRouteChange = () => {
        const newSnapshot = queryParamStore.getSnapshot()
        if (!isEqual(newSnapshot, lastParsedQueryRef.current)) {
          lastParsedQueryRef.current = newSnapshot
          queryParamStore.subscribe(() => {
            // Trigger update
          })
        }
      }

      Router.events.on('routeChangeComplete', handleRouteChange)
      return () => {
        Router.events.off('routeChangeComplete', handleRouteChange)
      }
    }, [])

    return state
  }
}

export const createUseQueryParam = <P extends z.ZodType>(
  schema: P,
  routerPushOptions: SetRouterQueryParamsOptions = {},
) => {
  const queryParamStore = createQueryParamStore(schema, routerPushOptions)
  const useQueryParamStore = createUseQueryParamStore(queryParamStore)

  return <K extends keyof z.infer<P>>(
    key: K,
    initialQuery: ParsedUrlQuery = {},
  ): [z.infer<P>[K], (newValue: z.infer<P>[K], options?: SetRouterQueryParamsOptions) => void] => {
    const params = useQueryParamStore(initialQuery)
    const setValue = (newValue: z.infer<P>[K], options?: SetRouterQueryParamsOptions) =>
      queryParamStore.setQueryParams({ [key]: newValue } as Partial<z.infer<P>>, { ...routerPushOptions, ...options })
    return [params[key], setValue]
  }
}

export const createUseQueryParams = <P extends z.ZodType>(
  schema: P,
  routerPushOptions: SetRouterQueryParamsOptions = {},
) => {
  const queryParamStore = createQueryParamStore(schema, routerPushOptions)
  const useQueryParamStore = createUseQueryParamStore(queryParamStore)

  return (initialQuery: ParsedUrlQuery = {}): [z.infer<P>, SetQueryParamsFn<z.infer<P>>] => {
    const params = useQueryParamStore(initialQuery)
    return [params, queryParamStore.setQueryParams]
  }
}
