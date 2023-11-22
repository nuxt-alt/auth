import type { SchemePartialOptions, RefreshableSchemeOptions, SchemeOptions, SchemeNames } from './scheme';
import type { CookieSchemeOptions, Oauth2SchemeOptions, OpenIDConnectSchemeOptions } from '../runtime/schemes';
import type { ProviderPartialOptions, ProviderOptions, ProviderNames } from './provider';

export type Strategy<S = {}> = S & Strategies;

export interface AuthSchemeOptions extends RefreshableSchemeOptions, Oauth2SchemeOptions, CookieSchemeOptions, OpenIDConnectSchemeOptions {}

export interface Strategies extends SchemePartialOptions<AuthSchemeOptions> {
    provider?: ProviderNames | ((...args: any[]) => any);
    scheme?: SchemeNames;
    enabled?: boolean;
    [key: string]: any;
}

export type StrategyOptions<SOptions extends SchemeOptions = SchemeOptions> = ProviderPartialOptions<ProviderOptions & SOptions>;
