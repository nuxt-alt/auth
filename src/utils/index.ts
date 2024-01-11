import type { RouteComponent, RouteLocationNormalized } from '#vue-router';
import type { RecursivePartial } from '../types';
import type { NuxtApp } from '#app';
import type { H3Event } from 'h3';

export const isUnset = (o: any): boolean => typeof o === 'undefined' || o === null;

export const isSet = (o: any): boolean => !isUnset(o);

export function parseQuery(queryString: string): Record<string, unknown> {
    const query: any = {}
    const pairs = queryString.split('&')
    for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i].split('=')
        query[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '')
    }
    return query
}

export function isRelativeURL(u: string) {
    return (u && u.length && new RegExp(['^\\/([a-zA-Z0-9@\\-%_~.:]', '[/a-zA-Z0-9@\\-%_~.:]*)?', '([?][^#]*)?(#[^#]*)?$'].join('')).test(u));
}

export function routeMeta(route: RouteLocationNormalized, key: string, value: string | boolean): boolean {
    return route.meta[key] === value
}

export function getMatchedComponents(route: RouteLocationNormalized, matches: unknown[] = []): RouteComponent[][] {
    return [
        ...route.matched.map(function (m, index: number) {
            return Object.keys(m.components!).map(function (key) {
                matches.push(index);
                return m.components![key];
            });
        })
    ]
}

export function normalizePath(path: string = '', ctx: NuxtApp): string {
    // Remove query string
    let result = path.split('?')[0];

    // Remove base path
    if (ctx.$config.app.baseURL) {
        result = result.replace(ctx.$config.app.baseURL, '/');
    }

    // Remove redundant / from the end of path
    if (result.charAt(result.length - 1) === '/') {
        result = result.slice(0, -1);
    }

    // Remove duplicate slashes
    result = result.replace(/\/+/g, '/');

    return result;
}

export function encodeValue(val: any): string {
    if (typeof val === 'string') {
        return val;
    }
    return JSON.stringify(val);
}

export function decodeValue(val: any): any {
    // Try to parse as json
    if (typeof val === 'string') {
        try {
            return JSON.parse(val);
        } catch (_) { }
    }

    // Return as is
    return val;
}

/**
 * Get property defined by dot notation in string.
 * Based on  https://github.com/dy/dotprop (MIT)
 *
 * @param  { Object } holder   Target object where to look property up
 * @param  { string } propName Dot notation, like 'this.a.b.c'
 * @return { * } A property value
 */
export function getProp(holder: any, propName: string | false): any {
    if (isJSON(holder)) {
        holder = JSON.parse(holder)
    }

    if (!propName || !holder || typeof holder !== 'object') {
        return holder;
    }

    if (propName in holder) {
        return holder[propName];
    }

    const propParts = Array.isArray(propName) ? propName : (propName as string).split('.');

    let result = holder;
    for (let part of propParts) {
        if (result[part] === undefined) {
            return undefined;
        }
        result = result[part];
    }

    return result;
}

function isJSON(str: string) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

// Ie 'Bearer ' + token
export function addTokenPrefix(token: string | boolean, tokenType: string | false): string | boolean {
    if (!token || !tokenType || typeof token !== 'string' || token.startsWith(tokenType)) {
        return token;
    }

    return tokenType + ' ' + token;
}

export function removeTokenPrefix(token: string | boolean, tokenType: string | false): string | boolean {
    if (!token || !tokenType || typeof token !== 'string') {
        return token;
    }

    return token.replace(tokenType + ' ', '');
}

export function cleanObj<T extends Record<string, any>>(obj: T): RecursivePartial<T> {
    for (const key in obj) {
        if (obj[key] === undefined) {
            delete obj[key];
        }
    }

    return obj as RecursivePartial<T>;
}

export function randomString(length: number) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const charactersLength = characters.length;

    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }

    return result;
}

export function setH3Cookie(event: H3Event, serializedCookie: string) {
    // Send Set-Cookie header from server side
    let cookies = (event.node.res.getHeader('Set-Cookie') as string[]) || [];

    if (!Array.isArray(cookies)) cookies = [cookies];
    cookies.unshift(serializedCookie);

    if (!event.node.res.headersSent) {
        event.node.res.setHeader('Set-Cookie', cookies.filter(
            (value, index, items) => items.findIndex( 
                (val) => val.startsWith(value.slice(0, value.indexOf('='))) 
            ) === index
        ));
    }
}

export const hasOwn = <O extends object, K extends PropertyKey>(object: O, key: K) => Object.hasOwn ? Object.hasOwn(object, key) : Object.prototype.hasOwnProperty.call(object, key);