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
    redirectStrategy?: 'query' | 'storage';
    routerStrategy?: string;
    scopeKey: string;
    stores: Partial<{
        pinia: {
            enabled: boolean;
            namespace?: string;
        };
        cookie: {
            enabled: boolean;
            prefix?: string;
            options?: {
                path?: string;
                expires?: Date;
                maxAge?: number;
                domain?: string;
                secure?: boolean;
                sameSite?: 'strict' | 'lax' | 'none';
                httpOnly?: boolean;
            };
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
