import type { HTTPRequest, HTTPResponse, RefreshableScheme, RefreshableSchemeOptions, SchemeCheck, SchemePartialOptions } from '../../types';
import type { Auth } from '..';
import { cleanObj, getProp } from '../../utils';
import { RefreshController, RefreshToken, ExpiredAuthSessionError } from '../inc';
import { LocalScheme, type LocalSchemeEndpoints, type LocalSchemeOptions } from './local';

export interface RefreshSchemeEndpoints extends LocalSchemeEndpoints {
    refresh: HTTPRequest;
}

export interface RefreshSchemeOptions extends LocalSchemeOptions, RefreshableSchemeOptions {
    endpoints: RefreshSchemeEndpoints;
    autoLogout: boolean;
}

const DEFAULTS: SchemePartialOptions<RefreshSchemeOptions> = {
    name: 'refresh',
    endpoints: {
        refresh: {
            url: '/api/auth/refresh',
            method: 'POST',
        },
    },
    refreshToken: {
        property: 'refresh_token',
        data: 'refresh_token',
        maxAge: 60 * 60 * 24 * 30,
        required: true,
        tokenRequired: false,
        prefix: '_refresh_token.',
        expirationPrefix: '_refresh_token_expiration.',
        httpOnly: false,
    },
    autoLogout: false,
};

export class RefreshScheme<OptionsT extends RefreshSchemeOptions = RefreshSchemeOptions> extends LocalScheme<OptionsT> implements RefreshableScheme<OptionsT>
{
    refreshToken: RefreshToken;
    refreshController: RefreshController;

    constructor($auth: Auth, options: SchemePartialOptions<RefreshSchemeOptions>) {
        super($auth, options, DEFAULTS);

        // Initialize Refresh Token instance
        this.refreshToken = new RefreshToken(this, this.$auth.$storage);

        // Initialize Refresh Controller
        this.refreshController = new RefreshController(this);
    }

    override check(checkStatus = false): SchemeCheck {
        const response = {
            valid: false,
            tokenExpired: false,
            refreshTokenExpired: false,
            isRefreshable: true,
        };

        // Sync tokens
        const token = this.token.sync();
        this.refreshToken.sync();

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
        const refreshTokenStatus = this.refreshToken.status();

        // Refresh token has expired. There is no way to refresh. Force reset.
        if (refreshTokenStatus.expired()) {
            response.refreshTokenExpired = true;
            return response;
        }

        // Token has expired, Force reset.
        if (tokenStatus.expired()) {
            response.tokenExpired = true;
            return response;
        }

        response.valid = true;
        return response;
    }

    override mounted(): Promise<HTTPResponse<any> | void> {
        return super.mounted({
            tokenCallback: () => {
                if (this.options.autoLogout) {
                    this.$auth.reset();
                }
            },
            refreshTokenCallback: () => {
                this.$auth.reset();
            },
        });
    }

    async refreshTokens(): Promise<HTTPResponse<any> | void> {
        // Refresh endpoint is disabled
        if (!this.options.endpoints.refresh) {
            return Promise.resolve();
        }

        // Token and refresh token are required but not available
        if (!this.check().valid) {
            return Promise.resolve();
        }

        // Get refresh token status
        const refreshTokenStatus = this.refreshToken.status();

        // Refresh token is expired. There is no way to refresh. Force reset.
        if (refreshTokenStatus.expired()) {
            this.$auth.reset();

            throw new ExpiredAuthSessionError();
        }

        // Delete current token from the request header before refreshing, if `tokenRequired` is disabled
        if (!this.options.refreshToken.tokenRequired) {
            this.requestHandler.clearHeader();
        }

        const endpoint: HTTPRequest = {
            body: {
                client_id: undefined,
                grant_type: undefined
            }
        }

        // Add refresh token to payload if required
        if (this.options.refreshToken.required && this.options.refreshToken.data && !this.options.refreshToken.httpOnly) {
            endpoint.body![this.options.refreshToken.data] = this.refreshToken.get();
        }

        // Add client id to payload if defined
        if (this.options.clientId) {
            endpoint.body!.client_id = this.options.clientId;
        }

        // Add grant type to payload if defined
        endpoint.body!.grant_type = 'refresh_token';

        cleanObj(endpoint.body!);

        if (this.options.ssr) {
            endpoint.baseURL = ''
        }

        const response = await this.$auth.request(endpoint, this.options.endpoints.refresh);

        this.updateTokens(response);
    }

    override setUserToken(token: string | boolean, refreshToken?: string | boolean): Promise<HTTPResponse<any> | void> {
        this.token.set(token);

        if (refreshToken) {
            this.refreshToken.set(refreshToken);
        }

        // Fetch user
        return this.fetchUser();
    }

    override reset({ resetInterceptor = true } = {}): void {
        this.$auth.setUser(false);
        this.token.reset();
        this.refreshToken.reset();

        if (resetInterceptor) {
            this.requestHandler.reset();
        }
    }

    protected extractRefreshToken(response: HTTPResponse<any>): string {
        return getProp(response._data, this.options.refreshToken.property) as string
    }

    protected override updateTokens(response: HTTPResponse<any>): void {
        let tokenExpiresIn: number | boolean = false
        const token = this.options.token?.required ? this.extractToken(response) : true;
        const refreshToken = this.options.refreshToken.required ? this.extractRefreshToken(response) : true;
        tokenExpiresIn = this.options.token?.maxAge || (getProp(response._data, this.options.token!.expiresProperty) as number);

        this.token.set(token, tokenExpiresIn);

        if (refreshToken) {
            this.refreshToken.set(refreshToken);
        }
    }

    protected override initializeRequestInterceptor(): void {
        this.requestHandler.initializeRequestInterceptor(
            this.options.endpoints.refresh.url
        );
    }
}
