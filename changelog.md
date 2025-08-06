# [1.10.0](https://github.com/abhishekbhardwaj/react-url-query-parameter-store/compare/v1.9.0...v1.10.0) (2025-08-06)


### Features

* ✨ bugfixing and async/await support + proper clear/reset on params ([#3](https://github.com/abhishekbhardwaj/react-url-query-parameter-store/issues/3)) ([207fe30](https://github.com/abhishekbhardwaj/react-url-query-parameter-store/commit/207fe30e83fe942bd1b5f756e64805e9aa83849e))

# [1.9.0](https://github.com/abhishekbhardwaj/react-url-query-parameter-store/compare/v1.8.0...v1.9.0) (2024-11-20)


### Bug Fixes

* 🐛 update snapshot retrieval in useSyncExternalStore for query parameter initialization ([6193df0](https://github.com/abhishekbhardwaj/react-url-query-parameter-store/commit/6193df06beaa884b4772056df9557fd331419850))


### Features

* ✨ enable async parameter setting in query param store and update related tests ([f41703c](https://github.com/abhishekbhardwaj/react-url-query-parameter-store/commit/f41703c022e41fae290f7905c6123c1e2a741408))

# [1.8.0](https://github.com/abhishekbhardwaj/react-url-query-parameter-store/compare/v1.7.1...v1.8.0) (2024-10-24)


### Bug Fixes

* 🐛 enhance query parameter store for SSR and initialization scenarios ([7c1c7e4](https://github.com/abhishekbhardwaj/react-url-query-parameter-store/commit/7c1c7e45827c213d0ed312940cc85a6a41571f07))


### Features

* ✨ remove empty query parameters by default from the query parameters ([eea5b3a](https://github.com/abhishekbhardwaj/react-url-query-parameter-store/commit/eea5b3a4a550eff3ad1bf3cc27f3930edf66377f))

## [1.7.1](https://github.com/abhishekbhardwaj/react-url-query-parameter-store/compare/v1.7.0...v1.7.1) (2024-09-28)


### Bug Fixes

* 🐛 enhance default query parameter support + fix nested use of useQueryParam(s) ([78b650e](https://github.com/abhishekbhardwaj/react-url-query-parameter-store/commit/78b650ea7c90ecec0861216ccfbb86dd4ddd5521))

# [1.7.0](https://github.com/abhishekbhardwaj/react-url-query-parameter-store/compare/v1.6.0...v1.7.0) (2024-09-27)


### Features

* ✨ add lodash as a peer dependency and update package structure in configuration files ([4fe6ff5](https://github.com/abhishekbhardwaj/react-url-query-parameter-store/commit/4fe6ff5e09b216cd64c64d025e30c66ba8f19a5e))

# [1.6.0](https://github.com/abhishekbhardwaj/react-url-query-parameter-store/compare/v1.5.0...v1.6.0) (2024-09-26)


### Features

* ✨ add tests, enhance performance, add support for initial query parameters to the use* hooks, remove useExistingParams (not needed) ([#2](https://github.com/abhishekbhardwaj/react-url-query-parameter-store/issues/2)) ([9ef5474](https://github.com/abhishekbhardwaj/react-url-query-parameter-store/commit/9ef54741130bec7d7c0d99f49f49c1786933067e))

# [1.5.0](https://github.com/abhishekbhardwaj/react-url-query-parameter-store/compare/v1.4.0...v1.5.0) (2024-07-31)


### Bug Fixes

* 🐛 more flexible routing - account for query params not part of the zod schema ([0bfdac5](https://github.com/abhishekbhardwaj/react-url-query-parameter-store/commit/0bfdac5fd3656938acf23c5d63204329f9ab97b4))
* 🐛 redirect bug when we aren't tracking all query parameters; ([31867aa](https://github.com/abhishekbhardwaj/react-url-query-parameter-store/commit/31867aa4e7dc167771571ab39bfe55e1d567ac13))


### Features

* ✨ retain all query parameters on page transition ([efa463a](https://github.com/abhishekbhardwaj/react-url-query-parameter-store/commit/efa463a71f46bf3c39449e9f5c1dea6d5727c5cd))

# [1.4.0](https://github.com/abhishekbhardwaj/react-url-query-parameter-store/compare/v1.3.1...v1.4.0) (2024-07-23)


### Features

* ✨ allow for pathname changes when updating query param ([cca7779](https://github.com/abhishekbhardwaj/react-url-query-parameter-store/commit/cca7779f20aa2e55a85c825c14186953dc3df251))

## [1.3.1](https://github.com/abhishekbhardwaj/react-url-query-parameter-store/compare/v1.3.0...v1.3.1) (2024-07-20)


### Bug Fixes

* 🐛 dynamic query parameters ([4df98f9](https://github.com/abhishekbhardwaj/react-url-query-parameter-store/commit/4df98f9073a827006877dd843dde4e3eb7260f30))

# [1.3.0](https://github.com/abhishekbhardwaj/react-url-query-parameter-store/compare/v1.2.0...v1.3.0) (2024-07-20)


### Features

* ✨ better way to use + 1 store to power both useQueryParam and useQueryParams ([5b9c711](https://github.com/abhishekbhardwaj/react-url-query-parameter-store/commit/5b9c71172cfc10fd7b78e3b6d06b1b587abfc9c8))
* ✨ if a default value is specified in zod schema, shallow redirect user ([77f7253](https://github.com/abhishekbhardwaj/react-url-query-parameter-store/commit/77f7253ff1813de7b2d4d850b3d585bfc74469e2))

# [1.2.0](https://github.com/abhishekbhardwaj/react-url-query-parameter-store/compare/v1.1.2...v1.2.0) (2024-07-19)


### Features

* ✨ add support for router.replace ([fab0412](https://github.com/abhishekbhardwaj/react-url-query-parameter-store/commit/fab0412bc9fef6ba4273135d78dbc74882a5789a))

## [1.1.2](https://github.com/abhishekbhardwaj/react-url-query-parameter-store/compare/v1.1.1...v1.1.2) (2024-07-09)


### Bug Fixes

* 🐛 docs ([aea372f](https://github.com/abhishekbhardwaj/react-url-query-parameter-store/commit/aea372f28f12d68d973ea2f75286c84ad10faa18))

## [1.1.1](https://github.com/abhishekbhardwaj/react-url-query-parameter-store/compare/v1.1.0...v1.1.1) (2024-07-08)


### Bug Fixes

* 🐛 package.json description ([2f22cbf](https://github.com/abhishekbhardwaj/react-url-query-parameter-store/commit/2f22cbf9d3a3d09ee609a98b111ba90eddd56d8e))

# [1.1.0](https://github.com/abhishekbhardwaj/react-url-query-parameter-store/compare/v1.0.0...v1.1.0) (2024-07-08)


### Features

* ✨ version 1 - react-url-query-parameter-store ([9e64085](https://github.com/abhishekbhardwaj/react-url-query-parameter-store/commit/9e64085b1d3048df7ce955b895f2b10e84846b22))
