import { type ModuleOptions } from "./types";

export const moduleDefaults: ModuleOptions = {
    // -- Enable Global Middleware --
    globalMiddleware: false,

    enableMiddleware: true,

    // -- Error handling --

    resetOnError: false,

    resetOnResponseError: false,

    ignoreExceptions: false,

    // -- Authorization --

    scopeKey: 'scope',

    // -- Redirects --

    rewriteRedirects: true,

    fullPathRedirect: false,

    redirectStrategy: 'storage',

    watchLoggedIn: true,

    tokenValidationInterval: false,

    redirect: {
        login: '/login',
        logout: '/',
        home: '/',
        callback: '/login',
    },

    stores: {
        state: {
            namespace: 'auth'
        },
        pinia: {
            enabled: false,
            namespace: 'auth',
        },
        cookie: {
            enabled: true,
            prefix: 'auth.',
            options: {
                path: '/',
                sameSite: 'lax',
                maxAge: 31536000,
            },
        },
        local: {
            enabled: false,
            prefix: 'auth.',
        },
        session: {
            enabled: false,
            prefix: 'auth.',
        }, 
    },

    // -- Strategies --

    defaultStrategy: undefined /* will be auto set at module level */,

    strategies: {},
};
