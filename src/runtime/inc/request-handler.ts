import type { TokenableScheme, RefreshableScheme } from '../../types';
import type { Auth } from '..'
import { ExpiredAuthSessionError } from './expired-auth-session-error';
import { FetchInstance, type FetchConfig } from '@refactorjs/ofetch';

export class RequestHandler {
    scheme: TokenableScheme | RefreshableScheme;
    auth: Auth;
    http: FetchInstance;
    requestInterceptor: number | null;
    responseErrorInterceptor: number | null;
    currentToken: string

    constructor(scheme: TokenableScheme | RefreshableScheme, http: FetchInstance, auth: Auth) {
        this.scheme = scheme;
        this.http = http;
        this.auth = auth;
        this.requestInterceptor = null;
        this.responseErrorInterceptor = null;
        this.currentToken = this.auth.$storage?.memory?.[this.scheme.options.token!?.prefix + this.scheme.options.name] as string
    }

    setHeader(token: string): void {
        if (this.scheme.options.token && this.scheme.options.token.global) {
            this.http.setHeader(this.scheme.options.token.name, token);
        }
    }

    clearHeader(): void {
        if (this.scheme.options.token && this.scheme.options.token.global) {
            // Clear Authorization token for all fetch requests
            this.http.setHeader(this.scheme.options.token.name, null);
        }
    }

    initializeRequestInterceptor(refreshEndpoint?: string | Request): void {
        this.requestInterceptor = this.http.onRequest(
            async (config: FetchConfig) => {
                // Set the token on the client side if not set
                if (this.scheme.options.token && this.currentToken) {
                    this.setHeader(this.currentToken)
                }

                // Don't intercept refresh token requests
                if ((this.scheme.options.token && !this.#needToken(config)) || config.url === refreshEndpoint) {
                    return config;
                }

                // Perform scheme checks.
                const { valid, tokenExpired, refreshTokenExpired, isRefreshable } = this.scheme.check!(true);
                let isValid = valid;

                // Refresh token has expired. There is no way to refresh. Force reset.
                if (refreshTokenExpired) {
                    this.scheme.reset?.();
                    throw new ExpiredAuthSessionError();
                }

                // Token has expired.
                if (tokenExpired) {
                    // Refresh token is not available. Force reset.
                    if (!isRefreshable) {
                        this.scheme.reset?.();
                        throw new ExpiredAuthSessionError();
                    }

                    // Refresh token is available. Attempt refresh.
                    isValid = await (this.scheme as RefreshableScheme).refreshController
                        .handleRefresh()
                        .then(() => true)
                        .catch(() => {
                            // Tokens couldn't be refreshed. Force reset.
                            this.scheme.reset?.();
                            throw new ExpiredAuthSessionError();
                        });
                }

                // Sync token
                const token = this.scheme.token;

                // Scheme checks were performed, but returned that is not valid.
                if (!isValid) {
                    // The authorization header in the current request is expired.
                    // Token was deleted right before this request
                    if (token && !token.get() && this.#requestHasAuthorizationHeader(config)) {
                        throw new ExpiredAuthSessionError();
                    }

                    return config;
                }

                // Token is valid, let the request pass
                // Fetch updated token and add to current request
                return this.#getUpdatedRequestConfig(config, token ? token.get() : false);
            }
        );

        this.responseErrorInterceptor = this.http.onResponseError(error => {
            if (typeof this.auth.options.resetOnResponseError === 'function') {
                this.auth.options.resetOnResponseError(error, this.auth, this.scheme)
            }
            else if (this.auth.options.resetOnResponseError && error?.response?.status === 401) {
                this.scheme.reset?.()
                throw new ExpiredAuthSessionError();
            }
        })
    }

    reset(): void {
        // Eject request interceptor
        this.http.interceptors.request.eject(this.requestInterceptor!);
        this.http.interceptors.response.eject(this.responseErrorInterceptor!);
        this.requestInterceptor = null;
        this.responseErrorInterceptor = null;
    }

    #needToken(config: FetchConfig): boolean {
        const options = this.scheme.options;
        return (options.token!.global || Object.values(options.endpoints!).some((endpoint) => typeof endpoint === 'object' ? endpoint!.url === config.url : endpoint === config.url));
    }

    // ---------------------------------------------------------------
    // Watch requests for token expiration
    // Refresh tokens if token has expired

    #getUpdatedRequestConfig(config: FetchConfig, token: string | boolean) {
        if (typeof token === 'string') {
            config.headers![this.scheme.options.token!.name as keyof HeadersInit] = token;
        }

        return config;
    }

    #requestHasAuthorizationHeader(config: FetchConfig): boolean {
        return !!config.headers![this.scheme.options.token!.name as keyof HeadersInit];
    }
}
