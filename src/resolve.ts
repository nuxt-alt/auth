import type { Strategy, ModuleOptions, ProviderNames, SchemeNames } from './types';
import type { Nuxt } from '@nuxt/schema';
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

        // Try to resolve provider
        const provider = await resolveProvider(strategy.provider);

        delete strategy.provider;

        // check that the provider isn't a nuxt module
        if (typeof provider === 'function') {
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

export async function resolveProvider(provider: string | ((...args: any[]) => any)) {

    provider = (ProviderAliases[provider as keyof typeof ProviderAliases] || provider);

    if (AUTH_PROVIDERS[provider as keyof typeof AUTH_PROVIDERS]) {
        return AUTH_PROVIDERS[provider as keyof typeof AUTH_PROVIDERS];
    }

    // return the provider
    if (typeof provider === 'function') {
        return provider;
    }

    // return an empty function as it doesn't use a provider
    if (typeof provider === 'string') {
        return (nuxt, strategy) => {}
    }
}
