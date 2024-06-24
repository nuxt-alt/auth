import type { EndpointsOption, SchemePartialOptions, TokenableSchemeOptions, TokenableScheme, UserOptions, HTTPRequest, HTTPResponse, SchemeCheck } from '../../types';
import type { Auth } from '..';
import { getProp } from '../../utils';
import { Token, RequestHandler } from '../inc';
import { BaseScheme } from './base';

export interface LocalSchemeEndpoints extends EndpointsOption {
    login: HTTPRequest;
    logout: HTTPRequest | false;
    user: HTTPRequest | false;
}

export interface LocalSchemeOptions extends TokenableSchemeOptions {
    endpoints: LocalSchemeEndpoints;
    user: UserOptions;
    clientId: string;
    grantType: 'implicit' | 'authorization_code' | 'client_credentials' | 'password' | 'refresh_token' | 'urn:ietf:params:oauth:grant-type:device_code';
    scope: string | string[];
}

const DEFAULTS: SchemePartialOptions<LocalSchemeOptions> = {
    name: 'local',
    endpoints: {
        login: {
            url: '/api/auth/login',
            method: 'post',
        },
        logout: {
            url: '/api/auth/logout',
            method: 'post',
        },
        user: {
            url: '/api/auth/user',
            method: 'get',
        },
    },
    token: {
        expiresProperty: 'expires_in',
        property: 'token',
        type: 'Bearer',
        name: 'Authorization',
        maxAge: false,
        global: true,
        required: true,
        prefix: '_token.',
        expirationPrefix: '_token_expiration.',
    },
    user: {
        property: 'user',
        autoFetch: true,
    },
    clientId: undefined,
    grantType: undefined,
    scope: undefined,
};

export class LocalScheme<OptionsT extends LocalSchemeOptions = LocalSchemeOptions> extends BaseScheme<OptionsT> implements TokenableScheme<OptionsT>
{
    token: Token;
    requestHandler: RequestHandler;

    constructor($auth: Auth, options: SchemePartialOptions<LocalSchemeOptions>, ...defaults: SchemePartialOptions<LocalSchemeOptions>[]) {
        super($auth, options as OptionsT, ...(defaults as OptionsT[]), DEFAULTS as OptionsT);

        // Initialize Token instance
        this.token = new Token(this, this.$auth.$storage);

        // Initialize Request Interceptor
        this.requestHandler = new RequestHandler(this, process.server ? this.$auth.ctx.ssrContext!.event.$http : this.$auth.ctx.$http, $auth);
    }

    check(checkStatus = false): SchemeCheck {
        const response = {
            valid: false,
            tokenExpired: false,
        };

        // Sync token
        const token = this.token.sync();

        // Token is required but not available
        if (!token) {
            return response;
        }

        // Check status wasn't enabled, let it pass
        if (!checkStatus) {
            response.valid = true;
            return response;
        }

        // Get status
        const tokenStatus = this.token.status();

        // Token has expired. Attempt `tokenCallback`
        if (tokenStatus.expired()) {
            response.tokenExpired = true;
            return response;
        }

        response.valid = true;
        return response;
    }

    mounted({ tokenCallback = () => this.$auth.reset(), refreshTokenCallback = () => undefined } = {}): Promise<HTTPResponse<any> | void> {
        const { tokenExpired, refreshTokenExpired } = this.check(true);

        if (refreshTokenExpired && typeof refreshTokenCallback === 'function') {
            refreshTokenCallback();
        } else if (tokenExpired && typeof tokenCallback === 'function') {
            tokenCallback();
        }

        // Initialize request interceptor
        this.initializeRequestInterceptor();

        // Fetch user once
        return this.$auth.fetchUserOnce();
    }

    async login(endpoint: HTTPRequest, { reset = true } = {}): Promise<HTTPResponse<any> | void> {
        if (!this.options.endpoints.login) {
            return;
        }

        // Ditch any leftover local tokens before attempting to log in
        if (reset) {
            this.$auth.reset({ resetInterceptor: false });
        }

        endpoint = endpoint || {};
        endpoint.body = endpoint.body || {};

        // Add client id to payload if defined
        if (this.options.clientId) {
            endpoint.body.client_id = this.options.clientId;
        }

        // Add grant type to payload if defined
        if (this.options.grantType) {
            endpoint.body.grant_type = this.options.grantType;
        }

        // Add scope to payload if defined
        if (this.options.scope) {
            endpoint.body.scope = this.options.scope;
        }

        if (this.options.ssr) {
            endpoint.baseURL = ''
        }

        // Make login request
        const response = await this.$auth.request(endpoint, this.options.endpoints.login);

        // Update tokens
        this.updateTokens(response);

        // Initialize request interceptor if not initialized
        if (!this.requestHandler.requestInterceptor) {
            this.initializeRequestInterceptor();
        }

        // Fetch user if `autoFetch` is enabled
        if (this.options.user.autoFetch) {
            await this.fetchUser();
        }

        return response;
    }

    setUserToken(token: string): Promise<HTTPResponse<any> | void> {
        this.token.set(token);

        // Fetch user
        return this.fetchUser();
    }

    async fetchUser(endpoint?: HTTPRequest): Promise<HTTPResponse<any> | void> {
        // Token is required but not available
        if (!this.check().valid) {
            return Promise.resolve();
        }

        // User endpoint is disabled
        if (!this.options.endpoints.user) {
            this.$auth.setUser({});
            return Promise.resolve();
        }

        // Try to fetch user and then set
        return this.$auth
            .requestWith(endpoint, this.options.endpoints.user)
            .then((response) => {
                const userData = getProp(response._data, this.options.user.property!);

                if (!userData) {
                    const error = new Error(`User Data response does not contain field ${this.options.user.property}`);
                    return Promise.reject(error);
                }

                this.$auth.setUser(userData);

                return response;
            })
            .catch((error) => {
                this.$auth.callOnError(error, { method: 'fetchUser' });
                return Promise.reject(error);
            });
    }

    async logout(endpoint: HTTPRequest = {}): Promise<void> {
        // Only connect to logout endpoint if it's configured
        if (this.options.endpoints.logout) {
            await this.$auth.requestWith(endpoint, this.options.endpoints.logout).catch((err: any) => console.error(err));
        }

        // But reset regardless
        this.$auth.reset();
        this.$auth.redirect('logout');
    }

    reset({ resetInterceptor = true } = {}): void {
        this.$auth.setUser(false);
        this.token.reset();

        if (resetInterceptor) {
            this.requestHandler.reset();
        }
    }

    protected extractToken(response: HTTPResponse<any>): string {
        return getProp(response._data, this.options.token!.property) as string
    }

    protected updateTokens(response: HTTPResponse<any>): void {
        // recommended accessToken lifetime
        let tokenExpiresIn: number | boolean = false
        const token = this.options.token?.required ? this.extractToken(response) : true;
        tokenExpiresIn = this.options.token?.maxAge || (getProp(response._data, this.options.token!.expiresProperty) as number);

        this.token.set(token, tokenExpiresIn);
    }

    protected initializeRequestInterceptor(): void {
        this.requestHandler.initializeRequestInterceptor();
    }
}
