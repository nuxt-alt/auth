import type { TokenableScheme } from '../../types';
import type { Storage } from '../core';
import { addTokenPrefix } from '../../utils';
import { TokenStatus } from './token-status';
import { type JwtPayload, jwtDecode } from 'jwt-decode';

export class Token {
    scheme: TokenableScheme;
    $storage: Storage;

    constructor(scheme: TokenableScheme, storage: Storage) {
        this.scheme = scheme;
        this.$storage = storage;
    }

    get(): string | boolean {
        const key = this.scheme.options.token!.prefix + this.scheme.name;

        return this.$storage.getUniversal(key) as string | boolean;
    }

    set(tokenValue: string | boolean, expiresIn: number | boolean = false): string | boolean | void | null | undefined {
        const token = addTokenPrefix(tokenValue, this.scheme.options.token!.type);

        this.#setToken(token);
        this.#updateExpiration(token, expiresIn);

        if (typeof token === 'string') {
            this.scheme.requestHandler!.setHeader(token);
        }

        return token;
    }

    sync(): string | boolean | void | null | undefined {
        const token = this.#syncToken();
        this.#syncExpiration();

        if (typeof token === 'string') {
            this.scheme.requestHandler!.setHeader(token);
        }

        return token;
    }

    reset(): void {
        this.scheme.requestHandler!.clearHeader();
        this.#resetSSRToken();
        this.#setToken(undefined);
        this.#setExpiration(undefined);
    }

    status(): TokenStatus {
        return new TokenStatus(this.get(), this.#getExpiration(), this.scheme.options.token?.httpOnly);
    }

    #resetSSRToken(): void {
        if (this.scheme.options.ssr && this.scheme.options.token?.httpOnly) {
            const key = this.scheme.options.token!.prefix + this.scheme.name;
            this.scheme.$auth.request({ baseURL: '', url: '/_auth/reset', body: new URLSearchParams({ token: key }), method: 'POST' })
        }
    }

    #getExpiration(): number | false {
        const key = this.scheme.options.token!.expirationPrefix + this.scheme.name;

        return this.$storage.getUniversal(key) as number | false;
    }

    #setExpiration(expiration: number | false | undefined | null): number | false | void | null | undefined {
        const key = this.scheme.options.token!.expirationPrefix + this.scheme.name;

        return this.$storage.setUniversal(key, expiration);
    }

    #syncExpiration(): number | false {
        const key = this.scheme.options.token!.expirationPrefix + this.scheme.name;

        return this.$storage.syncUniversal(key);
    }

    #updateExpiration(token: string | boolean, expiresIn: number | boolean): number | false | void | null | undefined {
        let tokenExpiration: number;
        const tokenIssuedAtMillis = Date.now();
        const maxAge = expiresIn ? expiresIn : this.scheme.options.token!.maxAge
        const tokenTTLMillis = Number(maxAge) * 1000
        const tokenExpiresAtMillis = tokenTTLMillis ? tokenIssuedAtMillis + tokenTTLMillis : 0;

        try {
            tokenExpiration = jwtDecode<JwtPayload>(token as string).exp! * 1000 || tokenExpiresAtMillis;
        }
        catch (error: any) {
            // If the token is not jwt, we can't decode and refresh it, use tokenExpiresAt value
            tokenExpiration = tokenExpiresAtMillis;

            if (!(error && error.name === 'InvalidTokenError')) {
                throw error;
            }
        }

        // Set token expiration
        return this.#setExpiration(tokenExpiration || false);
    }

    #setToken(token: string | boolean | undefined | null): string | boolean | void | null | undefined {
        const key = this.scheme.options.token!.prefix + this.scheme.name;

        return this.$storage.setUniversal(key, token);
    }

    #syncToken(): string | boolean | void | null | undefined {
        const key = this.scheme.options.token!.prefix + this.scheme.name;

        return this.$storage.syncUniversal(key)
    }
}
