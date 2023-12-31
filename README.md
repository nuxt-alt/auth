<h1 align="center">Auth</h1>
<p align="center">Alternative Auth module for Nuxt</p>

<p align="center">
<a href="https://www.npmjs.com/package/@nuxt-alt/auth">
    <img alt="" src="https://img.shields.io/npm/v/@nuxt-alt/auth.svg?style=flat&colorA=18181B&colorB=28CF8D">
</a>
<a href="https://www.npmjs.com/package/@nuxt-alt/auth">
    <img alt="" src="https://img.shields.io/npm/dt/@nuxt-alt/auth.svg?style=flat&colorA=18181B&colorB=28CF8D">
</a>
</p>

## Info

This module is meant as an alternative to @nuxtjs/auth, except this is for nuxt3 only with no backwards compatibility support.

## Setup

1. Add `@nuxt-alt/auth` and `@nuxt-alt/http` dependency to your project

```bash
yarn add @nuxt-alt/auth @nuxt-alt/http
```

2. Add `@nuxt-alt/auth` and `@pinia/nuxt` to the `modules` section of `nuxt.config.ts`

**Note:** you dont need to specify `@nuxt-alt/http`, it will automatically be added but if you want to manually add it, make sure it is below the auth module (and above the proxy module if you are using it). It also doesn't need pinia
it will use nuxt's `useState` by default.

```ts
export default defineNuxtConfig({
    modules: [
        '@nuxt-alt/auth'
    ],
    auth: {
        /* module options */
    }
});

```

## Documentation
[Read Documentation](https://nuxt-alt-auth.vercel.app)

## Changes 

The module now uses '@nuxt-alt/http' to function, that module extends ohmyfetch. Please note that if you were using `data` to post data, you now need to use `body` since this is what `ohmyfetch` uses. If you intend to use ssr, please consider using the `@nuxt-alt/proxy` module.

## Composable

A `useAuth()` composable is availale to use to access the auth methods.

## Options
Most of the options are taken directly from the [@nuxtjs/auth](https://auth.nuxtjs.org/api/options) module. In addition there are some extra options available.

### `globalMiddleware`

- Type: `Boolean`
- Default: `false`

Enables/disables the middleware to be used globally.

### `enableMiddleware`

- Type: `Boolean`
- Default: `true`

Enables/disables the built-in middleware.

### `stores.state.namespace`

- Type: `String`
- Default: `auth`

This is the namespace to use for nuxt useState.

### `stores.pinia.enabled`
- Type: `Boolean`
- Default: `false`

Enable this option to use the pinia store, bey default this is disabled and nuxt's `useState` is used instead.

### `stores.pinia.namespace`

- Type: `String`
- Default: `auth`

This is the namespace to use for the pinia store.

### `stores.local.enabled`
- Type: `Boolean`
- Default: `true`

Enable this option to use the localStorage store.

### `stores.local.prefix`

- Type: `String`
- Default: `auth.`

This sets the localStorage prefix.

### `stores.session.enabled`
- Type: `Boolean`
- Default: `true`

Enable this option to use the sessionStorage store.

### `stores.session.prefix`

- Type: `String`
- Default: `auth.`

Similar to the localstorage option, this is the prefix for session storage.

### `stores.cookie.enabled`
- Type: `Boolean`
- Default: `true`

Enable this option to use the cookie storage.

### `stores.cookie.prefix`

- Type: `String`
- Default: `auth.`

Similar to the localstorage option, this is the prefix for the cookie storage.

### `stores.cookie.options`

- Type: `Object`
- Default: `{ path: '/' }`

The default cookie storage options.

### `redirectStrategy`

- Type: `query | storage`
- Default: `storage`

The type of redirection strategy you want to use, `storage` utilizng localStorage for redirects, `query` utilizing the route query parameters.

### `tokenValidationInterval`

- Type: `Boolean | Number`
- Default: `false`

This is experimental. If set to true, default interval is 1000ms, otherwise set time in milliseconds. This is how often the module with attempt to validate the token for expiry.

### `resetOnResponseError`

- Type: `Boolean | Function`
- Default: `false`

When enabled it will reset when there's a 401 error in any of the responses. You are able to turn this into a function to handle this yourself:
```ts
auth: {
    //... module options
    resetOnResponseError: (error, auth, scheme) => {
       if (error.response.status === 401) {
           scheme.reset?.()
           auth.redirect('login')
       }
   },
}
```

## TypeScript (2.6.0+)
The user information can be edited like so for TypeScript:
```ts
declare module '@nuxt-alt/auth' {
    interface UserInfo {
        email: string
        name: string
    }
}
```

## Tokens (Types)

In addition to [Auth Tokens](https://auth.nuxtjs.org/api/tokens);

By default the `$auth.strategy` getter uses the `Scheme` type which does not have `token` or `refreshToken` property types. To help with this, a `$auth.refreshStrategy` and a `$auth.tokenStrategy` getter have been added for typing. They all do the same thing, this is just meant for type hinting.

## Oauth2

Oauth2 now has client window authentication thanks to this pull request: https://github.com/nuxt-community/auth-module/pull/1746 

Properties have been changed to:

### `clientWindow`

- Type: `Boolean`
- Default: `false`

Enable/disable the use of a popup for client authentication.

### `clientWidth`

- Type: `Number`
- Default: `400`

The width of the client window.

### `clientHieght`

- Type: `Number`
- Default: `600`

The width of the client window.

## Aliases
Available aliases to use within nuxt

- `#auth/runtime`
- `#auth/utils`
- `#auth/providers`
