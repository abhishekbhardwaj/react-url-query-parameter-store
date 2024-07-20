# react-url-query-parameter-store

[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![Version](https://badgen.net/npm/v/react-url-query-parameter-store)](https://www.npmjs.com/package/react-url-query-parameter-store)
[![Total Downloads](https://badgen.net/npm/dt/react-url-query-parameter-store)](https://www.npmjs.com/package/react-url-query-parameter-store)
[![License](https://badgen.net/npm/license/react-url-query-parameter-store)](https://www.npmjs.com/package/react-url-query-parameter-store)
[![Bundle Size (Minified and Zipped)](https://img.shields.io/bundlephobia/minzip/react-url-query-parameter-store)](https://bundlephobia.com/package/react-url-query-parameter-store)

An Efficient Query Parameter Management Tool for React

`react-url-query-parameter-store` is an efficient query parameter management tool for React. It provides a robust solution for managing URL query parameters in React applications, with a focus on type-safety and efficiency.

While it's not a traditional state management store, it offers powerful capabilities for handling query string validation and synchronization across your app.

Currently only works with Next.js's router but **support for other prominent routers** will be **added soon**.

Additionally, this library can serve as a lightweight state management solution for React/Next.js applications, leveraging URL query parameters as the source of truth. By using `useSyncExternalStore`, it ensures efficient updates and synchronization across components in a highly performant way.

Uses:

- `zod` to ensure run-time typesafety.
- `useSyncExternalStore` for efficient updates.
- `lodash/isEqual` and `lodash/pick` as utility functions.


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

## Usage

`react-url-query-parameter-store` caters to a variety of use-cases.

1. **State Persistence**: Store application state in the URL for easy sharing and bookmarking.
2. **User Preferences**: Manage user settings like language, theme, or view options.
3. **Navigation Control**: Handle pagination, sorting, and filtering in list views.
4. **Form Management**: Preserve form state across page reloads or for multi-step processes.
5. **Feature Toggles**: Implement A/B testing or feature flags using URL parameters.
6. **Analytics and Tracking**: Capture user behavior or referral sources in the URL.
7. **Dynamic Content Loading**: Control content display based on URL parameters.
8. **Search Functionality**: Manage complex search queries and filters.
9. **UI State Management**: Keep track of active tabs, expanded sections, or modal states.
10. **Configuration Storage**: Store and retrieve user-specific configurations.
11. **Table Filters**: Manage and persist complex filtering options for data tables.
12. **URL Shortening**: Create compact URLs by encoding multiple parameters.
13. **Cross-Component Communication**: Use URL parameters as a shared state between unrelated components.
14. **Wizard Steps**: Track progress in multi-step processes or wizards.
15. **Conditional Rendering**: Toggle visibility of components based on URL parameters.

```tsx
import { z } from "zod";
import { useRouter } from 'next/router';
import { type SetRouterQueryParamsOptions, createQueryParamStore } from 'react-url-query-parameter-store'

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
const routerOptions: SetRouterQueryParamsOptions = { shallow: false, locale: 'en', scroll: true, useExistingParams: true };

const { useQueryParam, useQueryParams } = createQueryParamStore(searchParamsSchema, routerOptions);

const initialQueryParams = {};

const [search, setSearch] = useQueryParam("search", initialQueryParams);
const [sortBy, setSortBy] = useQueryParam("sortBy", initialQueryParams);

const [searchParams, setSearchParams] = useQueryParams(initialQueryParams);

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
setSearch(VALUE, { ...routerOptions, ...ANYTHING THAT YOU MAY WANT TO OVERRIDE... });

setSearchParams(
    {
        sortBy: ["name", "desc", Math.random().toString()],
    },
    {
        ...routerOptions,
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

### Next.js Page Router Example

```tsx
import { z } from "zod";
import { useRouter } from 'next/router';
import { NextPage, GetServerSideProps, InferGetServerSidePropsType } from 'next';
import { type ParsedUrlQuery } from 'querystring';
import { type SetRouterQueryParamsOptions, createQueryParamStore } from 'react-url-query-parameter-store'

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
const routerOptions: SetRouterQueryParamsOptions = { shallow: false, locale: 'en', scroll: true, useExistingParams: true };

const { useQueryParam, useQueryParams } = createQueryParamStore(searchParamsSchema, routerOptions);

const Home: NextPage<InferGetServerSidePropsType<typeof getServerSideProps>> = ({ query }) => {
  const [search, setSearch] = useQueryParam("search", initialQueryParams);
  const [sortBy, setSortBy] = useQueryParam("sortBy", initialQueryParams);

  const [searchParams, setSearchParams] = useQueryParams(initialQueryParams);

  console.log(search, sortBy, searchParams);

  /// RENDER CODE
}

export const getServerSideProps: GetServerSideProps<{
  query: ParsedUrlQuery
}> = async (ctx) => {
  return {
    props: {
      query: ctx.query,
    }
  };
}

export default Home
```

## API Reference

### SetRouterQueryParamsOptions

Options for customizing router.push/replace behavior:

- `useExistingParams`: Merge with existing query params (default: false)
- `shallow`: Perform shallow routing (default: true)
- `locale`: Specify locale for internationalized routing
- `scroll`: Control scrolling behavior (default: true)
- `replace`: Replace the current history state instead of adding a new one (default: false).

### `createQueryParamStore(schema, routerOptions?: SetRouterQueryParamsOptions)`

Creates hooks for managing query parameters.

- `schema`: Zod schema for validating query parameters
- `routerOptions`: (Optional) Default options for router.push/router.replace

Returns an object with two hooks:
- `useQueryParam`: Hook for managing a single query parameter
- `useQueryParams`: Hook for managing multiple query parameters

#### `useQueryParam(key, initialQuery?: ParsedUrlQuery)`

Hook for managing a single query parameter.

- `key`: The key of the query parameter to manage
- `initialQuery`: (Optional) Initial query values, useful for server-side rendering

Returns:
- Current value of the parameter
- Setter function for updating the parameter

#### `useQueryParams(initialQuery?: ParsedUrlQuery)`

Hook for managing multiple query parameters.

- `initialQuery`: (Optional) Initial query values, useful for server-side rendering

Returns:
- Object containing all current query parameters
- Setter function for updating multiple parameters
