/**
 * React URL Query Parameter Store
 *
 * A type-safe, efficient query parameter management library for React/Next.js applications.
 * Uses URL query parameters as a source of truth for state management with Zod schema validation.
 */

import type { ParsedUrlQuery } from 'querystring'

import debounce from 'lodash/debounce'
import isEqual from 'lodash/isEqual'
import pick from 'lodash/pick'
import Router, { useRouter } from 'next/router'
import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { z } from 'zod'

/**
 * Options for customizing Next.js router behavior when updating query parameters
 */
export interface SetRouterQueryParamsOptions {
  /** Perform shallow routing without full page reload (default: true) */
  shallow?: boolean
  /** Locale for internationalized routing */
  locale?: string
  /** Control scroll behavior after navigation (default: true) */
  scroll?: boolean
  /** Replace current history entry instead of pushing new one (default: false) */
  replace?: boolean
  /** Log validation and routing errors to console */
  logErrorsToConsole?: boolean
  /** Keep empty values in URL instead of removing them */
  keepEmptyParameters?: boolean
}

/**
 * Extended options for setting query parameters with additional navigation control
 */
export type SetQueryParamOptions = SetRouterQueryParamsOptions & {
  /** Custom pathname to navigate to while updating query params */
  pathname?: string
  /** Reset parameters to their Zod schema defaults instead of removing them */
  resetToDefaults?: boolean
}

/**
 * Function signature for setting query parameters
 */
type SetQueryParamsFn<T> = (newParams: Partial<T>, options?: SetQueryParamOptions) => Promise<boolean>

/**
 * Core store class that manages query parameter state and synchronization
 * Uses a centralized state pattern with subscription-based updates
 */
class QueryParamStore<T extends Record<string, any>> {
  private subscribers = new Set<() => void>()

  private state: {
    snapshot: T | null
    previousQuery: ParsedUrlQuery
    isInitialized: boolean
    initialQuery: ParsedUrlQuery
  } = {
    snapshot: null,
    previousQuery: {},
    isInitialized: false,
    initialQuery: {},
  }

  constructor(
    private schema: z.ZodType,
    private routerOptions: SetRouterQueryParamsOptions = {},
  ) {}

  /**
   * Parse and validate query parameters against the Zod schema
   * Returns validated data or schema defaults if validation fails
   */
  private parseQuery(query: ParsedUrlQuery): T {
    const parsedQuery = this.schema.safeParse(query)

    if (parsedQuery.success) {
      return parsedQuery.data as T
    }

    if (this.routerOptions.logErrorsToConsole) {
      console.error('parseQuery.safeParse', parsedQuery.error)
    }

    // Fallback to schema defaults if parsing fails
    const defaultValue = this.schema.safeParse({})
    if (defaultValue.success) {
      return defaultValue.data as T
    }

    return {} as T
  }

  /**
   * Remove empty values (undefined, null, "", empty arrays) from an object
   * Used to clean up URL query parameters
   */
  // eslint-disable-next-line class-methods-use-this
  private filterEmptyValues(obj: Record<string, any>): Record<string, any> {
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

  /**
   * Extract dynamic route parameters (e.g., [id], [...slug]) from the current route
   * These parameters should be preserved when updating query params
   */
  // eslint-disable-next-line class-methods-use-this
  private extractDynamicParams(): Record<string, string | string[] | undefined> {
    return Object.keys(Router.query).reduce(
      (acc, key) => {
        if (Router.pathname.includes(`[${key}]`) || Router.pathname.includes(`[...${key}]`)) {
          acc[key] = Router.query[key]
        }
        return acc
      },
      {} as Record<string, string | string[] | undefined>,
    )
  }

  /**
   * Extract query parameters that are neither dynamic route params nor part of the schema
   * These "extra" parameters are preserved to maintain compatibility with external routing
   */
  private extractNonSchemaParams(parsedData: any): Record<string, string | string[] | undefined> {
    const dynamicParams = this.extractDynamicParams()

    return Object.keys(Router.query).reduce(
      (acc, key) => {
        if (
          !Object.prototype.hasOwnProperty.call(dynamicParams, key) &&
          !Object.prototype.hasOwnProperty.call(parsedData, key)
        ) {
          acc[key] = Router.query[key]
        }
        return acc
      },
      {} as Record<string, string | string[] | undefined>,
    )
  }

  /**
   * Get the current state snapshot, with support for SSR initial values
   * Implements caching to prevent unnecessary re-parsing
   */
  getSnapshot(newInitialQuery?: ParsedUrlQuery): T {
    // Initialize with SSR values on first call
    if (!this.state.isInitialized && newInitialQuery) {
      this.state.initialQuery = newInitialQuery
      this.state.isInitialized = true
    }

    // Server-side: use initial query values
    if (typeof window === 'undefined') {
      return this.parseQuery(this.state.initialQuery)
    }

    // Client-side: merge initial values with current router query
    const mergedQuery = { ...this.state.initialQuery, ...Router.query }

    // Cache optimization: only re-parse if query actually changed
    // eslint-disable-next-line sonarjs/no-collapsible-if
    if (!this.state.snapshot || this.state.previousQuery !== mergedQuery) {
      if (!this.state.snapshot || !isEqual(this.state.previousQuery, mergedQuery)) {
        this.state.previousQuery = mergedQuery
        this.state.snapshot = this.parseQuery(mergedQuery)
      }
    }

    return this.state.snapshot!
  }

  /**
   * Subscribe to state changes
   * Returns unsubscribe function for cleanup
   */
  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback)
    return () => this.subscribers.delete(callback)
  }

  /**
   * Invalidate cache and notify all subscribers of state change
   */
  invalidate(): void {
    this.state.snapshot = this.getSnapshot()
    this.subscribers.forEach((callback) => callback())
  }

  /**
   * Reset initialization state
   * Used when remounting components to ensure fresh initialization
   */
  resetInitialization(): void {
    this.state.isInitialized = false
    this.state.initialQuery = {}
  }

  /**
   * Update query parameters in the URL
   * Handles validation, merging with existing params, and router navigation
   */
  async setQueryParams(newParams: Partial<T>, options: SetQueryParamOptions = {}): Promise<boolean> {
    // Prevent server-side execution
    if (typeof window === 'undefined') {
      if (options.logErrorsToConsole || this.routerOptions.logErrorsToConsole) {
        console.warn('createQueryParamStore.store.setQueryParams.serverSideUsageError')
      }
      return Promise.resolve(false)
    }

    const parsedParams = this.schema.safeParse(newParams)
    if (parsedParams.success) {
      const pushOrReplace = options.replace || this.routerOptions.replace ? Router.replace : Router.push

      // Preserve dynamic route parameters (e.g., /posts/[id])
      const dynamicParams = this.extractDynamicParams()

      // Preserve non-schema query params for compatibility
      const existingParams = this.extractNonSchemaParams(parsedParams.data)

      // Merge parameters with correct priority order
      const mergedParams = {
        ...existingParams, // Lowest priority: existing non-schema params
        ...parsedParams.data, // Middle priority: new validated params
        ...dynamicParams, // Highest priority: dynamic route params (must be preserved)
      } as T

      // Optionally filter out empty values from URL
      const finalParams =
        options.keepEmptyParameters || this.routerOptions.keepEmptyParameters
          ? mergedParams
          : this.filterEmptyValues(mergedParams)

      return pushOrReplace(
        {
          pathname: options.pathname || Router.pathname,
          query: finalParams,
        },
        undefined,
        pick(
          {
            shallow: true, // Default to shallow routing
            ...this.routerOptions,
            ...options,
          },
          ['shallow', 'locale', 'scroll'],
        ),
      )
        .then((success) => {
          this.invalidate()
          return success
        })
        .catch((e) => {
          if (options.logErrorsToConsole || this.routerOptions.logErrorsToConsole) {
            console.error('createQueryParamStore.store.setQueryParams.routerPush', e)
          }
          return false
        })
    }

    // Log validation errors if requested
    if (options.logErrorsToConsole ?? this.routerOptions.logErrorsToConsole) {
      console.error('createQueryParamStore.store.setQueryParams.newParamsDoNotMatchSchema', parsedParams.error)
    }

    return Promise.resolve(false)
  }

  /**
   * Clear query parameters from the URL
   * Can either remove params entirely or reset them to schema defaults
   */
  async clearQueryParams(keys?: (keyof T)[], options: SetQueryParamOptions = {}): Promise<boolean> {
    // Mode 1: Reset to schema defaults
    if (options.resetToDefaults) {
      const defaultValues = this.parseQuery({})
      let paramsToReset: Partial<T>

      if (!keys) {
        // Reset all params to defaults
        paramsToReset = defaultValues
      } else {
        // Reset only specified keys to defaults
        paramsToReset = keys.reduce((acc, key) => {
          acc[key] = defaultValues[key]
          return acc
        }, {} as Partial<T>)
      }
      return this.setQueryParams(paramsToReset, { ...this.routerOptions, ...options })
    }

    // Mode 2: Remove params from URL entirely
    if (typeof window === 'undefined') {
      return Promise.resolve(false)
    }

    const currentQuery = { ...Router.query }

    // Determine which keys to remove
    const keysToRemove =
      keys || ('shape' in this.schema ? Object.keys((this.schema as any).shape) : Object.keys(this.getSnapshot({})))

    // Remove specified keys from query
    keysToRemove.forEach((key) => {
      delete currentQuery[key as string]
    })

    const pushOrReplace = options.replace || this.routerOptions.replace ? Router.replace : Router.push

    return pushOrReplace(
      { pathname: options.pathname || Router.pathname, query: currentQuery },
      undefined,
      pick({ shallow: true, ...this.routerOptions, ...options }, ['shallow', 'locale', 'scroll']),
    )
      .then(() => {
        this.invalidate()
        return true
      })
      .catch((e) => {
        if (options.logErrorsToConsole || this.routerOptions.logErrorsToConsole) {
          console.error('clearQueryParams error:', e)
        }
        return false
      })
  }
}

/**
 * Create a query parameter store with type-safe hooks for managing URL state
 *
 * @param schema - Zod schema defining the shape and validation rules for query parameters
 * @param routerOptions - Default options for router navigation behavior
 * @returns Object containing useQueryParam, useQueryParams, and clearQueryParams
 */
export const createQueryParamStore = <P extends z.ZodType>(
  schema: P,
  routerOptions: SetRouterQueryParamsOptions = {},
) => {
  const store = new QueryParamStore<z.infer<P>>(schema, routerOptions)

  /**
   * Internal hook that provides the core query param state management
   * Uses useSyncExternalStore for efficient updates and SSR compatibility
   */
  const useQueryParamStore = (initialQuery: ParsedUrlQuery = {}) => {
    const router = useRouter()
    const { isReady } = router
    const initialQueryRef = useRef(initialQuery)
    const isInitializedRef = useRef(false)

    // Reset and initialize store on mount
    useEffect(() => {
      store.resetInitialization()
      store.getSnapshot(initialQueryRef.current)
    }, [])

    // Debounced parameter updates to prevent rapid URL changes
    const debouncedSetQueryParams = useRef(
      debounce(
        (newParams: Partial<z.infer<P>>, options?: SetQueryParamOptions) => {
          return store.setQueryParams(newParams, options)
        },
        300,
        { leading: false, trailing: true },
      ),
    ).current

    // Connect to store using useSyncExternalStore for optimal performance
    const state = useSyncExternalStore(
      store.subscribe.bind(store),
      () => store.getSnapshot(initialQuery), // Client snapshot
      () => store.getSnapshot(initialQuery), // Server snapshot
    )

    // Synchronize store state with router query changes
    useEffect(() => {
      if (!isReady) return

      // Initial synchronization: merge defaults with URL params
      if (!isInitializedRef.current) {
        isInitializedRef.current = true

        const currentState = store.getSnapshot()
        const zodDefaults = store.getSnapshot({})

        // Check if we need to sync defaults or initial values to URL
        const hasDefaultsToSync = Object.keys(zodDefaults).some(
          (key) => zodDefaults[key] !== undefined && !(key in router.query),
        )
        const hasInitialToSync = Object.keys(initialQueryRef.current).some(
          (key) => initialQueryRef.current[key] !== undefined && !(key in router.query),
        )

        if (hasDefaultsToSync || hasInitialToSync) {
          // Merge with priority: defaults < initial < router < current
          const mergedState = {
            ...zodDefaults,
            ...initialQueryRef.current,
            ...router.query,
            ...currentState,
          }
          store.setQueryParams(mergedState, { replace: true, shallow: true }).catch(() => {})
        }
        return
      }

      // Ongoing synchronization: update URL when state changes
      const parsedRouterQuery = store.getSnapshot()
      if (!isEqual(state, parsedRouterQuery)) {
        debouncedSetQueryParams(state, { shallow: true, ...routerOptions })?.catch(() => {})
      }
    }, [isReady, state, router.query, router.pathname])

    // Listen for external route changes to keep store in sync
    useEffect(() => {
      const handleRouteChange = () => {
        store.invalidate()
      }

      Router.events.on('routeChangeComplete', handleRouteChange)
      return () => {
        Router.events.off('routeChangeComplete', handleRouteChange)
      }
    }, [])

    // Cleanup debounced function on unmount
    useEffect(() => {
      return () => {
        debouncedSetQueryParams.cancel()
      }
    }, [])

    return state
  }

  /**
   * Hook for managing a single query parameter
   *
   * @param key - The parameter key to manage
   * @param initialQuery - Initial query values for SSR
   * @returns Tuple of [currentValue, setterFunction]
   */
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

  /**
   * Hook for managing multiple query parameters
   *
   * @param initialQuery - Initial query values for SSR
   * @returns Tuple of [allParams, setterFunction]
   */
  const useQueryParams = (initialQuery: ParsedUrlQuery = {}): [z.infer<P>, SetQueryParamsFn<z.infer<P>>] => {
    const params = useQueryParamStore(initialQuery)

    const setQueryParams: SetQueryParamsFn<z.infer<P>> = (newParams, options) =>
      store.setQueryParams(newParams, { ...routerOptions, ...options })

    return [params, setQueryParams]
  }

  /**
   * Clear query parameters from the URL
   * Can be used outside of React components
   *
   * @param keys - Optional array of keys to clear (clears all if not provided)
   * @param options - Navigation and behavior options
   */
  const clearQueryParams = (keys?: (keyof z.infer<P>)[], options?: SetQueryParamOptions): Promise<boolean> => {
    return store.clearQueryParams(keys, options)
  }

  return { useQueryParam, useQueryParams, clearQueryParams }
}
