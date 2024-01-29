import type { ModuleOptions, StrategyOptions, ImportOptions } from './types';
import { serialize } from '@refactorjs/serialize';

export const getAuthPlugin = (options: {
    options: ModuleOptions
    schemeImports: ImportOptions[]
    strategies: StrategyOptions[]
    strategyScheme: Record<string, ImportOptions>
}): string => {
    return `import { Auth, ExpiredAuthSessionError } from '#auth/runtime'
import { defineNuxtPlugin, useRuntimeConfig } from '#imports'
import { defu } from 'defu';

// Active schemes
${options.schemeImports.map((i) => `import { ${i.name}${i.name !== i.as ? ' as ' + i.as : ''} } from '${i.from}'`).join('\n')}

// Options
let options = ${serialize(options.options, { space: 4 })}

export default defineNuxtPlugin({
    name: 'nuxt-alt:auth',
    async setup(nuxtApp) {
        // Create a new Auth instance
        const auth = new Auth(nuxtApp, options)

        // Register strategies
        ${options.strategies.map((strategy) => {
            const scheme = options.strategyScheme[strategy.name!]
            const schemeOptions = JSON.stringify(strategy)
            return `auth.registerStrategy('${strategy.name}', new ${scheme.as}(auth, defu(useRuntimeConfig()?.public?.auth?.strategies?.['${strategy.name}'], ${schemeOptions})))`
        }).join(';\n')}

        nuxtApp.provide('auth', auth)

        return auth.init()
        .catch(error => {
            if (process.client) {
                // Don't console log expired auth session errors. This error is common, and expected to happen.
                // The error happens whenever the user does an ssr request (reload/initial navigation) with an expired refresh
                // token. We don't want to log this as an error.
                if (error instanceof ExpiredAuthSessionError) {
                    return
                }

                console.error('[ERROR] [AUTH]', error)
            }
        })
    }
})`
}