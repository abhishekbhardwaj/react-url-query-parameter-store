# react-query-parameter-store

[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![CI Workflow](https://github.com/abhishekbhardwaj/react-query-parameter-store/actions/workflows/ci.yml/badge.svg)](https://docs.github.com/en/actions/monitoring-and-troubleshooting-workflows/adding-a-workflow-status-badge)
[![Bundle Size (Minified)](https://badgen.net/bundlephobia/min/react-query-parameter-store)](https://bundlephobia.com/package/react-query-parameter-store)
[![Bundle Size (Minified and Zipped)](https://badgen.net/bundlephobia/minzip/react-query-parameter-store)](https://bundlephobia.com/package/react-query-parameter-store)
[![Dependency Count](https://badgen.net/bundlephobia/dependency-count/react-query-parameter-store)](https://bundlephobia.com/package/react-query-parameter-store)
[![Tree Shaking](https://badgen.net/bundlephobia/tree-shaking/react-query-parameter-store)](https://bundlephobia.com/package/react-query-parameter-store)

This is a state management tool for React that is entirely based on top of URL Query Parameters.

## Features

- Manage application state using URL query parameters
- Type-safe with Zod schema validation
- Seamless integration with Next.js Router. **Support for other routers will come soon.**
- Support for single and multiple query parameters
- Customizable router push options
- Server-side rendering support

## Installation

```
pnpm i react-query-parameter-store
```

It requires you to have the following packages pre-installed at minimum in your project:

```
{
  "react": "^18.0.0",
  "zod": "^3.23.8",
  "next": "^14.2.4"
}
```

## Usage

```tsx
import { z } from "zod";
import { useRouter } from 'next/router';
import { type SetRouterQueryParamsOptions, createUseQueryParam, createUseQueryParams } from './query-param-store'

const searchParamsSchema = z.object({
  search: z.string().optional(),
  sortBy: z.array(z.string()).optional(),
});

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

- `useExistingParams`: Merge with existing params (default: false)
- `shallow`: Perform shallow routing (default: true)
- `locale`: Specify locale for internationalized routing
- `scroll`: Control scrolling behavior (default: true)
