import type { SchemePartialOptions, SchemeCheck, TokenableScheme, HTTPRequest, HTTPResponse } from '../../types';
import type { Auth } from '..';
import { LocalScheme, type LocalSchemeEndpoints, type LocalSchemeOptions } from './local'
import { getProp } from '../../utils';

export interface CookieSchemeEndpoints extends LocalSchemeEndpoints {
    csrf?: HTTPRequest | false;
}

export interface CookieSchemeCookie {
    name: string;
}

export interface CookieSchemeOptions extends LocalSchemeOptions {
    url?: string;
    endpoints: CookieSchemeEndpoints;
    cookie: CookieSchemeCookie;
}

const DEFAULTS: SchemePartialOptions<CookieSchemeOptions> = {
    name: 'cookie',
    cookie: {
        name: undefined
    },
    endpoints: {
        csrf: false,
    },
    token: {
        type: false,
        property: '',
        maxAge: false,
        global: false,
        required: false
    },
    user: {
        property: false,
        autoFetch: true,
    },
};

export class CookieScheme<OptionsT extends CookieSchemeOptions> extends LocalScheme<OptionsT> implements TokenableScheme<OptionsT> {
    checkStatus: boolean = false;

    constructor($auth: Auth, options: SchemePartialOptions<CookieSchemeOptions>) {
        super($auth, options as OptionsT, DEFAULTS as OptionsT);
    }

    override async mounted(): Promise<HTTPResponse<any> | void> {
        if (process.server) {
            this.$auth.ctx.$http.setHeader('referer', this.$auth.ctx.ssrContext!.event.node.req.headers.host!);
        }

        if (this.options.token?.type) {
            return super.mounted()
        }

        this.checkStatus = true;

        return this.$auth.fetchUserOnce();
    }

    override check(): SchemeCheck {
        const response = { valid: false };

        if (!super.check().valid && this.options.token?.type) {
            return response
        }

        if (!this.checkStatus) {
            response.valid = true
            return response
        }

        if (this.options.cookie.name) {
            const cookies = this.$auth.$storage.getCookies();
            response.valid = Boolean(cookies![this.options.cookie.name]);

            return response;
        }

        response.valid = true;
        return response;
    }

    override async login(endpoint: HTTPRequest): Promise<HTTPResponse<any> | void> {
        // Ditch any leftover local tokens before attempting to log in
        this.$auth.reset();

        // Make CSRF request if required
        if (this.options.endpoints.csrf) {
            await this.$auth.request(this.options.endpoints.csrf);
        }

        if (this.options.token?.type) {
            return super.login(endpoint, { reset: false })
        }

        if (!this.options.endpoints.login) {
            return;
        }

        // @ts-ignore
        if (this.options.ssr) {
            endpoint.baseURL = ''
        }

        // Make login request
        const response = await this.$auth.request(endpoint, this.options.endpoints.login);

        // Fetch user if `autoFetch` is enabled
        if (this.options.user.autoFetch) {
            if (this.checkStatus) {
                this.checkStatus = false;
            }

            await this.fetchUser();
        }

        return response;
    }

    override async fetchUser(endpoint?: HTTPRequest): Promise<HTTPResponse<any> | void> {
        if (!this.check().valid) {
            return Promise.resolve();
        }

        // User endpoint is disabled
        if (!this.options.endpoints.user) {
            this.$auth.setUser({});
            return Promise.resolve();
        }

        if (this.checkStatus) {
            this.checkStatus = false;
        }

        // Try to fetch user and then set
        return this.$auth
            .requestWith(endpoint, this.options.endpoints.user)
            .then((response) => {
                const userData = getProp(response._data, this.options.user.property)

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

    override reset(): void {
        if (this.options.cookie.name) {
            this.$auth.$storage.setCookie(this.options.cookie.name, null);
        }

        if (this.options.token?.type) {
            return super.reset()
        }

        this.$auth.setUser(false);
    }
}
