import type { ProviderPartialOptions, ProviderOptions } from '../../types';
import type { RefreshSchemeOptions } from '..';
import type { Nuxt } from '@nuxt/schema';
import { assignDefaults, assignAbsoluteEndpoints, addLocalAuthorize } from '../../utils/provider';
import { LOCALDEFAULTS } from '../inc';

export interface LaravelJWTProviderOptions extends ProviderOptions, RefreshSchemeOptions {
    url: string;
}

export function laravelJWT(nuxt: Nuxt, strategy: ProviderPartialOptions<LaravelJWTProviderOptions>): void {
    const { url } = strategy;

    if (!url) {
        throw new Error('url is required for laravel jwt!');
    }

    const DEFAULTS = Object.assign(LOCALDEFAULTS, {
        name: 'laravelJWT',
        scheme: 'laravelJWT',
        endpoints: {
            login: {
                url: url + '/api/auth/login',
            },
            refresh: {
                url: url + '/api/auth/refresh',
            },
            logout: {
                url: url + '/api/auth/logout',
            },
            user: {
                url: url + '/api/auth/user',
            },
        },
        token: {
            property: 'access_token',
            maxAge: 3600,
        },
        refreshToken: {
            property: false,
            data: false,
            maxAge: 1209600,
            required: false,
            tokenRequired: true,
        },
        user: {
            property: false,
        },
        clientId: false,
        grantType: false,
    })

    assignDefaults(strategy, DEFAULTS as typeof strategy);

    assignAbsoluteEndpoints(strategy);

    if (strategy.ssr) {
        addLocalAuthorize(nuxt, strategy);
    }
}
