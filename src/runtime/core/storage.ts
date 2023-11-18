import type { ModuleOptions, AuthStoreDefinition, AuthState, StoreMethod, StoreIncludeOptions } from '../../types';
import type { NuxtApp } from '#app';
import { isUnset, isSet, decodeValue, encodeValue, setH3Cookie } from '../../utils';
import { defineStore, type Pinia } from 'pinia';
import { parse, serialize } from 'cookie-es';

export class Storage {
    ctx: NuxtApp;
    options: ModuleOptions;
    #store!: AuthStoreDefinition;
    #initStore!: AuthStoreDefinition;
    state: AuthState = {};
    #state: AuthState = {};
    #piniaEnabled: boolean = false;

    constructor(ctx: NuxtApp, options: ModuleOptions) {
        this.ctx = ctx;
        this.options = options;

        this.#initState();
    }

    // ------------------------------------
    // Universal
    // ------------------------------------

    setUniversal<V extends any>(key: string, value: V, include: StoreIncludeOptions = { cookie: true, session: true, local: true }): V | void {
        // Unset null, undefined
        if (isUnset(value)) {
            return this.removeUniversal(key);
        }

        // Set in all included stores
        const storeMethods: Record<StoreMethod, Function> = {
            cookie: (k: string, v: any) => this.setCookie(k, v),
            session: (k: string, v: any) => this.setSessionStorage(k, v),
            local: (k: string, v: any) => this.setLocalStorage(k, v)
        }

        Object.entries(include).filter(([_, shouldInclude]) => shouldInclude).forEach(([method, _]) => storeMethods[method as StoreMethod]?.(key, value));

        // Local state
        this.setState(key, value);

        return value;
    }

    getUniversal(key: string): any {
        const sourceOrder = [
            () => this.getCookie(key),
            () => this.getLocalStorage(key),
            () => this.getSessionStorage(key),
            () => this.getState(key),
        ];

        if (process.server) {
            sourceOrder.unshift(() => this.getState(key));
        }

        for (let getter of sourceOrder) {
            const value = getter();
            if (!isUnset(value)) {
                return value;
            }
        }
    }

    syncUniversal(key: string, defaultValue?: any): any {
        let value = this.getUniversal(key);

        if (isUnset(value) && isSet(defaultValue)) {
            value = defaultValue;
        }

        if (isSet(value)) {
            this.setUniversal(key, value);
        }

        return value;
    }

    removeUniversal(key: string): void {
        this.removeState(key);
        this.removeCookie(key);
        this.removeLocalStorage(key);
        this.removeSessionStorage(key);
    }

    // ------------------------------------
    // Local state (reactive)
    // ------------------------------------

    #initState(): void {
        // Private state is suitable to keep information not being exposed to pinia store
        // This helps prevent stealing token from SSR response HTML
        this.#state = {};

        // Use pinia for local state's if possible
        const pinia = this.ctx.$pinia as Pinia
        this.#piniaEnabled = this.options.pinia && !!pinia;

        if (this.#piniaEnabled) {
            this.#store = defineStore(this.options.pinia.namespace, {
                state: () => ({ ...this.options.initialState }),
                actions: {
                    SET(payload: any) {
                        this.$patch({ [payload.key]: payload.value });
                    },
                }
            }) as unknown as AuthStoreDefinition;

            this.#initStore = this.#store(pinia);
            this.state = this.#initStore.$state;
        } else {
            this.state = {};

            console.warn('[AUTH] The pinia store is not activated. This might cause issues in auth module behavior, like redirects not working properly. To activate it, please install it and add it to your config after this module');
        }
    }

    get store() {
        return this.#initStore;
    }

    getStore() {
        return this.#initStore;
    }

    setState(key: string, value: any) {
        if (key.startsWith('_')) {
            this.#state[key] = value;
        }
        else if (this.#piniaEnabled) {
            const { SET } = this.#initStore;
            SET({ key, value });
        }
        else {
            this.state[key] = value;
        }

        return this.state[key];
    }

    getState(key: string) {
        if (!key.startsWith('_')) {
            return this.state[key];
        } else {
            return this.#state[key] as AuthState;
        }
    }

    watchState(watchKey: string, fn: (value: any) => void) {
        if (this.#piniaEnabled) {
            return this.#initStore.$onAction((context) => {
                if (context.name === 'SET') {
                    const { key, value } = context.args[0];
                    if (watchKey === key) {
                        fn(value);
                    }
                }
            });
        }
    }

    removeState(key: string): void {
        this.setState(key, undefined);
    }

    // ------------------------------------
    // Local storage
    // ------------------------------------

    setLocalStorage<V extends any>(key: string, value: V): V | void {
        if (isUnset(value)) {
            return this.removeLocalStorage(key);
        }

        if (!this.isLocalStorageEnabled()) return;

        try {
            const prefixedKey = `${this.getLocalStoragePrefix()}${key}`;
            localStorage.setItem(prefixedKey, encodeValue(value));
        } catch (e) {
            if (!this.options.ignoreExceptions) throw e;
        }

        return value;
    }

    getLocalStorage(key: string): any {
        if (!this.isLocalStorageEnabled()) {
            return;
        }

        const prefixedKey = `${this.getLocalStoragePrefix()}${key}`;

        return decodeValue(localStorage.getItem(prefixedKey));
    }

    removeLocalStorage(key: string): void {
        if (!this.isLocalStorageEnabled()) {
            return;
        }

        const prefixedKey = `${this.getLocalStoragePrefix()}${key}`;

        localStorage.removeItem(prefixedKey);
    }

    getLocalStoragePrefix(): string {
        if (!this.options.localStorage) {
            throw new Error('Cannot get prefix; localStorage is off');
        }

        return this.options.localStorage.prefix;
    }

    isLocalStorageEnabled(): boolean {
        const isNotServer = !process.server;
        const isConfigEnabled = !!this.options.localStorage;
        const localTest = "test";

        if (isNotServer && isConfigEnabled) {
            try {
                localStorage.setItem(localTest, localTest);
                localStorage.removeItem(localTest);
                return true;
            } catch (e) {
                if (!this.options.ignoreExceptions) {
                    console.warn('[AUTH] Local storage is enabled in config, but the browser does not support it.');
                }
            }
        }

        return false;
    }

    // ------------------------------------
    // Session storage
    // ------------------------------------

    setSessionStorage<V extends any>(key: string, value: V): V | void {
        if (isUnset(value)) {
            return this.removeSessionStorage(key)
        }

        if (!this.isSessionStorageEnabled()) return;

        try {
            const prefixedKey = `${this.getSessionStoragePrefix()}${key}`;
            sessionStorage.setItem(prefixedKey, encodeValue(value));
        } catch (e) {
            if (!this.options.ignoreExceptions) throw e;
        }

        return value;
    }

    getSessionStorage(key: string): any {
        if (!this.isSessionStorageEnabled()) {
            return
        }

        const $key = this.getSessionStoragePrefix() + key

        const value = sessionStorage.getItem($key)

        return decodeValue(value)
    }

    removeSessionStorage(key: string): void {
        if (!this.isSessionStorageEnabled()) {
            return
        }

        const $key = this.getSessionStoragePrefix() + key

        sessionStorage.removeItem($key)
    }

    getSessionStoragePrefix(): string {
        if (!this.options.sessionStorage) {
            throw new Error('Cannot get prefix; sessionStorage is off');
        }

        return this.options.sessionStorage.prefix;
    }

    isSessionStorageEnabled(): boolean {
        const isNotServer = !process.server;
        const isConfigEnabled = !!this.options.sessionStorage;
        const testKey = "test";

        if (isNotServer && isConfigEnabled) {
            try {
                sessionStorage.setItem(testKey, testKey);
                sessionStorage.removeItem(testKey);
                return true;
            } catch (e) {
                if (!this.options.ignoreExceptions) {
                    console.warn('[AUTH] Session storage is enabled in config, but the browser does not support it.');
                }
            }
        }

        return false;
    }

    // ------------------------------------
    // Cookies
    // ------------------------------------

    setCookie<V extends any>(key: string, value: V, options: ModuleOptions['cookie'] = {}) {
        if (!this.isCookiesEnabled()) {
            return;
        }

        const prefix = options.prefix ?? this.options.cookie.prefix;
        const $key = `${prefix}${key}`;
        const $value = encodeValue(value);
        const $options = { ...this.options.cookie.options, ...options };

        // Unset null, undefined
        if (isUnset(value)) {
            $options.maxAge = -1;
        }

        const cookieString = serialize($key, $value, $options);

        if (process.client) {
            document.cookie = cookieString;
        } else if (process.server && this.ctx.ssrContext?.event.node.res) {
            setH3Cookie(this.ctx.ssrContext.event, cookieString);
        }
    }

    getCookies(): Record<string, any> | void {
        if (!this.isCookiesEnabled()) {
            return;
        }

        const cookieStr = process.client ? document.cookie : this.ctx.ssrContext!.event.node.req.headers.cookie;

        return parse(cookieStr as string || '') || {}
    }

    getCookie(key: string): string | null | undefined {
        if (!this.isCookiesEnabled()) {
            return;
        }

        const $key = this.options.cookie.prefix + key;
        const cookies = this.getCookies();

        return decodeValue(cookies![$key] ? decodeURIComponent(cookies![$key] as string) : undefined)
    }

    removeCookie(key: string, options?: ModuleOptions['cookie']): void {
        this.setCookie(key, undefined, options);
    }

    isCookiesEnabled(): boolean {
        const isNotClient = process.server;
        const isConfigEnabled = !!this.options.cookie;
    
        if (isConfigEnabled) {
            if (isNotClient || window.navigator.cookieEnabled) return true;
            console.warn('[AUTH] Cookies are enabled in config, but the browser does not support it.');
        }

        return false;
    }
}
