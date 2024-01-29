import type { RefreshableScheme } from '../../types';
import type { Storage } from '../core';
import { addTokenPrefix } from '../../utils';
import { TokenStatus } from './token-status';
import { type JwtPayload, jwtDecode } from 'jwt-decode';

export class RefreshToken {
    scheme: RefreshableScheme;
    $storage: Storage;

    constructor(scheme: RefreshableScheme, storage: Storage) {
        this.scheme = scheme;
        this.$storage = storage;
    }

    get(): string | boolean {
        const key = this.scheme.options.refreshToken.prefix + this.scheme.name;

        return this.$storage.getUniversal(key) as string | boolean;
    }

    set(tokenValue: string | boolean): string | boolean | void | null | undefined {
        const refreshToken = addTokenPrefix(tokenValue, this.scheme.options.refreshToken.type);

        this.#setToken(refreshToken);
        this.#updateExpiration(refreshToken);

        return refreshToken;
    }

    sync(): string | boolean | void | null | undefined {
        const refreshToken = this.#syncToken();
        this.#syncExpiration();

        return refreshToken;
    }

    reset(): void {
        this.#resetSSRToken();
        this.#setToken(undefined);
        this.#setExpiration(undefined);
    }

    status(): TokenStatus {
        return new TokenStatus(this.get(), this.#getExpiration(), this.scheme.options.refreshToken?.httpOnly);
    }

    #resetSSRToken(): void {
        if (this.scheme.options.ssr && this.scheme.options.refreshToken?.httpOnly) {
            const key = this.scheme.options.refreshToken!.prefix + this.scheme.name;
            this.scheme.$auth.request({ baseURL: '', url: '/_auth/reset', body: new URLSearchParams({ token: key }), method: 'POST' })
        }
    }

    #getExpiration(): number | false {
        const key = this.scheme.options.refreshToken.expirationPrefix + this.scheme.name;

        return this.$storage.getUniversal(key) as number | false;
    }

    #setExpiration(expiration: number | false | undefined | null): number | false | void | null | undefined {
        const key = this.scheme.options.refreshToken.expirationPrefix + this.scheme.name;

        return this.$storage.setUniversal(key, expiration);
    }

    #syncExpiration(): number | false {
        const key = this.scheme.options.refreshToken.expirationPrefix + this.scheme.name;

        return this.$storage.syncUniversal(key);
    }

    #updateExpiration(refreshToken: string | boolean): number | false | void | null | undefined {
        let refreshTokenExpiration: number;
        const tokenIssuedAtMillis = Date.now();
        const tokenTTLMillis = Number(this.scheme.options.refreshToken.maxAge) * 1000;
        const tokenExpiresAtMillis = tokenTTLMillis ? tokenIssuedAtMillis + tokenTTLMillis : 0;

        try {
            refreshTokenExpiration = jwtDecode<JwtPayload>(refreshToken as string).exp! * 1000 || tokenExpiresAtMillis;
        } catch (error: any) {
            // If the token is not jwt, we can't decode and refresh it, use tokenExpiresAt value
            refreshTokenExpiration = tokenExpiresAtMillis;

            if (!((error && error.name === 'InvalidTokenError'))) {
                throw error;
            }
        }

        // Set token expiration
        return this.#setExpiration(refreshTokenExpiration || false);
    }

    #setToken(refreshToken: string | boolean | undefined | null): string | boolean | void | null | undefined {
        const key = this.scheme.options.refreshToken.prefix + this.scheme.name;

        return this.$storage.setUniversal(key, refreshToken);
    }

    #syncToken(): string | boolean | void | null | undefined {
        const key = this.scheme.options.refreshToken.prefix + this.scheme.name;

        return this.$storage.syncUniversal(key) as string | boolean;
    }
}
