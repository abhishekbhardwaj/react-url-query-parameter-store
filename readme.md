# react-url-query-parameter-store

[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![Version](https://badgen.net/npm/v/react-url-query-parameter-store)](https://www.npmjs.com/package/react-url-query-parameter-store)
[![Total Downloads](https://badgen.net/npm/dt/react-url-query-parameter-store)](https://www.npmjs.com/package/react-url-query-parameter-store)
[![License](https://badgen.net/npm/license/react-url-query-parameter-store)](https://www.npmjs.com/package/react-url-query-parameter-store)
[![Bundle Size (Minified and Zipped)](https://img.shields.io/bundlephobia/minzip/react-url-query-parameter-store)](https://bundlephobia.com/package/react-url-query-parameter-store)

An Efficient Query Parameter Management Tool for React

This library provides a robust solution for managing URL query parameters in React applications, with a focus on type-safety and efficiency. While it's not a traditional state management store, it offers powerful capabilities for handling query string validation and synchronization across your app.

Currently only works with Next.js's router but **support for other prominent routers** will be **added soon**.

## Use Cases

1. Search and Filter Functionality:
   Manage complex search parameters and filters in e-commerce or content-heavy applications.

   ```typescript
   import { z } from "zod";
   import { createUseQueryParams } from "@/query-parameter-store";

   const searchSchema = z.object({
     query: z.string().optional(),
     category: z.string().optional(),
     minPrice: z.number().optional(),
     maxPrice: z.number().optional(),
     sortBy: z.enum(["price", "relevance", "rating"]).optional(),
   });

   const useSearchParams = createUseQueryParams(searchSchema);

   function SearchComponent() {
     const [searchParams, setSearchParams] = useSearchParams();

     // Use searchParams in your component
     // Update params with setSearchParams
   }
   ```

2. Pagination State:
   Maintain page numbers and size in the URL for easy sharing and navigation.

   ```typescript
   import { z } from "zod";
   import { createUseQueryParam } from "@/query-parameter-store";

   const paginationSchema = z.object({
     page: z.number().int().positive().default(1),
     pageSize: z.number().int().positive().default(20),
   });

   const usePaginationParam = createUseQueryParam(paginationSchema);

   function PaginatedList() {
     const [page, setPage] = usePaginationParam("page");
     const [pageSize, setPageSize] = usePaginationParam("pageSize");

     // Use page and pageSize in your component
     // Update with setPage and setPageSize
   }
   ```

3. Form State Persistence:
   Keep form state in the URL for multi-step forms or to allow users to share partially filled forms.

   ```typescript
   import { z } from "zod";
   import { createUseQueryParams } from "@/query-parameter-store";

   const formSchema = z.object({
     name: z.string().optional(),
     email: z.string().email().optional(),
     age: z.number().int().positive().optional(),
   });

   const useFormParams = createUseQueryParams(formSchema);

   function UserForm() {
     const [formData, setFormData] = useFormParams();

     // Use formData in your form
     // Update with setFormData on input changes
   }
   ```

Additionally, this library can serve as a lightweight state management solution for React/Next.js applications, leveraging URL query parameters as the source of truth. By using `useSyncExternalStore`, it ensures efficient updates and synchronization across components in a highly performant way.

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

### Next.js Page Router Example

```tsx
import { z } from "zod";
import { useRouter } from 'next/router';
import { NextPage, GetServerSideProps, InferGetServerSidePropsType } from 'next';
import { type ParsedUrlQuery } from 'querystring';
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

const Home: NextPage<InferGetServerSidePropsType<typeof getServerSideProps>> = ({ query }) => {
  const [search, setSearch] = useSearchQueryParam("search", initialQueryParams);
  const [sortBy, setSortBy] = useSearchQueryParam("sortBy", initialQueryParams);

  const [searchParams, setSearchParams] = useSearchQueryParams(initialQueryParams);

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
