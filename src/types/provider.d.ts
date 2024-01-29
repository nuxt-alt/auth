import type { SchemeOptions, SchemeNames } from './scheme';
import type { StrategyOptions } from './strategy';
import type { PartialExcept } from './utils';
import type { Nuxt } from '@nuxt/schema';

export type ProviderNames<N = ''> = 'laravel/sanctum' | 'laravel/jwt' | 'laravel/passport' | 'google' | 'github' | 'facebook' | 'discord' | 'auth0' | N | ((nuxt: Nuxt, strategy: StrategyOptions, ...args: any[]) => void);

export interface ImportOptions {
    name: string;
    as: string;
    from: string;
}

export interface ProviderOptions {
    scheme?: SchemeNames;
    clientSecret: string | number;
}

export type ProviderOptionsKeys = Exclude<keyof ProviderOptions, 'clientSecret'>;

export type ProviderPartialOptions<Options extends ProviderOptions & SchemeOptions> = PartialExcept<Options, ProviderOptionsKeys>;
