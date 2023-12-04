import type { Strategy } from './strategy';
import type { NuxtPlugin } from '@nuxt/schema';
import type { AuthState, RefreshableScheme, TokenableScheme } from './index';
import type { CookieSerializeOptions } from 'cookie-es';
import type { Auth } from '../runtime'

export interface ModuleOptions {
    globalMiddleware?: boolean;
    enableMiddleware?: boolean;
    plugins?: (NuxtPlugin | string)[];
    strategies?: Record<string, Strategy>;
    ignoreExceptions: boolean;
    resetOnError: boolean | ((...args: any[]) => boolean);
    resetOnResponseError: boolean | ((error: any, auth: Auth, scheme: TokenableScheme | RefreshableScheme) => void);
    defaultStrategy: string | undefined;
    watchLoggedIn: boolean;
    rewriteRedirects: boolean;
    fullPathRedirect: boolean;
    redirectStrategy?: 'query' | 'storage';
    scopeKey: string;
    stores: Partial<{
        state: {
            namespace?: string
        };
        pinia: {
            enabled: boolean;
            namespace?: string;
        };
        cookie: {
            enabled: boolean;
            prefix?: string;
            options?: CookieSerializeOptions;
        };
        local: { 
            enabled: boolean;
            prefix?: string; 
        };
        session: { 
            enabled: boolean;
            prefix?: string;
        };
    }>,
    redirect: {
        login: string | ((auth: Auth, trans?: Function) => string);
        logout: string | ((auth: Auth, trans?: Function) => string);
        callback: string | ((auth: Auth, trans?: Function) => string);
        home: string | ((auth: Auth, trans?: Function) => string);
    };
    initialState?: AuthState;
}
