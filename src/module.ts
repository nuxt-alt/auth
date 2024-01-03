import type { ModuleOptions } from './types';
import { addImports, addPluginTemplate, createResolver, defineNuxtModule, installModule, addRouteMiddleware, addServerHandler } from '@nuxt/kit';
import { name, version } from '../package.json';
import { serialize } from '@refactorjs/serialize';
import { resolveStrategies } from './resolve';
import { moduleDefaults } from './options';
import { getAuthPlugin } from './plugin';
import { defu } from 'defu';

const CONFIG_KEY = 'auth';

export default defineNuxtModule({
    meta: {
        name,
        version,
        configKey: CONFIG_KEY,
        compatibility: {
            nuxt: '^3.0.0',
        },
    },
    defaults: ({ options }) => ({
        ...moduleDefaults,
        stores: {
            cookie: {
                secure: options.dev ? false : true
            }
        },
    }),
    async setup(moduleOptions, nuxt) {
        // Resolver
        const resolver = createResolver(import.meta.url);

        // Runtime
        const runtime = resolver.resolve('runtime');

        // Merge all option sources
        const options = defu(nuxt.options.runtimeConfig[CONFIG_KEY] as ModuleOptions, moduleOptions, moduleDefaults) as ModuleOptions

        // Resolve strategies
        const { strategies, strategyScheme } = await resolveStrategies(nuxt, options);
        delete options.strategies;

        // Resolve required imports
        const uniqueImports = new Set();
        const schemeImports = Object.values(strategyScheme).filter((i) => {
            if (uniqueImports.has(i.as)) {
                return false;
            }

            uniqueImports.add(i.as);
            return true;
        });

        // Set defaultStrategy
        options.defaultStrategy = options.defaultStrategy || strategies.length ? strategies[0].name : '';

        nuxt.hook('nitro:config', (config) => {
            config.virtual = config.virtual || {}
            config.virtual['#nuxt-auth-options'] = `export const config = ${serialize(options, { space: 4 })}`
        })

        // Install http module if not in modules
        if (!nuxt.options.modules.includes('@nuxt-alt/http')) {
            installModule('@nuxt-alt/http')
        }

        // Add auth plugin
        addPluginTemplate({
            getContents: () => getAuthPlugin({ options, strategies, strategyScheme, schemeImports }),
            filename: 'auth.plugin.mjs'
        });

        // Add auto imports
        addImports([
            { from: resolver.resolve('runtime/composables'), name: 'useAuth' },
        ])

        nuxt.options.alias['#auth/runtime'] = runtime;

        // Providers
        const providers = resolver.resolve('runtime/providers');
        nuxt.options.alias['#auth/providers'] = providers;

        // Utils
        const utils = resolver.resolve('utils');
        nuxt.options.alias['#auth/utils'] = utils;

        // Transpile
        nuxt.options.build.transpile.push(runtime, providers, utils)

        if (nuxt.options.ssr) {
            addServerHandler({
                route: '/_auth/reset',
                method: 'post',
                handler: resolver.resolve(runtime, 'token-nitro'),
            })
        }

        // Middleware
        if (options.enableMiddleware) {
            addRouteMiddleware({
                name: 'auth',
                path: resolver.resolve('runtime/core/middleware'),
                global: options.globalMiddleware
            }, { override: true })
        }

        // Extend auth with plugins
        if (options.plugins) {
            options.plugins.forEach((p) => nuxt.options.plugins.push(p))
            delete options.plugins
        }
    }
});