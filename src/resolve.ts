import type { Strategy, ModuleOptions, ProviderNames, SchemeNames } from './types';
import type { Nuxt } from '@nuxt/schema';
import { addAuthorize, addLocalAuthorize, assignAbsoluteEndpoints, assignDefaults } from './utils/provider';
import { ProviderAliases } from './runtime/providers';
import * as AUTH_PROVIDERS from './runtime/providers';
import { resolvePath } from '@nuxt/kit';
import { existsSync } from 'fs';
import { hash } from 'ohash';

export const BuiltinSchemes = {
    local: 'LocalScheme',
    cookie: 'CookieScheme',
    oauth2: 'Oauth2Scheme',
    openIDConnect: 'OpenIDConnectScheme',
    refresh: 'RefreshScheme',
    laravelJWT: 'LaravelJWTScheme',
    auth0: 'Auth0Scheme',
};

export const OAUTH2DEFAULTS = {
    accessType: undefined,
    redirectUri: undefined,
    logoutRedirectUri: undefined,
    clientId: undefined,
    clientSecretTransport: 'body',
    audience: undefined,
    grantType: undefined,
    responseMode: undefined,
    acrValues: undefined,
    autoLogout: false,
    endpoints: {
        logout: undefined,
        authorization: undefined,
        token: undefined,
        userInfo: undefined,
    },
    scope: [],
    token: {
        property: 'access_token',
        expiresProperty: 'expires_in',
        type: 'Bearer',
        name: 'Authorization',
        maxAge: false,
        global: true,
        prefix: '_token.',
        expirationPrefix: '_token_expiration.',
    },
    idToken: {
        property: 'id_token',
        maxAge: 1800,
        prefix: '_id_token.',
        expirationPrefix: '_id_token_expiration.',
    },
    refreshToken: {
        property: 'refresh_token',
        maxAge: 60 * 60 * 24 * 30,
        prefix: '_refresh_token.',
        expirationPrefix: '_refresh_token_expiration.',
        httpOnly: false,
    },
    user: {
        property: false,
    },
    responseType: 'token',
    codeChallengeMethod: false,
    clientWindow: false,
    clientWindowWidth: 400,
    clientWindowHeight: 600
};

export const LOCALDEFAULTS = {
    cookie: {
        name: undefined
    },
    endpoints: {
        csrf: {
            url: '/api/csrf-cookie',
        },
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
        refresh: {
            url: '/api/auth/refresh',
            method: 'POST',
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
    user: {
        property: 'user',
        autoFetch: true,
    },
    clientId: false,
    grantType: false,
    scope: false,
};

export interface ImportOptions {
    name: string;
    as: string;
    from: string;
}

export async function resolveStrategies(nuxt: Nuxt, options: ModuleOptions) {
    const strategies: Strategy[] = [];
    const strategyScheme = {} as Record<string, ImportOptions>;

    for (const name of Object.keys(options.strategies!)) {
        if (!options.strategies![name] || (options.strategies as Strategy)[name].enabled === false) {
            continue;
        }

        // Clone strategy
        const strategy = Object.assign({}, options.strategies![name]) as Strategy;

        // Default name
        if (!strategy.name) {
            strategy.name = name;
        }

        // Default provider (same as name)
        if (!strategy.provider) {
            strategy.provider = strategy.name as ProviderNames;
        }

        // Determine if SSR is enabled
        strategy.ssr = nuxt.options.ssr

        // Try to resolve provider
        const provider = await resolveProvider(strategy.provider, nuxt, strategy);

        delete strategy.provider;

        if (typeof provider === "function") {
            provider(nuxt, strategy);
        }

        // Default scheme (same as name)
        if (!strategy.scheme) {
            strategy.scheme = strategy.name as SchemeNames;
        }

        try {
            // Resolve and keep scheme needed for strategy
            const schemeImport = await resolveScheme(strategy.scheme);
            delete strategy.scheme;
            strategyScheme[strategy.name] = schemeImport as ImportOptions;

            // Add strategy to array
            strategies.push(strategy);
        } catch (e) {
            console.error(`[Auth] Error resolving strategy ${strategy.name}: ${e}`);
        }
    }

    return {
        strategies,
        strategyScheme,
    };
}

export async function resolveScheme(scheme: string) {
    if (typeof scheme !== 'string') {
        return;
    }

    if (BuiltinSchemes[scheme as keyof typeof BuiltinSchemes]) {
        return {
            name: BuiltinSchemes[scheme as keyof typeof BuiltinSchemes],
            as: BuiltinSchemes[scheme as keyof typeof BuiltinSchemes],
            from: '#auth/runtime',
        };
    }

    const path = await resolvePath(scheme);

    if (existsSync(path)) {
        const _path = path.replace(/\\/g, '/');
        return {
            name: 'default',
            as: 'Scheme$' + hash({ path: _path }),
            from: _path,
        };
    }
}

export async function resolveProvider(provider: string | ((...args: any[]) => any), nuxt: Nuxt, strategy: Strategy) {

    provider = (ProviderAliases[provider as keyof typeof ProviderAliases] || provider);

    if (AUTH_PROVIDERS[provider as keyof typeof AUTH_PROVIDERS]) {
        return AUTH_PROVIDERS[provider as keyof typeof AUTH_PROVIDERS];
    }

    // return the provider
    if (typeof provider === 'function') {
        return provider(nuxt, strategy);
    }

    // return an empty function as it doesn't use a provider
    if (typeof provider === 'string') {
        return (nuxt: Nuxt, strategy: Strategy) => {
            if (['oauth2', 'openIDConnect', 'auth0'].includes(strategy.scheme!) && strategy.ssr) {
                assignDefaults(strategy as any, OAUTH2DEFAULTS)
                addAuthorize(nuxt, strategy as any, true)
            }

            if (['refresh', 'local', 'cookie'].includes(strategy.scheme!) && strategy.ssr) {
                assignDefaults(strategy as any, LOCALDEFAULTS)

                if (strategy.url) {
                    assignAbsoluteEndpoints(strategy as any);
                }

                addLocalAuthorize(nuxt, strategy as any)
            }
        }
    }
}
