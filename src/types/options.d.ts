import type { Strategy } from './strategy';
import type { NuxtPlugin } from '@nuxt/schema';
import type { AuthState } from './index';
import type { CookieSerializeOptions } from 'cookie-es';

export interface ModuleOptions {
    globalMiddleware?: boolean;
    enableMiddleware?: boolean;
    plugins?: (NuxtPlugin | string)[];
    strategies?: Record<string, Strategy>;
    ignoreExceptions: boolean;
    resetOnError: boolean | ((...args: any[]) => boolean);
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
        login: string;
        logout: string;
        callback: string;
        home: string;
    };
    initialState?: AuthState;
}
