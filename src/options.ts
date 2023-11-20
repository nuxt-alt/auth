import { type ModuleOptions } from "./types";

export const moduleDefaults: ModuleOptions = {
    // -- Enable Global Middleware --
    globalMiddleware: false,

    enableMiddleware: true,

    // -- Error handling --

    resetOnError: false,

    ignoreExceptions: false,

    // -- Authorization --

    scopeKey: 'scope',

    // -- Redirects --

    rewriteRedirects: true,

    fullPathRedirect: false,

    redirectStrategy: 'storage',

    routerStrategy: 'router',

    watchLoggedIn: true,

    redirect: {
        login: '/login',
        logout: '/',
        home: '/',
        callback: '/login',
    },

    stores: {
        pinia: {
            enabled: false,
            namespace: 'auth',
        },
        cookie: {
            enabled: true,
            prefix: 'auth.',
            options: {
                path: '/',
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
