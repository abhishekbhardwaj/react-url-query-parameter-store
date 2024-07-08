# react-url-query-parameter-store

[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![Version](https://badgen.net/npm/v/react-url-query-parameter-store)](https://www.npmjs.com/package/react-url-query-parameter-store)
[![Total Downloads](https://badgen.net/npm/dt/react-url-query-parameter-store)](https://www.npmjs.com/package/react-url-query-parameter-store)
[![License](https://badgen.net/npm/license/react-url-query-parameter-store)](https://www.npmjs.com/package/react-url-query-parameter-store)
[![Bundle Size (Minified)](https://badgen.net/bundlephobia/min/react-url-query-parameter-store)](https://bundlephobia.com/package/react-url-query-parameter-store)
[![Bundle Size (Minified and Zipped)](https://badgen.net/bundlephobia/minzip/react-url-query-parameter-store)](https://bundlephobia.com/package/react-url-query-parameter-store)

This is a state management tool for React that is entirely based on top of URL Query Parameters.
Currently only works with Next.js's router but **support for other prominent routers** will be **added soon**.

Uses:

- `zod` to ensure run-time typesafety.
- `useSyncExternalStore` for efficient updates.
- `lodash/isEqual` and `lodash/pick` as utility functions.

## Features

- Manage application state using URL query parameters
- Type-safe with Zod schema validation
- Seamless integration with Next.js Router. **Support for other routers will come soon.**
- Support for single and multiple query parameters
- Customizable router push options
  - Performs shallow routing by default but this is customizable for the entire store or just on a per-use basis.
- Server-side rendering support
  - Allows you to specify initial query values when the router itself is not ready.
- Listens for URL updates outside of the hooks and makes sure its own stateis always up to date.
- The library internally does shallow comparisons to prevent unnecessary re-renders.

## Installation

```
pnpm i react-url-query-parameter-store
```

or

```
npm i react-url-query-parameter-store
```

or

```
yarn add react-url-query-parameter-store
```

It requires you to have the following packages pre-installed at minimum in your project:

```
{
  "react": "^18.0.0",
  "zod": "^3.23.8",
  "next": "^14.2.4"
}
```

> Note: It may work with older versions of the packages above too. I have personally tested it with Next 12.0.0 and it worked.

## Usage

```tsx
import { z } from "zod";
import { useRouter } from 'next/router';
import { type SetRouterQueryParamsOptions, createUseQueryParam, createUseQueryParams } from './query-param-store'

const searchParamsSchema = z.object({
  search: z.string().optional(),
  sortBy: z.array(z.string()).optional(),
});

/**
 * - if `shallow` is not passed, it's `true`. Shallow routing by default.
 * - `locale`: no default value
 * - `scroll` is defaulted to `true` by the Router if not passed
 * - `useExistingParams` is defaulted to false - Merge with existing query params (not next router standard).
 */
const routerPushOptions: SetRouterQueryParamsOptions = { shallow: false, locale: 'en', scroll: true, useExistingParams: true };

const useSearchQueryParam = createUseQueryParam(searchParams, routerPushOptions);
const useSearchQueryParams = createUseQueryParams(searchParamsSchema, routerPushOptions);

const initialQueryParams = {};

const [search, setSearch] = useSearchQueryParam("search", initialQueryParams);
const [sortBy, setSortBy] = useSearchQueryParam("sortBy", initialQueryParams);

const [searchParams, setSearchParams] = useSearchQueryParams(initialQueryParams);

console.log(search, sortBy, searchParams);

/////////////////////////////
// To set:
/////////////////////////////

/**
 * - if `shallow` is not passed, it's `true`.
 * - `locale`: no default value
 * - `scroll` is defaulted to `true` by the Router if not passed
 * - `useExistingParams` is defaulted to false - Merge with existing query params (not next router standard).
 */
setSearch(VALUE, { ...routerPushOptions, ...ANYTHING THAT YOU MAY WANT TO OVERRIDE... });

setSearchParams(
    {
        sortBy: ["name", "desc", Math.random().toString()],
    },
    {
        ...routerPushOptions,
        ...ANYTHING THAT YOU MAY WANT TO OVERRIDE...
    }
);

/**
 * You can also directly set query parameters outside of this function's surface area and it'll
 * automatically get reflected everywhere correctly.
 */
router.push(
    {
        pathname: router.pathname,
        query: {
            ...router.query,
            search: `test-${Math.random()}`
        },
    },
    undefined
    { shallow: false }
);
```

## API Reference

### `createUseQueryParam(schema, routerPushOptions?)`

Creates a hook for managing a single query parameter.

- `schema`: Zod schema for validating query parameters
- `routerPushOptions`: (Optional) Default options for router.push

Returns a hook that provides:
- Current value of the parameter
- Setter function for updating the parameter

### `createUseQueryParams(schema, routerPushOptions?)`

Creates a hook for managing multiple query parameters.

- `schema`: Zod schema for validating query parameters
- `routerPushOptions`: (Optional) Default options for router.push

Returns a hook that provides:
- Object containing all current query parameters
- Setter function for updating multiple parameters

### SetRouterQueryParamsOptions

Options for customizing router.push behavior:

- `useExistingParams`: Merge with existing query params (default: false)
- `shallow`: Perform shallow routing (default: true)
- `locale`: Specify locale for internationalized routing
- `scroll`: Control scrolling behavior (default: true)
