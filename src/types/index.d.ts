import type { ModuleOptions } from './options';
import type { Auth } from '../runtime';
import type { Store, Pinia, StoreGeneric } from 'pinia';
import * as NuxtSchema from '@nuxt/schema';
import type { CookieSerializeOptions } from 'cookie-es';

export * from './openIDConnectConfigurationDocument';
export * from './provider';
export * from './request';
export * from './router';
export * from './scheme';
export * from './strategy';
export * from './utils';
export * from './options';

export type AuthStoreDefinition = Store<string, AuthState, {}, {
    /**
     * Returns a store, creates it if necessary.
     *
     * @param pinia - Pinia instance to retrieve the store
     * @param hot - dev only hot module replacement
     */
    (pinia?: Pinia | null | undefined, hot?: StoreGeneric): Store<Id, S, G, A>;
    /**
     * Sets the key/value pair for the auth module's auth state.
     *
     * @param payload - object containing the key and value
     */
    SET(payload: any): void;
}>

export type StoreMethod = 'cookie' | 'session' | 'local';

export interface StoreIncludeOptions {
    cookie?: boolean | CookieSerializeOptions;
    session?: boolean;
    local?: boolean;
}

export interface UserInfo {
    [key: string]: unknown;
}

export type AuthState = {
    [key: string]: unknown;
    // user object
    user?: UserInfo;
    // indicates whether the user is logged in
    loggedIn?: boolean;
    // indicates the strategy of authentication used
    strategy?: string;
    // indicates if the authentication system is busy performing tasks, may not be defined initially
    busy?: boolean;
}

declare module '#app' {
    interface NuxtApp {
        $auth: Auth;
    }
}

declare module '@nuxt/schema' {
    interface NuxtConfig {
        ['auth']?: Partial<ModuleOptions>
    }
    interface NuxtOptions {
        ['auth']?: ModuleOptions
    }
}

declare const NuxtAuth: NuxtSchema.NuxtModule<ModuleOptions>

export {
    ModuleOptions,
    NuxtAuth as default
};

