import type { Oauth2SchemeOptions, RefreshSchemeOptions } from '../runtime';
import type { StrategyOptions, HTTPRequest, TokenableSchemeOptions } from '../types';
import type { Nuxt } from '@nuxt/schema';
import { addServerHandler, addTemplate } from '@nuxt/kit';
import { serialize } from '@refactorjs/serialize';
import { join } from 'pathe';
import { defu } from 'defu';

export function assignDefaults<SOptions extends StrategyOptions>(strategy: SOptions, defaults: SOptions): void {
    Object.assign(strategy, defu(strategy, defaults));
}

export function addAuthorize<SOptions extends StrategyOptions<Oauth2SchemeOptions>>(nuxt: Nuxt, strategy: SOptions, useForms: boolean = false): void {
    // Get clientSecret, clientId, endpoints.token and audience
    const clientSecret = strategy.clientSecret;
    const clientId = strategy.clientId;
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
        filename: `authorize-${strategy.name}.ts`,
        write: true,
        getContents: () => authorizeGrant({
            strategy,
            useForms,
            clientSecret,
            clientId,
            tokenEndpoint,
            audience,
        }),
    })

    addServerHandler({
        route: endpoint,
        method: 'post',
        handler: join(nuxt.options.buildDir, `authorize-${strategy.name}.ts`),
    })
}

export function addLocalAuthorize<SOptions extends StrategyOptions<RefreshSchemeOptions>>(nuxt: Nuxt, strategy: SOptions): void {
    const tokenEndpoint = strategy.endpoints?.login?.url;
    const refreshEndpoint = strategy.endpoints?.refresh?.url;

    // Endpoint
    const endpoint = `/_auth/local/${strategy.name}/authorize`;
    strategy.endpoints!.login!.url = endpoint;
    strategy.endpoints!.refresh!.url = endpoint;

    addTemplate({
        filename: `local-${strategy.name}.ts`,
        write: true,
        getContents: () => localAuthorizeGrant({
            strategy,
            tokenEndpoint,
            refreshEndpoint
        }),
    })

    addServerHandler({
        route: endpoint,
        method: 'post',
        handler: join(nuxt.options.buildDir, `local-${strategy.name}.ts`),
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
        filename: `password-${strategy.name}.ts`,
        write: true,
        getContents: () => passwordGrant({
            strategy,
            clientSecret,
            clientId,
            tokenEndpoint,
        })
    })

    addServerHandler({
        route: endpoint,
        method: 'post',
        handler: join(nuxt.options.buildDir, `password-${strategy.name}.ts`),
    })
}

export function assignAbsoluteEndpoints<SOptions extends StrategyOptions<(TokenableSchemeOptions | RefreshSchemeOptions) & { url: string; }>>(strategy: SOptions): void {
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

export function authorizeGrant(opt: any): string {
return `import { defineEventHandler, readBody, createError, getCookie } from 'h3'
// @ts-expect-error: virtual file 
import { config } from '#nuxt-auth-options'
import { serialize } from 'cookie-es'

const options = ${serialize(opt, { space: 4 })}

function addTokenPrefix(token: string | boolean, tokenType: string | false): string | boolean {
    if (!token || !tokenType || typeof token !== 'string' || token.startsWith(tokenType)) {
        return token;
    }

    return tokenType + ' ' + token;
}

export default defineEventHandler(async (event) => {
    const {
        code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri = options.strategy.redirectUri,
        response_type: responseType = options.strategy.responseType,
        grant_type: grantType = options.strategy.grantType,
        refresh_token: refreshToken
    } = await readBody(event)

    const refreshCookieName = config.stores.cookie.prefix + options.strategy?.refreshToken?.prefix + options.strategy.name
    const tokenCookieName = config.stores.cookie.prefix + options.strategy?.token?.prefix + options.strategy.name
    const idTokenCookieName = config.stores.cookie.prefix + options.strategy?.idToken?.prefix + options.strategy.name
    const serverRefreshToken = getCookie(event, refreshCookieName)

    // Grant type is authorization code, but code is not available
    if (grantType === 'authorization_code' && !code) {
        return createError({
            statusCode: 500,
            message: 'Missing authorization code'
        })
    }

    // Grant type is refresh token, but refresh token is not available
    if ((grantType === 'refresh_token' && !options.strategy.refreshToken.httpOnly && !refreshToken) || (grantType === 'refresh_token' && options.strategy.refreshToken.httpOnly && !serverRefreshToken)) {
        return createError({
            statusCode: 500,
            message: 'Missing refresh token'
        })
    }

    let body = {
        client_id: options.clientId,
        client_secret: options.clientSecret,
        refresh_token: options.strategy.refreshToken.httpOnly ? serverRefreshToken : refreshToken,
        grant_type: grantType,
        response_type: responseType,
        redirect_uri: redirectUri,
        audience: options.audience,
        code_verifier: codeVerifier,
        code
    }

    if (grantType !== 'refresh_token') {
        delete body.refresh_token
    }

    const headers = {
        Accept: 'application/json',
        'Content-Type': 'application/json'
    }

    if (options.strategy.clientSecretTransport === 'authorization_header') {
        // @ts-ignore
        headers['Authorization'] = 'Basic ' + Buffer.from(options.clientId + ':' + options.clientSecret).toString('base64')
        // client_secret is transported in auth header
        delete body.client_secret
    }

    const response = await $http.post(options.tokenEndpoint, {
        body,
        headers
    })

    let cookies = event.node.res.getHeader('Set-Cookie') as string[] || [];

    const refreshCookieValue = response._data?.[options.strategy?.refreshToken?.property]
    if (config.stores.cookie.enabled && refreshCookieValue && options.strategy.refreshToken.httpOnly) {
        const refreshCookie = serialize(refreshCookieName, refreshCookieValue, { ...config.stores.cookie.options, httpOnly: true })
        cookies.push(refreshCookie);
    }

    const tokenCookieValue = response._data?.[options.strategy?.token?.property]
    if (config.stores.cookie.enabled && tokenCookieValue && options.strategy.token.httpOnly) {
        const token = addTokenPrefix(tokenCookieValue, options.strategy.token.type) as string
        const tokenCookie = serialize(tokenCookieName, token, { ...config.stores.cookie.options, httpOnly: true })
        cookies.push(tokenCookie);
    }

    const idTokenCookieValue = response._data?.[options.strategy?.idToken?.property]
    if (config.stores.cookie.enabled && idTokenCookieValue && options.strategy.idToken.httpOnly) {
        const idTokenCookie = serialize(idTokenCookieName, token, { ...config.stores.cookie.options, httpOnly: true })
        cookies.push(idTokenCookie);
    }

    if (cookies.length) {
        event.node.res.setHeader('Set-Cookie', cookies);
    }

    event.node.res.end(JSON.stringify(response._data))
})
`;
}

export function localAuthorizeGrant(opt: any): string {
return `import { defineEventHandler, readBody, createError, getCookie } from 'h3'
// @ts-expect-error: virtual file
import { config } from '#nuxt-auth-options'
import { serialize } from 'cookie-es'

const options = ${serialize(opt, { space: 4 })}

function addTokenPrefix(token: string | boolean, tokenType: string | false): string | boolean {
    if (!token || !tokenType || typeof token !== 'string' || token.startsWith(tokenType)) {
        return token;
    }

    return tokenType + ' ' + token;
}

export default defineEventHandler(async (event) => {
    const requestBody = await readBody(event)

    const refreshCookieName = config.stores.cookie.prefix + options.strategy?.refreshToken?.prefix + options.strategy.name
    const refreshTokenDataName = options.strategy.refreshToken.data
    const tokenCookieName = config.stores.cookie.prefix + options.strategy?.token?.prefix + options.strategy.name
    const serverRefreshToken = getCookie(event, refreshCookieName)

    // Grant type is refresh token, but refresh token is not available
    if ((requestBody.grant_type === 'refresh_token' && !options.strategy.refreshToken.httpOnly && !requestBody[refreshTokenDataName]) || (requestBody.grant_type === 'refresh_token' && options.strategy.refreshToken.httpOnly && !serverRefreshToken)) {
        return createError({
            statusCode: 500,
            message: 'Missing refresh token'
        })
    }

    let body = {
        ...requestBody,
        [refreshTokenDataName]: options.strategy.refreshToken.httpOnly ? serverRefreshToken : requestBody[refreshTokenDataName],
    }

    if (requestBody.grant_type !== 'refresh_token') {
        delete body[refreshTokenDataName]
    }

    const headers = {
        'Content-Type': 'application/json'
    }

    let response

    if (body[refreshTokenDataName]) {
        response = await $http.post(options.refreshEndpoint, {
            body,
            headers: {
                ...headers,
                // @ts-ignore: headers might not be set
                ...options.strategy?.endpoints?.refresh?.headers
            }
        })
    } else {
        response = await $http.post(options.tokenEndpoint, {
            body,
            headers: {
                ...headers,
                // @ts-ignore: headers might not be set
                ...options.strategy?.endpoints?.login?.headers
            }
        })
    }

    let cookies = event.node.res.getHeader('Set-Cookie') as string[] || [];

    const refreshCookieValue = response._data?.[options.strategy?.refreshToken?.property]
    if (config.stores.cookie.enabled && refreshCookieValue && options.strategy.refreshToken.httpOnly) {
        const refreshCookie = serialize(refreshCookieName, refreshCookieValue, { ...config.stores.cookie.options, httpOnly: true })
        cookies.push(refreshCookie);
    }

    const tokenCookieValue = response._data?.[options.strategy?.token?.property]
    if (config.stores.cookie.enabled && tokenCookieValue && options.strategy.token.httpOnly) {
        const token = addTokenPrefix(tokenCookieValue, options.strategy.token.type) as string
        const tokenCookie = serialize(tokenCookieName, token, { ...config.stores.cookie.options, httpOnly: true })
        cookies.push(tokenCookie);
    }

    if (cookies.length) {
        event.node.res.setHeader('Set-Cookie', cookies);
    }

    event.node.res.end(JSON.stringify(response._data))
})
`;
}

export function passwordGrant(opt: any): string {
return `import requrl from 'requrl';
import { defineEventHandler, readBody, createError } from 'h3';

const options = ${serialize(opt, { space: 4 })}

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

    const response = await $http.post(options.tokenEndpoint, {
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

    event.node.res.end(JSON.stringify(response._data))
})
`;
}
