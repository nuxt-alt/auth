> Alternative Auth module for [Nuxt](https://nuxt.com)

## Info

This module is meant as an alternative to @nuxtjs/auth, except this is for nuxt3 only with no backwards compatibility support. This will only work with pinia, I had originally had it work with vuex, but since that is in maintenece mode, I decided to switch to pinia. If you find any bugs please do tell me, I'm still working on this.

## Setup

1. Add `@nuxt-alt/auth` `@pinia/nuxt` `pinia` and `@nuxt-alt/http` dependency to your project

```bash
yarn add @nuxt-alt/auth @nuxt-alt/http @pinia/nuxt pinia
```

2. Add `@nuxt-alt/auth` and `@pinia/nuxt` to the `modules` section of `nuxt.config.ts`

**Note:** you dont need to specify `@nuxt-alt/http`, it will automatically be added but if you want to manually add it, make sure it is below the auth module (and above the proxy module if you are using it)

```ts
export default defineNuxtConfig({
    modules: [
        '@nuxt-alt/auth',
        '@pinia/nuxt'
    ],
    auth: {
        /* module options */
    }
});

```

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

### `pinia.namespace`

- Type: `String`
- Default: `auth`

Changed from vuex to pinia, this is the namespace to use for the pinia store.

### `pinia.persist`

- Type: `boolean | PersistedStateOptions | PersistedStateOptions[];`
- Default: `false`

Persist options to use for the `pinia-plugin-persistedstate` plugin.

### `pinia.persistType`

- Type: `undefined | plugin | nuxt`
- Default: `undefined`

The `pinia-plugin-persistedstate` has a nuxt module readily avalable to use, if you are not using the nuxt module set this options to 'plugin'

### `sessionStorage`

- Type: `String | False`
- Default: `auth.`

Similar to the localstorage option, there is a session storage options available for you to use.

### `redirectStrategy`

- Type: `query | storage`
- Default: `storage`

The type of redirection strategy you want to use, `storage` utilizng localStorage for redirects, `query` utilizing the route query parameters.

## Tokens (Types)

In addition to [Auth Tokens](https://auth.nuxtjs.org/api/tokens);

By default the `$auth.strategy` getter uses the `Scheme` type which does not have `token` or `refreshToken` property types. To help with this, a `$auth.refreshStrategy` and a `$auth.tokenStrategy` getter have been added for typing. They all do the same thing, this is just meant for type hinting.

## Cookie-based auth

The cookie scheme has been decoupled from the local scheme as it does not utitlize tokens, rather it it uses cookies.

There is a new `cookie.server` property, this indicates that the cookie we will be looking for will be set upon login otherwise we will be looking at a client/browser cookie. There has also been 2 user properties one for the client/browser and one for the server. An example config looks like this:

```ts
auth: {
    strategies: {
        localStorage: false,
        cookie: {
            cookie: {
                server: true
            },
            endpoints: {
                login: { 
                    url: '/api/user/login', 
                    method: 'post' 
                },
                user: { 
                    url: '/api/user/me', 
                    method: 'get' 
                }
            },
            user: {
                property: {
                    client: false,
                    server: false
                }
            }
        },
    }
}
```

## Pinia Persist (Experimental)

Ive added compatibility with the `pinia-plugin-persistedstate` plguin. please takea look at that plugin's documentation for nuxt and/or plugin usage. I'm still experimenting with it so there may be bugs with it's usage. Documentation has been provided on the options available to you if you decide to use this.

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
