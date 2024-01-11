import type { HTTPRequest, HTTPResponse, Scheme, SchemeCheck, TokenableScheme, RefreshableScheme, ModuleOptions, Route, AuthState, } from '../../types';
import { ExpiredAuthSessionError } from '../inc/expired-auth-session-error';
import type { NuxtApp } from '#app';
import { isSet, getProp, isRelativeURL, routeMeta, hasOwn } from '../../utils';
import { Storage } from './storage';
import { isSamePath, withQuery } from 'ufo';
import requrl from 'requrl';

export type ErrorListener = (...args: any[]) => void;
export type RedirectListener = (to: string, from: string) => string;

export class Auth {
    ctx: NuxtApp;
    options: ModuleOptions;
    strategies: Record<string, Scheme> = {};
    $storage: Storage;
    $state: AuthState;
    error?: Error;
    #errorListeners?: ErrorListener[] = [];
    #redirectListeners?: RedirectListener[] = [];
    #tokenValidationInterval?: NodeJS.Timeout;

    constructor(ctx: NuxtApp, options: ModuleOptions) {
        this.ctx = ctx;

        if (typeof this.ctx.$localePath === 'function') {
            // @ts-ignore - package may or may not be installed
            this.ctx.hook('i18n:localeSwitched', () => {
                this.#transformRedirect(this.options.redirect);
            })
        }

        // Apply to initial options
        this.#transformRedirect(options.redirect);
        this.options = options;

        // Storage & State
        const initialState = {
            user: undefined,
            loggedIn: false,
            strategy: undefined,
            busy: false
        };

        const storage = new Storage(ctx, {
            ...this.options,
            initialState
        });

        this.$storage = storage;
        this.$state = storage.state;
    }

    #transformRedirect (redirects: typeof this.options.redirect) {
        for (const key in redirects) {
            const value = redirects[key as keyof typeof this.options.redirect];
            if (typeof value === 'string' && typeof this.ctx.$localePath === 'function') {
                redirects[key as keyof typeof this.options.redirect] = this.ctx.$localePath(value);
            }

            if (typeof value === 'function') {
                redirects[key as keyof typeof this.options.redirect] = value(this, typeof this.ctx.$localePath === 'function' ? this.ctx.$localePath as Function : undefined)
            }
        }

        return redirects;
    }

    #checkTokenValidation() {
        this.#tokenValidationInterval = setInterval(async () => {
            // Perform scheme checks.
            const { valid, tokenExpired, refreshTokenExpired, isRefreshable } = this.check(true);
            let isValid = valid;

            // Refresh token has expired. There is no way to refresh. Force reset.
            if (refreshTokenExpired) {
                this.reset?.();
                clearInterval(this.#tokenValidationInterval)
                throw new ExpiredAuthSessionError();
            }

            // Token has expired.
            if (tokenExpired) {
                // Refresh token is not available. Force reset.
                if (!isRefreshable) {
                    this.reset();
                    clearInterval(this.#tokenValidationInterval)
                    throw new ExpiredAuthSessionError();
                }

                // Refresh token is available. Attempt refresh.
                isValid = await this.refreshStrategy.refreshController
                    .handleRefresh()
                    .then(() => true)
                    .catch(() => {
                        // Tokens couldn't be refreshed. Force reset.
                        this.reset();
                        clearInterval(this.#tokenValidationInterval)
                        throw new ExpiredAuthSessionError();
                    });
            }

            // Sync token
            const token = this.tokenStrategy.token;

            // Scheme checks were performed, but returned that is not valid.
            if (!isValid) {
                if (token && !token.get()) {
                    clearInterval(this.#tokenValidationInterval)
                    throw new ExpiredAuthSessionError();
                }
            }
        }, typeof this.options.tokenValidationInterval === 'number' ? this.options.tokenValidationInterval : 1000)
    }

    getStrategy(throwException = true): Scheme {
        if (throwException) {
            if (!this.$state.strategy) {
                throw new Error('No strategy is set!');
            }
            if (!this.strategies[this.$state.strategy]) {
                throw new Error('Strategy not supported: ' + this.$state.strategy);
            }
        }

        return this.strategies[this.$state.strategy!];
    }

    get tokenStrategy(): TokenableScheme {
        return this.getStrategy() as TokenableScheme;
    }

    get refreshStrategy(): RefreshableScheme {
        return this.getStrategy() as RefreshableScheme;
    }

    get strategy(): Scheme {
        return this.getStrategy() as Scheme;
    }

    get user(): AuthState['user'] {
        return this.$state.user;
    }

    // ---------------------------------------------------------------
    // Strategy and Scheme
    // ---------------------------------------------------------------

    get loggedIn(): boolean {
        return this.$state.loggedIn!;
    }

    get busy(): boolean {
        return this.$storage.getState('busy') as boolean;
    }

    async init(): Promise<void> {
        // Reset on error
        if (this.options.resetOnError) {
            this.onError((...args) => {
                if (typeof this.options.resetOnError !== 'function' || this.options.resetOnError(...args)) {
                    this.reset();
                }
            });
        }

        // Restore strategy
        this.$storage.syncUniversal('strategy', this.options.defaultStrategy, { cookie: this.$state.loggedIn });

        // Set default strategy if current one is invalid
        if (!this.getStrategy(false)) {
            this.$storage.setUniversal('strategy', this.options.defaultStrategy, { cookie: this.$state.loggedIn });

            // Give up if still invalid
            if (!this.getStrategy(false)) {
                return Promise.resolve();
            }
        }

        try {
            // Call mounted for active strategy on initial load
            await this.mounted();
        }
        catch (error: any) {
            this.callOnError(error);
        }
        finally {
            if (process.client && this.options.watchLoggedIn) {
                const enableTokenValidation = !this.#tokenValidationInterval && this.refreshStrategy.token && this.options.tokenValidationInterval

                this.$storage.watchState('loggedIn', (loggedIn: boolean) => {
                    if (hasOwn(this.ctx.$router.currentRoute.value.meta, 'auth') && !routeMeta(this.ctx.$router.currentRoute.value, 'auth', false)) {
                        this.redirect(loggedIn ? 'home' : 'logout');
                    }

                    if (enableTokenValidation && loggedIn) {
                        this.#checkTokenValidation()
                    }
                })

                if (enableTokenValidation && this.loggedIn) {
                    this.#checkTokenValidation()
                }
            }
        }
    }

    registerStrategy(name: string, strategy: Scheme): void {
        this.strategies[name] = strategy;
    }

    async setStrategy(name: string): Promise<HTTPResponse<any> | void> {
        if (name === this.$storage.getUniversal('strategy')) {
            return Promise.resolve();
        }

        if (!this.strategies[name]) {
            throw new Error(`Strategy ${name} is not defined!`);
        }

        // Reset current strategy
        this.reset();

        // Set new strategy
        this.$storage.setUniversal('strategy', name, { cookie: this.$state.loggedIn });

        // Call mounted hook on active strategy
        return this.mounted();
    }

    async mounted(...args: any[]): Promise<HTTPResponse<any> | void> {
        if (!this.strategy.mounted) {
            return this.fetchUserOnce();
        }

        return Promise.resolve(this.strategy.mounted!(...args)).catch(
            (error) => {
                this.callOnError(error, { method: 'mounted' });
                return Promise.reject(error);
            }
        );
    }

    async loginWith(name: string, ...args: any[]): Promise<HTTPResponse<any> | void> {
        return this.setStrategy(name).then(() => this.login(...args));
    }

    async login(...args: any[]): Promise<HTTPResponse<any> | void> {
        if (!this.strategy.login) {
            return Promise.resolve();
        }

        return this.wrapLogin(this.strategy.login(...args)).catch(
            (error) => {
                this.callOnError(error, { method: 'login' });
                return Promise.reject(error);
            }
        );
    }

    async fetchUser(...args: any[]): Promise<HTTPResponse<any> | void> {
        if (!this.strategy.fetchUser) {
            return Promise.resolve();
        }

        return Promise.resolve(this.strategy.fetchUser(...args)).catch(
            (error) => {
                this.callOnError(error, { method: 'fetchUser' });
                return Promise.reject(error);
            }
        );
    }

    async logout(...args: any[]): Promise<void> {
        this.$storage.removeCookie('strategy')

        if (!this.strategy.logout) {
            this.reset();
            return Promise.resolve();
        }

        return Promise.resolve(this.strategy.logout!(...args)).catch(
            (error) => {
                this.callOnError(error, { method: 'logout' });
                return Promise.reject(error);
            }
        );
    }

    // ---------------------------------------------------------------
    // User helpers
    // ---------------------------------------------------------------

    async setUserToken(token: string | boolean, refreshToken?: string | boolean): Promise<HTTPResponse<any> | void> {
        if (!this.tokenStrategy.setUserToken) {
            this.tokenStrategy.token!.set(token);
            return Promise.resolve();
        }

        return Promise.resolve(this.tokenStrategy.setUserToken!(token, refreshToken)).catch((error) => {
            this.callOnError(error, { method: 'setUserToken' });
            return Promise.reject(error);
        });
    }

    reset(...args: any[]): void {
        if (this.tokenStrategy.token && !this.strategy.reset) {
            this.setUser(false);
            this.tokenStrategy.token!.reset();
            this.refreshStrategy.refreshToken.reset();
        }

        return this.strategy.reset!(...(args as [options?: { resetInterceptor: boolean }]));
    }

    async refreshTokens(): Promise<HTTPResponse<any> | void> {
        if (!this.refreshStrategy.refreshController) {
            return Promise.resolve();
        }

        return Promise.resolve(this.refreshStrategy.refreshController.handleRefresh()).catch((error) => {
            this.callOnError(error, { method: 'refreshTokens' });
            return Promise.reject(error);
        });
    }

    check(...args: any[]): SchemeCheck {
        if (!this.strategy.check) {
            return { valid: true };
        }

        return this.strategy.check!(...(args as [checkStatus: boolean]));
    }

    async fetchUserOnce(...args: any[]): Promise<HTTPResponse<any> | void> {
        if (!this.$state.user) {
            return this.fetchUser(...args);
        }

        return Promise.resolve();
    }

    // ---------------------------------------------------------------
    // Utils
    // ---------------------------------------------------------------

    setUser(user: AuthState | false, schemeCheck: boolean = true): void {
        this.$storage.setState('user', user);

        let check = { valid: Boolean(user) };

        // If user is defined, perform scheme checks.
        if (schemeCheck && check.valid) {
            check = this.check();
        }

        // Update `loggedIn` state
        this.$storage.setState('loggedIn', check.valid);
    }

    async request(endpoint: HTTPRequest, defaults: HTTPRequest = {}): Promise<HTTPResponse<any>> {
        const request = typeof defaults === 'object' ? Object.assign({}, defaults, endpoint) : endpoint;

        if (request.baseURL === '') {
            request.baseURL = requrl(process.server ? this.ctx.ssrContext!.event.node.req : undefined);
        }

        if (!this.ctx.$http) {
            return Promise.reject(new Error('[AUTH] add the @nuxt-alt/http module to nuxt.config file'));
        }

        const $http = process.server && this.ctx.ssrContext ? this.ctx.ssrContext.event.$http.raw(request) : this.ctx.$http.raw(request)

        return $http.catch((error: Error) => {
            // Call all error handlers
            this.callOnError(error, { method: 'request' });

            // Throw error
            return Promise.reject(error);
        })

    }

    async requestWith(endpoint?: HTTPRequest, defaults?: HTTPRequest): Promise<HTTPResponse<any>> {
        const request = Object.assign({}, defaults, endpoint);

        if (this.tokenStrategy.token) {
            const token = this.tokenStrategy.token!.get();

            const tokenName = this.tokenStrategy.options.token!.name || 'Authorization';

            if (!request.headers) {
                request.headers = {};
            }

            if (!request.headers[tokenName as keyof typeof request.headers] && isSet(token) && token && typeof token === 'string') {
                request.headers[tokenName as keyof typeof request.headers] = token;
            }
        }

        return this.request(request);
    }

    async wrapLogin(promise: Promise<HTTPResponse<any> | void>): Promise<HTTPResponse<any> | void> {
        this.$storage.setState('busy', true);
        this.error = undefined;

        return Promise.resolve(promise).then((response) => {
            this.$storage.setState('busy', false)
            this.$storage.syncUniversal('strategy', this.strategy.name);
            return response
        })
            .catch((error) => {
                this.$storage.setState('busy', false)
                return Promise.reject(error)
            })
    }

    onError(listener: ErrorListener): void {
        this.#errorListeners!.push(listener);
    }

    callOnError(error: Error, payload = {}): void {
        this.error = error;

        for (const fn of this.#errorListeners!) {
            fn(error, payload);
        }
    }

    /**
     *
     * @param name redirect name
     * @param route (default: false) Internal useRoute() (false) or manually specify
     * @param router (default: true) Whether to use nuxt redirect (true) or window redirect (false)
     *
     * @returns
     */
    redirect(name: string, route: Route | false = false, router: boolean = true) {
        if (!this.options.redirect) {
            return;
        }

        let to = this.options.redirect[name as keyof typeof this.options.redirect] as string;

        if (!to) {
            return;
        }

        const currentRoute = this.ctx.$router.currentRoute.value;
        const nuxtRoute = this.options.fullPathRedirect ? currentRoute.fullPath : currentRoute.path
        const from = route ? (this.options.fullPathRedirect ? route.fullPath : route.path) : nuxtRoute;

        const queryReturnTo = currentRoute.query.to;

        // Apply rewrites
        if (this.options.rewriteRedirects) {
            if (['logout', 'login'].includes(name) && isRelativeURL(from) && !isSamePath(to, from)) {
                if (this.options.redirectStrategy === 'query') {
                    to = to + '?to=' + encodeURIComponent((queryReturnTo ? queryReturnTo : from) as string);
                }

                if (this.options.redirectStrategy === 'storage') {
                    this.$storage.setUniversal('redirect', from);
                }
            }

            if (name === 'home') {
                let redirect = currentRoute.query.to ? decodeURIComponent(currentRoute.query.to as string) : undefined;

                if (this.options.redirectStrategy === 'storage') {
                    redirect = this.$storage.getUniversal('redirect') as string;
                    this.$storage.setUniversal('redirect', null)
                }

                if (redirect) {
                    to = redirect;
                }
            }
        }

        // Call onRedirect hook
        to = this.callOnRedirect(to, from) || to;

        // Prevent infinity redirects
        if (isSamePath(to, from)) {
            return;
        }

        if (this.options.redirectStrategy === 'storage') {
            if (this.options.fullPathRedirect) {
                to = withQuery(to, currentRoute.query);
            }
        }

        if (process.client && (!router || !isRelativeURL(to))) {
            return globalThis.location.replace(to)
        }
        else {
            return this.ctx.$router.push(typeof this.ctx.$localePath === 'function' ? this.ctx.$localePath(to) : to);
        }
    }

    onRedirect(listener: RedirectListener): void {
        this.#redirectListeners!.push(listener);
    }

    callOnRedirect(to: string, from: string): string {
        for (const fn of this.#redirectListeners!) {
            to = fn(to, from) || to;
        }
        return to;
    }

    hasScope(scope: string): boolean {
        const userScopes = this.$state.user && getProp(this.$state.user, this.options.scopeKey);

        if (!userScopes) {
            return false;
        }

        if (Array.isArray(userScopes)) {
            return userScopes.includes(scope);
        }

        return Boolean(getProp(userScopes, scope));
    }
}