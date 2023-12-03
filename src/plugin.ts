import type { ImportOptions } from './resolve';
import type { ModuleOptions, Strategy } from './types';

export const getAuthDTS = () => {
return `import type { Plugin } from '#app'
import { Auth } from '#auth/runtime'

declare const _default: Plugin<{
    auth: Auth;
}>;

export default _default;
`
}

export const getAuthPlugin = (options: {
    options: ModuleOptions
    schemeImports: ImportOptions[]
    strategies: Strategy[]
    strategyScheme: Record<string, ImportOptions>
}): string => {
    return `import { Auth, ExpiredAuthSessionError } from '#auth/runtime'
import { defineNuxtPlugin, useRuntimeConfig } from '#imports'
import { defu } from 'defu';

// Active schemes
${options.schemeImports.map((i) => `import { ${i.name}${i.name !== i.as ? ' as ' + i.as : ''} } from '${i.from}'`).join('\n')}

// Options
let options = ${JSON.stringify(options.options, converter, 4)}

function parse(config) {
    const functionRegex = /\bfunction\s*\((.*?)\)\s*\{|\([^)]*\)\s*=>|\basync\s+function\b/;

    for (let prop in config) {
        if (typeof config[prop] === 'string' && functionRegex.test(config[prop])) {
            config[prop] = new Function("return (" + config[prop] + ")")()
        }
    }

    return config
}

export default defineNuxtPlugin({
    name: 'nuxt-alt:auth',
    async setup(nuxtApp) {
        options = parse(options)
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

function converter(key: string, val: any) {
    if (val && val.constructor === RegExp || typeof val === 'function') {
        return String(val)
    }

    return val
}