import type { Strategy } from './strategy';
import type { NuxtPlugin } from '@nuxt/schema';
import type { AuthState } from './index';

export interface ModuleOptions {
    globalMiddleware?: boolean;
    enableMiddleware?: boolean;
    plugins?: (NuxtPlugin | string)[];
    strategies?: {
        [strategy: string]: Strategy | false;
    };
    ignoreExceptions: boolean;
    resetOnError: boolean | ((...args: any[]) => boolean);
    defaultStrategy: string | undefined;
    watchLoggedIn: boolean;
    rewriteRedirects: boolean;
    fullPathRedirect: boolean;
    redirectStrategy?: string;
    routerStrategy?: string;
    scopeKey: string;
    redirect: {
        login: string;
        logout: string;
        callback: string;
        home: string;
    };
    pinia: {
        namespace: string;
    };
    cookie: {
        prefix?: string;
        options?: {
            path?: string;
            expires?: Date | number;
            maxAge?: number;
            domain?: string;
            secure?: boolean;
            sameSite?: 'strict' | 'lax' | 'none';
        };
    };
    localStorage: { prefix: string; } | false;
    sessionStorage: { prefix: string; } | false;
    initialState?: AuthState;
}
