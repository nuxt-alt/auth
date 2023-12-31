import type { _StoreWithState } from 'pinia';
import type { CookieSerializeOptions } from 'cookie-es';

export type AuthStore = _StoreWithState<string, AuthState, {}, {}> & {
    [key: string]: AuthState
}

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