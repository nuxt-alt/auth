import { jwtDecode, type JwtPayload } from 'jwt-decode';
import { addTokenPrefix } from '../../utils';
import type { AuthState, IdTokenableScheme } from '../../types';
import type { Storage } from '../core';
import { TokenStatus } from './token-status';

export class IdToken {
    scheme: IdTokenableScheme;
    $storage: Storage;

    constructor(scheme: IdTokenableScheme, storage: Storage) {
        this.scheme = scheme;
        this.$storage = storage;
    }

    get(): string | boolean {
        const key = this.scheme.options.idToken.prefix + this.scheme.name;

        return this.$storage.getUniversal(key) as string | boolean;
    }

    set(tokenValue: string | boolean): string | boolean {
        const idToken = addTokenPrefix(tokenValue, this.scheme.options.idToken.type);

        this.#setToken(idToken);
        this.#updateExpiration(idToken);

        return idToken;
    }

    sync(): string | boolean | void | null | undefined {
        const idToken = this.#syncToken();
        this.#syncExpiration();

        return idToken;
    }

    reset() {
        this.#resetSSRToken();
        this.#setToken(undefined);
        this.#setExpiration(undefined);
    }

    status(): TokenStatus {
        return new TokenStatus(this.get(), this.#getExpiration(), this.scheme.options.idToken?.httpOnly);
    }

    #resetSSRToken(): void {
        if (this.scheme.options.ssr && this.scheme.options.idToken?.httpOnly) {
            const key = this.scheme.options.idToken!.prefix + this.scheme.name;
            this.scheme.$auth.request({ baseURL: '', url: '/_auth/reset', body: new URLSearchParams({ token: key }), method: 'POST' })
        }
    }

    #getExpiration(): number | false {
        const key = this.scheme.options.idToken.expirationPrefix + this.scheme.name;

        return this.$storage.getUniversal(key) as number | false;
    }

    #setExpiration(expiration: number | false | undefined | null): number | false | void | null | undefined {
        const key = this.scheme.options.idToken.expirationPrefix + this.scheme.name;

        return this.$storage.setUniversal(key, expiration);
    }

    #syncExpiration(): number | false {
        const key =
            this.scheme.options.idToken.expirationPrefix + this.scheme.name;

        return this.$storage.syncUniversal(key) as number | false;
    }

    #updateExpiration(idToken: string | boolean): number | false | void | null | undefined {
        let idTokenExpiration: number;
        const tokenIssuedAtMillis = Date.now();
        const tokenTTLMillis = Number(this.scheme.options.idToken.maxAge) * 1000;
        const tokenExpiresAtMillis = tokenTTLMillis ? tokenIssuedAtMillis + tokenTTLMillis : 0;

        try {
            idTokenExpiration = jwtDecode<JwtPayload>(idToken as string).exp! * 1000 || tokenExpiresAtMillis;
        } 
        catch (error: any) {
            // If the token is not jwt, we can't decode and refresh it, use tokenExpiresAt value
            idTokenExpiration = tokenExpiresAtMillis;

            if (!(error && error.name === 'InvalidTokenError')) {
                throw error;
            }
        }

        // Set token expiration
        return this.#setExpiration(idTokenExpiration || false);
    }

    #setToken(idToken: string | boolean | undefined | null): string | boolean | void | null | undefined {
        const key = this.scheme.options.idToken.prefix + this.scheme.name;

        return this.$storage.setUniversal(key, idToken) as string | boolean;
    }

    #syncToken(): string | boolean | void | null | undefined {
        const key = this.scheme.options.idToken.prefix + this.scheme.name;

        return this.$storage.syncUniversal(key)
    }

    userInfo() {
        const idToken = this.get();
        if (typeof idToken === 'string') {
            return jwtDecode(idToken) as AuthState['user'];
        }
    }
}
