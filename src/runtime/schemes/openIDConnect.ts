import type { HTTPResponse, SchemeCheck, SchemePartialOptions } from '../../types';
import type { Auth } from '..';
import { Oauth2Scheme, type Oauth2SchemeEndpoints, type Oauth2SchemeOptions } from './oauth2';
import { normalizePath, getProp, parseQuery } from '../../utils';
import { IdToken, ConfigurationDocument } from '../inc';
import { type IdTokenableSchemeOptions } from '../../types';
import { withQuery, type QueryObject, type QueryValue } from 'ufo';

export interface OpenIDConnectSchemeEndpoints extends Oauth2SchemeEndpoints {
    configuration: string;
}

export interface OpenIDConnectSchemeOptions extends Oauth2SchemeOptions, IdTokenableSchemeOptions {
    fetchRemote: boolean;
    endpoints: OpenIDConnectSchemeEndpoints;
}

const DEFAULTS: SchemePartialOptions<OpenIDConnectSchemeOptions> = {
    name: 'openIDConnect',
    responseType: 'code',
    grantType: 'authorization_code',
    scope: ['openid', 'profile', 'offline_access'],
    idToken: {
        property: 'id_token',
        maxAge: 1800,
        prefix: '_id_token.',
        expirationPrefix: '_id_token_expiration.',
        httpOnly: false,
    },
    fetchRemote: false,
    codeChallengeMethod: 'S256',
};

export class OpenIDConnectScheme<OptionsT extends OpenIDConnectSchemeOptions = OpenIDConnectSchemeOptions> extends Oauth2Scheme<OptionsT> {
    idToken: IdToken;
    configurationDocument: ConfigurationDocument;

    constructor($auth: Auth, options: SchemePartialOptions<OpenIDConnectSchemeOptions>, ...defaults: SchemePartialOptions<OpenIDConnectSchemeOptions>[]) {
        super($auth, options as OptionsT, ...(defaults as OptionsT[]), DEFAULTS as OptionsT);

        // Initialize ID Token instance
        this.idToken = new IdToken(this, this.$auth.$storage);

        // Initialize ConfigurationDocument
        this.configurationDocument = new ConfigurationDocument(this, this.$auth.$storage);
    }

    protected override updateTokens(response: HTTPResponse<any>): void {
        super.updateTokens(response);
        const idToken = getProp(response._data, this.options.idToken.property) as string;

        if (idToken) {
            this.idToken.set(idToken);
        }
    }

    override check(checkStatus = false): SchemeCheck {
        const response: SchemeCheck = {
            valid: false,
            tokenExpired: false,
            refreshTokenExpired: false,
            idTokenExpired: false,
            isRefreshable: true,
        };

        // Sync tokens
        const token = this.token.sync();
        this.refreshToken.sync();
        this.idToken.sync();

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
        const idTokenStatus = this.idToken.status();

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

        // Id token has expired. Force reset.
        if (idTokenStatus.expired()) {
            response.idTokenExpired = true;
            return response;
        }

        response.valid = true;
        return response;
    }

    override async mounted() {
        // Get and validate configuration based upon OpenIDConnect Configuration document
        // https://openid.net/specs/openid-connect-configuration-1_0.html
        await this.configurationDocument.init();

        const { tokenExpired, refreshTokenExpired } = this.check(true);

        // Force reset if refresh token has expired
        // Or if `autoLogout` is enabled and token has expired
        if (refreshTokenExpired || (tokenExpired && this.options.autoLogout)) {
            this.$auth.reset();
        }

        // Initialize request interceptor
        this.requestHandler.initializeRequestInterceptor(this.options.endpoints.token);

        // Handle callbacks on page load
        const redirected = await this.#handleCallback();

        if (!redirected) {
            return this.$auth.fetchUserOnce();
        }
    }

    override reset() {
        this.$auth.setUser(false);
        this.token.reset();
        this.idToken.reset();
        this.refreshToken.reset();
        this.requestHandler.reset();
        this.configurationDocument.reset();
    }

    override logout() {
        if (this.options.endpoints.logout) {
            const opts: QueryObject = {
                id_token_hint: this.idToken.get() as QueryValue,
                post_logout_redirect_uri: this.logoutRedirectURI,
            };
            const url = withQuery(this.options.endpoints.logout, opts);
            globalThis.location.replace(url);
        }
        return this.$auth.reset();
    }

    override async fetchUser() {
        if (!this.check().valid) {
            return;
        }

        if (!this.options.fetchRemote && this.idToken.get()) {
            const data = this.idToken.userInfo();
            this.$auth.setUser(data!);
            return;
        }

        if (!this.options.endpoints.userInfo) {
            this.$auth.setUser({});
            return;
        }

        const data = await this.$auth.requestWith({
            url: this.options.endpoints.userInfo,
        });

        this.$auth.setUser(data._data);
    }

    async #handleCallback() {
        const route = this.$auth.ctx.$router.currentRoute.value;

        // Handle callback only for specified route
        if (this.$auth.options.redirect && normalizePath(route.path, this.$auth.ctx) !== normalizePath(this.$auth.options.redirect.callback as string, this.$auth.ctx)) {
            return;
        }

        // Callback flow is not supported in server side
        if (process.server) {
            return;
        }

        const hash = parseQuery(route.hash.slice(1));
        const parsedQuery = Object.assign({}, route.query, hash);

        // accessToken/idToken
        let token: string = parsedQuery[this.options.token!.property] as string;

        // recommended accessToken lifetime
        let tokenExpiresIn: number | boolean = false

        // refresh token
        let refreshToken: string;

        if (this.options.refreshToken.property) {
            refreshToken = parsedQuery[this.options.refreshToken.property] as string;
        }

        // id token
        let idToken = parsedQuery[this.options.idToken.property] as string;

        // Validate state
        const state = this.$auth.$storage.getUniversal(this.name + '.state');
        this.$auth.$storage.setUniversal(this.name + '.state', null);

        if (state && parsedQuery.state !== state) {
            return;
        }

        // -- Authorization Code Grant --
        if (this.options.responseType.includes('code') && parsedQuery.code) {
            let codeVerifier: any;

            // Retrieve code verifier and remove it from storage
            if (this.options.codeChallengeMethod && this.options.codeChallengeMethod !== 'implicit') {
                codeVerifier = this.$auth.$storage.getUniversal(this.name + '.pkce_code_verifier');
                this.$auth.$storage.setUniversal(this.name + '.pkce_code_verifier', null);
            }

            const response = await this.$auth.request({
                method: 'post',
                url: this.options.endpoints.token,
                baseURL: '',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    code: parsedQuery.code as string,
                    client_id: this.options.clientId,
                    redirect_uri: this.redirectURI,
                    response_type: this.options.responseType,
                    audience: this.options.audience,
                    grant_type: this.options.grantType,
                    code_verifier: codeVerifier,
                }),
            });

            token = (getProp(response._data, this.options.token!.property) as string) || token;
            tokenExpiresIn = this.options.token?.maxAge || (getProp(response._data, this.options.token!.expiresProperty) as number) || 1800
            refreshToken = (getProp(response._data, this.options.refreshToken.property!) as string) || refreshToken!;
            idToken = (getProp(response._data, this.options.idToken.property) as string) || idToken;
        }

        if (!token || !token.length) {
            return;
        }

        // Set token
        this.token.set(token, tokenExpiresIn);

        // Store refresh token
        if (refreshToken! && refreshToken.length) {
            this.refreshToken.set(refreshToken);
        }

        if (idToken && idToken.length) {
            this.idToken.set(idToken);
        }

        if (this.options.clientWindow) {
            if (globalThis.opener) {
                globalThis.opener.postMessage({ isLoggedIn: true })
                globalThis.close()
            }
        } else if (this.$auth.options.watchLoggedIn) {
            this.$auth.redirect('home', false, false);
            return true; // True means a redirect happened
        }
    }
}