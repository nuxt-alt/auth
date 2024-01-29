import type { Strategy, StrategyOptions } from './strategy';
import type { NuxtPlugin } from '@nuxt/schema';
import type { AuthState, RefreshableScheme, TokenableScheme } from './index';
import type { CookieSerializeOptions } from 'cookie-es';
import type { Auth } from '../runtime'

export interface ModuleOptions {
    /**
     * Whether the global middleware is enabled or not.
     * This option is disabled if `enableMiddleware` is `false`
     */
    globalMiddleware?: boolean;

    /**
     * Whether middleware is enabled or not.
     */
    enableMiddleware?: boolean;

    /**
     * Plugins to be used by the module.
     */
    plugins?: (NuxtPlugin | string)[];

    /**
     * Authentication strategies used by the module.
     */
    strategies?: Record<string, StrategyOptions>;

    /**
     * Whether exceptions should be ignored or not.
     */
    ignoreExceptions: boolean;

    /**
     * Whether the auth module should reset login data on an error.
     */
    resetOnError: boolean | ((...args: any[]) => boolean);

    /**
     * Whether to reset on a response error.
     */
    resetOnResponseError: boolean | ((error: any, auth: Auth, scheme: TokenableScheme | RefreshableScheme) => void);

    /**
     * Default authentication strategy to be used by the module.
     * This is used internally.
     */
    defaultStrategy: string | undefined;

    /**
     * Whether to watch user logged in state or not.
     */
    watchLoggedIn: boolean;

    /**
     * Interval for token validation.
     */
    tokenValidationInterval: boolean | number;

    /**
     * Whether to rewrite redirects or not.
     */
    rewriteRedirects: boolean;
    
    /**
     * Whether to redirect with full path or not.
     */
    fullPathRedirect: boolean;

    /**
     * Redirect strategy to be used: 'query' or 'storage'
     */
    redirectStrategy?: 'query' | 'storage';

    /**
     * Key for scope.
     */
    scopeKey: string;

    /**
     * Store options for the auth module. The `pinia` store will not
     * be utilized unless you enable it. By default `useState()` will be
     * used instead.
     */
    stores: Partial<{
        state: {
            namespace?: string
        };
        pinia: {
            enabled?: boolean;
            namespace?: string;
        };
        cookie: {
            enabled?: boolean;
            prefix?: string;
            options?: CookieSerializeOptions;
        };
        local: { 
            enabled: boolean;
            prefix?: string; 
        };
        session: { 
            enabled?: boolean;
            prefix?: string;
        };
    }>;

    /**
     * Redirect URL for login, logout, callback and home.
     * 
     * *Note:* The `trans` argument is only available if 
     * `nuxt/i18n` is available. 
     */
    redirect: {
        login: string | ((auth: Auth, trans?: Function) => string);
        logout: string | ((auth: Auth, trans?: Function) => string);
        callback: string | ((auth: Auth, trans?: Function) => string);
        home: string | ((auth: Auth, trans?: Function) => string);
    };

    /**
     * Initial state for Auth. This is used Internally.
     */
    initialState?: AuthState;
}
