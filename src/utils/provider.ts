import type { Oauth2SchemeOptions, RefreshSchemeOptions, LocalSchemeOptions, CookieSchemeOptions } from '../runtime';
import type { StrategyOptions, HTTPRequest } from '../types';
import type { Nuxt } from '@nuxt/schema';
import { addServerHandler, addTemplate } from '@nuxt/kit';
import { join } from 'pathe';
import { defu } from 'defu';

export function assignDefaults<SOptions extends StrategyOptions>(strategy: SOptions, defaults: SOptions): void {
    Object.assign(strategy, defu(strategy, defaults));
}

export function addAuthorize<SOptions extends StrategyOptions<Oauth2SchemeOptions>>(nuxt: Nuxt, strategy: SOptions, useForms: boolean = false): void {
    // Get clientSecret, clientId, endpoints.token and audience
    const clientSecret = strategy.clientSecret;
    const clientID = strategy.clientId;
    const tokenEndpoint = strategy.endpoints!.token;
    const audience = strategy.audience;

    // IMPORTANT: remove clientSecret from generated bundle
    delete strategy.clientSecret;

    // Endpoint
    const endpoint = `/_auth/oauth/${strategy.name}/authorize`;
    strategy.endpoints!.token = endpoint;

    // Set response_type to code
    strategy.responseType = 'code';

    addTemplate({
        filename: 'auth-authorize.ts',
        write: true,
        getContents: () => authorizeMiddlewareFile({
            endpoint,
            strategy,
            useForms,
            clientSecret,
            clientID,
            tokenEndpoint,
            audience,
        }),
    })

    addServerHandler({
        route: endpoint,
        method: 'post',
        handler: join(nuxt.options.buildDir, 'auth-authorize.ts'),
    })
}

export function initializePasswordGrantFlow<SOptions extends StrategyOptions<RefreshSchemeOptions>>(nuxt: Nuxt, strategy: SOptions): void {
    // Get clientSecret, clientId, endpoints.login.url
    const clientSecret = strategy.clientSecret;
    const clientId = strategy.clientId;
    const tokenEndpoint = strategy.endpoints!.token as string;

    // IMPORTANT: remove clientSecret from generated bundle
    delete strategy.clientSecret;

    // Endpoint
    const endpoint = `/_auth/${strategy.name}/token`;
    strategy.endpoints!.login!.url = endpoint;
    strategy.endpoints!.refresh!.url = endpoint;

    addTemplate({
        filename: 'auth-passwordGrant.ts',
        write: true,
        getContents: () => passwordGrantMiddlewareFile({
            endpoint,
            strategy,
            clientSecret,
            clientId,
            tokenEndpoint,
        })
    })

    addServerHandler({
        route: endpoint,
        method: 'post',
        handler: join(nuxt.options.buildDir, 'auth-passwordGrant.ts'),
    })
}

export function assignAbsoluteEndpoints<SOptions extends StrategyOptions<(LocalSchemeOptions | Oauth2SchemeOptions | CookieSchemeOptions) & { url: string; }>>(strategy: SOptions): void {
    const { url, endpoints } = strategy;

    if (endpoints) {
        for (const key of Object.keys(endpoints)) {
            const endpoint = endpoints[key];

            if (endpoint) {
                if (typeof endpoint === 'object') {
                    if (!endpoint.url || endpoint.url.startsWith(url)) {
                        continue;
                    }
                    (endpoints[key] as HTTPRequest).url = url + endpoint.url;
                } else {
                    if (endpoint.startsWith(url as string)) {
                        continue;
                    }
                    endpoints[key] = url + endpoint;
                }
            }
        }
    }
}

export function authorizeMiddlewareFile(opt: any): string {
return `import { defineEventHandler, readBody, createError } from 'h3'
import { createInstance } from '@refactorjs/ofetch'

const options = ${JSON.stringify(opt)}

export default defineEventHandler(async (event) => {
    const {
        code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri = options.strategy.redirectUri,
        response_type: responseType = options.strategy.responseType,
        grant_type: grantType = options.strategy.grantType,
        refresh_token: refreshToken
    } = await readBody(event)

    // Grant type is authorization code, but code is not available
    if (grantType === 'authorization_code' && !code) {
        return createError({
            statusCode: 500,
            message: 'Missing authorization code'
        })
    }

    // Grant type is refresh token, but refresh token is not available
    if (grantType === 'refresh_token' && !refreshToken) {
        return createError({
            statusCode: 500,
            message: 'Missing refresh token'
        })
    }

    let body = {
        client_id: options.clientID,
        client_secret: options.clientSecret,
        refresh_token: refreshToken,
        grant_type: grantType,
        response_type: responseType,
        redirect_uri: redirectUri,
        audience: options.audience,
        code_verifier: codeVerifier,
        code
    }

    const headers = {
        Accept: 'application/json',
        'Content-Type': 'application/json'
    }

    if (options.useForms) {
        // @ts-ignore
        body = new URLSearchParams(body).toString()
        headers['Content-Type'] = 'application/x-www-form-urlencoded'
    }

    const $fetch = createInstance()

    await $fetch.post(options.tokenEndpoint, {
        body: body,
        headers
    })
    .then((response) => event.node.res.end(JSON.stringify(response._data)))
    .catch((error) => {
        console.log(error)
        return createError({
            statusCode: error.response.status,
            message: error.response.data,
        })
    })
})
`;
}

export function passwordGrantMiddlewareFile(opt: any): string {
return `import requrl from 'requrl';
import { defineEventHandler, readBody, createError } from 'h3';
import { createInstance } from '@refactorjs/ofetch';

const options = ${JSON.stringify(opt)}

export default defineEventHandler(async (event) => {
    const body = await readBody(event)

    // If \`grant_type\` is not defined, set default value
    if (!body.grant_type) {
        body.grant_type = options.strategy.grantType
    }

    // If \`client_id\` is not defined, set default value
    if (!body.client_id) {
        body.grant_type = options.clientId
    }

    // Grant type is password, but username or password is not available
    if (body.grant_type === 'password' && (!body.username || !body.password)) {
        return createError({
            statusCode: 400,
            message: 'Invalid username or password'
        })
    }

    // Grant type is refresh token, but refresh token is not available
    if (body.grant_type === 'refresh_token' && !body.refresh_token) {
        event.respondWith({ status: 400, body: JSON.stringify({ message: 'Refresh token not provided' }) });
        return createError({
            statusCode: 400,
            message: 'Refresh token not provided'
        })
    }

    const $fetch = createInstance()

    await $fetch.post(options.tokenEndpoint, {
        baseURL: requrl(event.node.req),
        body: {
            client_id: options.clientId,
            client_secret: options.clientSecret,
            ...body
        },
        headers: {
            Accept: 'application/json'
        }
    })
    .then((response) => event.node.res.end(JSON.stringify(response._data)))
    .catch((error) => {
        console.log(error)
        return createError({
            statusCode: error.response.status,
            message: error.response.data,
        })
    })
})
`;
}
