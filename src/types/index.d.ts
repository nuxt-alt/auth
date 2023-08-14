import type { ModuleOptions } from './options';
import type { NuxtSSRContext } from '#app';
import type { Auth } from '../runtime';
import type { Store, Pinia, StoreGeneric } from 'pinia';

export * from './openIDConnectConfigurationDocument';
export * from './provider';
export * from './request';
export * from './router';
export * from './scheme';
export * from './strategy';
export * from './utils';
export * from './options';

type AuthStoreDefinition = Store<string, AuthState, {}, {
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

interface AuthState {
    // the interface can also hold additional properties with keys can be number, string, or symbol.
    //[key: string]: unknown;
    // user object may not be defined initially, keys can be number, string, or symbol with unknown value
    user?: {
        [key: string]: unknown;
    };
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
        ssrContext?: NuxtSSRContext;
    }
}

declare const NuxtAuth: NuxtSchema.NuxtModule<ModuleOptions>

export {
    ModuleOptions, 
    AuthState,
    AuthStoreDefinition,
    NuxtAuth as default 
};

