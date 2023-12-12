import type { ProviderPartialOptions, HTTPRequest, ProviderOptions } from '../../types';
import type { CookieSchemeOptions } from '..';
import type { Nuxt } from '@nuxt/schema';
import { assignAbsoluteEndpoints, assignDefaults, addLocalAuthorize } from '../../utils/provider';
import { LOCALDEFAULTS } from '../../resolve';

export interface LaravelSanctumProviderOptions extends ProviderOptions, CookieSchemeOptions {}

export function laravelSanctum(nuxt: Nuxt, strategy: ProviderPartialOptions<LaravelSanctumProviderOptions>): void {
    const endpointDefaults: Partial<HTTPRequest> = {
        credentials: 'include'
    };

    const DEFAULTS = Object.assign(LOCALDEFAULTS, {
        scheme: 'cookie',
        name: 'laravelSanctum',
        cookie: {
            name: 'XSRF-TOKEN',
        },
        endpoints: {
            csrf: {
                ...endpointDefaults,
                url: '/sanctum/csrf-cookie',
            },
            login: {
                ...endpointDefaults,
                url: '/login',
            },
            refresh: {
                ...endpointDefaults,
                url: '/refresh'
            },
            logout: {
                ...endpointDefaults,
                url: '/logout',
            },
            user: {
                ...endpointDefaults,
                url: '/api/user',
            },
        },
        user: {
            property: false,
            autoFetch: true,
        },
        token: {
            type: 'Bearer',
        }
    })

    assignDefaults(strategy, DEFAULTS as typeof strategy)

    if (strategy.url) {
        assignAbsoluteEndpoints(strategy)
    }

    if (strategy.scheme === 'refresh') {
        addLocalAuthorize(nuxt, strategy);
    }

}
