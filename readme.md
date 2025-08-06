# react-url-query-parameter-store

[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![Version](https://badgen.net/npm/v/react-url-query-parameter-store)](https://www.npmjs.com/package/react-url-query-parameter-store)
[![Total Downloads](https://badgen.net/npm/dt/react-url-query-parameter-store)](https://www.npmjs.com/package/react-url-query-parameter-store)
[![License](https://badgen.net/npm/license/react-url-query-parameter-store)](https://www.npmjs.com/package/react-url-query-parameter-store)
[![Bundle Size (Minified and Zipped)](https://img.shields.io/bundlephobia/minzip/react-url-query-parameter-store)](https://bundlephobia.com/package/react-url-query-parameter-store)

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
  "next": "^14.2.4",
  "lodash": "^4.17.21"
}
```

> Note: It may work with older versions of the packages above too. I have personally tested it with Next 12.0.0 and it worked.
## Features & Use Cases

### Core Features
- Manage application state using URL query parameters
- Type-safe with Zod schema validation
- Seamless integration with Next.js Router. **Support for other routers will come soon.**
- Support for single and multiple query parameters
- Customizable router push options
  - Performs shallow routing by default but this is customizable for the entire store or just on a per-use basis.
- Server-side rendering support
  - Allows you to specify initial query values when the router itself is not ready.
- Listens for URL updates outside of the hooks and makes sure its own state is always up to date.
- The library internally does shallow comparisons to prevent unnecessary re-renders.

### Common Use Cases

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

### Examples

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
 */
const routerOptions: SetRouterQueryParamsOptions = { shallow: false, locale: 'en', scroll: true };

const { useQueryParam, useQueryParams, clearQueryParams } = createQueryParamStore(searchParamsSchema, routerOptions);

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

/////////////////////////////
// To clear:
/////////////////////////////

// Clear all tracked parameters from URL
clearQueryParams();

// Clear specific parameters
clearQueryParams(['search']);

// Reset parameters to their schema defaults instead of removing
clearQueryParams(undefined, { resetToDefaults: true });

// Reset specific parameters to defaults
clearQueryParams(['sortBy'], { resetToDefaults: true });
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
 */
const routerOptions: SetRouterQueryParamsOptions = { shallow: false, locale: 'en', scroll: true };

const { useQueryParam, useQueryParams, clearQueryParams } = createQueryParamStore(searchParamsSchema, routerOptions);

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

- `shallow`: Perform shallow routing (default: true)
- `locale`: Specify locale for internationalized routing
- `scroll`: Control scrolling behavior (default: true)
- `replace`: Replace the current history state instead of adding a new one (default: false)
- `logErrorsToConsole`: Log validation and routing errors to console
- `keepEmptyParameters`: Keep empty values in URL instead of removing them

### SetQueryParamOptions

Everything in `SetRouterQueryParamsOptions` along with:

- `pathname`: string - Specify the pathname for the URL. Query parameters are added automatically.
- `resetToDefaults`: boolean - Reset parameters to their Zod schema defaults instead of removing them (used with `clearQueryParams`)

This type extends `SetRouterQueryParamsOptions` to provide more granular control over URL updates. It allows you to change the pathname while updating query parameters, which can be useful for navigating between different pages or routes while maintaining specific query parameter states.

### `createQueryParamStore(schema, routerOptions?: SetRouterQueryParamsOptions)`

Creates hooks for managing query parameters.

- `schema`: Zod schema for validating query parameters
- `routerOptions`: (Optional) Default options for router.push/router.replace

Returns an object with three functions:
- `useQueryParam`: Hook for managing a single query parameter
- `useQueryParams`: Hook for managing multiple query parameters
- `clearQueryParams`: Function for clearing query parameters (can be used outside React components)

#### `useQueryParam(key, initialQuery?: ParsedUrlQuery)`

Hook for managing a single query parameter.

- `key`: The key of the query parameter to manage
- `initialQuery`: (Optional) Initial query values, useful for server-side rendering

Returns:
- Current value of the parameter
- Setter function for updating the parameter (accepts `SetQueryParamOptions`)

#### `useQueryParams(initialQuery?: ParsedUrlQuery)`

Hook for managing multiple query parameters.

- `initialQuery`: (Optional) Initial query values, useful for server-side rendering

Returns:
- Object containing all current query parameters
- Setter function for updating multiple parameters (accepts `SetQueryParamOptions`)

#### `clearQueryParams(keys?: Array<keyof Schema>, options?: SetQueryParamOptions)`

Function for clearing query parameters from the URL.

- `keys`: (Optional) Array of parameter keys to clear. If not provided, clears all tracked parameters
- `options`: (Optional) Navigation options, including `resetToDefaults` to reset to schema defaults instead of removing

Returns:
- Promise<boolean> indicating success or failure

This function can be used outside of React components and provides two modes:
1. Without `resetToDefaults`: Completely removes parameters from the URL
2. With `resetToDefaults: true`: Sets parameters to their Zod schema default values

## Important Notes

### Initialization Behavior

When using `useQueryParam` or `useQueryParams` hooks, the `initialQueryParams` are only used for the first initialization of the store. Subsequent calls to these hooks with different `initialQueryParams` will not affect the store's state. This ensures consistency across your application but may lead to unexpected behavior if not properly understood.

Example:

```typescript
// This will initialize the store with { search: 'initial' }
const [search1, setSearch1] = useQueryParam("search", { search: 'initial' });

// This will use the same store, initialized above. The { search: 'different' } will be ignored.
const [search2, setSearch2] = useQueryParam("search", { search: 'different' });

console.log(search1 === search2); // true
```

If you need to reset or change the initial state of the store, you'll need to create a new store instance using `createQueryParamStore`.

### Zod Default Values and `undefined` Behavior

**⚠️ Important:** When using Zod schemas with default values, be aware of how `undefined` values are handled:

```typescript
const schema = z.object({
  status: z.string().default('active'),
  count: z.coerce.number().default(0)
});
```

When you set a parameter to `undefined`, Zod will automatically apply the default value:

```typescript
// Setting to undefined
setParams({ status: undefined }); // Results in status: 'active' (the default)

// This means these two operations have the same effect:
clearQueryParams(undefined, { resetToDefaults: true }); // Sets to defaults
setParams({ status: undefined, count: undefined }); // Also sets to defaults
```

This behavior can be surprising because:
1. You might expect `undefined` to remove the parameter from the URL
2. Instead, it applies the schema's default value
3. This makes it impossible to truly "clear" a parameter that has a default value

**Recommendation:** Be cautious when using Zod default values with URL query parameters. Consider:
- Using `.optional()` without `.default()` if you want parameters to be truly removable
- Using runtime initial values instead of schema defaults for more predictable behavior
- Being explicit about when you want to reset to defaults vs. clear parameters

### `clearQueryParams` Behavior

The `clearQueryParams` function has two distinct modes:

1. **Without `resetToDefaults`** (default): Completely removes parameters from the URL
   ```typescript
   clearQueryParams(); // Removes all tracked params from URL
   clearQueryParams(['search']); // Removes only 'search' param from URL
   ```

2. **With `resetToDefaults: true`**: Sets parameters to their Zod schema default values
   ```typescript
   clearQueryParams(undefined, { resetToDefaults: true }); // Sets all params to defaults
   clearQueryParams(['search'], { resetToDefaults: true }); // Sets only 'search' to its default
   ```

Note: The `resetToDefaults` option only works with Zod schema defaults, not runtime initial values.
