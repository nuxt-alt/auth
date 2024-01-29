import type { ModuleOptions, AuthStore, AuthState, StoreMethod, StoreIncludeOptions } from '../../types';
import type { NuxtApp } from '#app';
import { type Pinia, type StoreDefinition, defineStore } from 'pinia';
import { isUnset, isSet, decodeValue, encodeValue, setH3Cookie } from '../../utils';
import { parse, serialize, type CookieSerializeOptions } from 'cookie-es';
import { watch, type Ref } from 'vue';
import { useState } from '#imports';

/**
 * @class Storage
 * @classdesc Storage class for stores and cookies
 * @param { NuxtApp } ctx - Nuxt app context
 * @param { ModuleOptions } options - Module options
 */
export class Storage {
    ctx: NuxtApp;
    options: ModuleOptions;
    #PiniaStore!: StoreDefinition;
    #initPiniaStore!: AuthStore;
    #initStore!: Ref<AuthState>;
    state: AuthState;
    #internal!: Ref<AuthState>;
    memory!: AuthState;
    #piniaEnabled: boolean = false;

    constructor(ctx: NuxtApp, options: ModuleOptions) {
        this.ctx = ctx;
        this.options = options;
        this.state = options.initialState!

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
            cookie: (k: string, v: V, o: CookieSerializeOptions) => this.setCookie(k, v, o),
            session: (k: string, v: V) => this.setSessionStorage(k, v),
            local: (k: string, v: V) => this.setLocalStorage(k, v)
        }

        Object.entries(include).filter(([_, shouldInclude]) => shouldInclude).forEach(([method, opts]) => {
            if (method === 'cookie' && typeof opts === 'object') {
                return storeMethods[method as StoreMethod]?.(key, value, opts)
            }

            return storeMethods[method as StoreMethod]?.(key, value)
        });

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

    syncUniversal(key: string, defaultValue?: any, include: StoreIncludeOptions = { cookie: true, session: true, local: true }): any {
        let value = this.getUniversal(key);

        if (isUnset(value) && isSet(defaultValue)) {
            value = defaultValue;
        }

        if (isSet(value)) {
            this.getCookie(key) ? this.setUniversal(key, value, { ...include, cookie: false }) : this.setUniversal(key, value, include);
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

    async #initState() {
        // Use pinia for local state's if possible
        const pinia = this.ctx.$pinia as Pinia
        this.#piniaEnabled = this.options.stores.pinia!?.enabled! && !!pinia;

        if (this.#piniaEnabled) {
            this.#PiniaStore = defineStore(this.options.stores.pinia?.namespace as string, {
                state: (): AuthState => ({ ...this.options.initialState })
            });

            this.#initPiniaStore = this.#PiniaStore(pinia)
            this.state = this.#initPiniaStore;
        } else {
            this.#initStore = useState<AuthState>(this.options.stores.state?.namespace as string, () => ({
                ...this.options.initialState
            }))

            this.state = this.#initStore.value
        }

        this.#internal = useState<AuthState>('auth-internal', () => ({}))
        this.memory = this.#internal.value
    }

    get pinia() {
        return this.#initPiniaStore;
    }

    get store() {
        return this.#initStore;
    }

    setState(key: string, value: any) {
        if (key.startsWith('_')) {
            this.memory[key] = value;
        }
        else if (this.#piniaEnabled) {
            this.#initPiniaStore.$patch({ [key]: value });
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
            return this.memory[key];
        }
    }

    watchState(watchKey: string, fn: (value: any) => void) {
        if (this.#piniaEnabled) {
            watch(() => this.#initPiniaStore?.[watchKey as keyof AuthStore], (modified) => {
                fn(modified)
            }, { deep: true })
        } else {
            watch(() => this.#initStore?.value?.[watchKey], (modified) => {
                fn(modified)
            }, { deep: true })
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
            const prefixedKey = `${this.options.stores.local?.prefix}${key}`;
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

        const prefixedKey = `${this.options.stores.local?.prefix}${key}`;

        return decodeValue(localStorage.getItem(prefixedKey));
    }

    removeLocalStorage(key: string): void {
        if (!this.isLocalStorageEnabled()) {
            return;
        }

        const prefixedKey = `${this.options.stores.local?.prefix}${key}`;

        localStorage.removeItem(prefixedKey);
    }

    isLocalStorageEnabled(): boolean {
        const isNotServer = !process.server;
        const isConfigEnabled = this.options.stores.local?.enabled;
        const localTest = 'test';

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
            const prefixedKey = `${this.options.stores!.session!.prefix}${key}`;
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

        const prefixedKey = this.options.stores!.session!.prefix + key

        const value = sessionStorage.getItem(prefixedKey)

        return decodeValue(value)
    }

    removeSessionStorage(key: string): void {
        if (!this.isSessionStorageEnabled()) {
            return
        }

        const prefixedKey = this.options.stores!.session!.prefix + key

        sessionStorage.removeItem(prefixedKey)
    }

    isSessionStorageEnabled(): boolean {
        const isNotServer = !process.server;
        // @ts-ignore
        const isConfigEnabled = this.options.stores!.session?.enabled;
        const testKey = 'test';

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
    // Cookie Storage
    // ------------------------------------

    setCookie<V extends any>(key: string, value: V, options: CookieSerializeOptions = {}) {
        if (!this.isCookiesEnabled()) {
            return;
        }

        const prefix = this.options.stores!.cookie?.prefix;
        const prefixedKey = `${prefix}${key}`;
        const $value = encodeValue(value);
        const $options = { ...this.options.stores.cookie?.options, ...options };

        // Unset null, undefined
        if (isUnset(value)) {
            $options.maxAge = -1;
        }

        const cookieString = serialize(prefixedKey, $value, $options);

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

        const prefixedKey = this.options.stores.cookie?.prefix + key;
        const cookies = this.getCookies();

        return decodeValue(cookies![prefixedKey] ? decodeURIComponent(cookies![prefixedKey] as string) : undefined)
    }

    removeCookie(key: string, options?: CookieSerializeOptions): void {
        this.setCookie(key, undefined, options);
    }

    isCookiesEnabled(): boolean {
        const isNotClient = process.server;
        const isConfigEnabled = this.options.stores.cookie?.enabled;

        if (isConfigEnabled) {
            if (isNotClient || window.navigator.cookieEnabled) return true;
            console.warn('[AUTH] Cookies are enabled in config, but the browser does not support it.');
        }

        return false;
    }
}
