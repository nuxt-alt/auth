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
    const functionRegex1 = "/\\b\\w+\\s*\\((.*?)\\)\\s*\\{|function\\s*\\((.*?)\\)\\s*\\{|(\\w+)\\s*=>|\\([^)]*\\)\\s*=>|\\basync\\s+function\\b/";
    const functionRegex2 = "/\\b\\w+(\\s)+\\((.*?)\\)\\s*\\{/";

    for (let prop in config) {
        if (typeof config[prop] === 'string' && (new RegExp(functionRegex1).test(config[prop]) || new RegExp(functionRegex2).test(config[prop]))) {
            const paramsStart = config[prop].indexOf('(');
            const paramsEnd = config[prop].indexOf(')');
            const functionParams = config[prop].substring(paramsStart + 1, paramsEnd).split(',').map(item => item.trim());

            let functionBody;
            if (config[prop].includes('{')) {  
                const functionBodyStart = config[prop].indexOf('{');
                const functionBodyEnd = config[prop].lastIndexOf('}');
                functionBody = config[prop].substring(functionBodyStart + 1, functionBodyEnd);
                config[prop] = new Function('return function(' + functionParams.join(',') + '){' + functionBody + '}')();
            } else {
                functionBody = config[prop].substring(paramsEnd + 1).trim();
                if (functionBody.startsWith('=>')) functionBody = functionBody.slice(2).trim();
                config[prop] = new Function('return function(' + functionParams.join(',') + '){return ' + functionBody + '}')();
            }
        } else if (typeof config[prop] === 'object' && config[prop] !== null) {
            parse(config[prop]);
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