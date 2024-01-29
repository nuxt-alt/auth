import type { SchemePartialOptions, RefreshableSchemeOptions, SchemeOptions, SchemeNames } from './scheme';
import type { CookieSchemeOptions, Oauth2SchemeOptions, OpenIDConnectSchemeOptions } from '../runtime/schemes';
import type { ProviderPartialOptions, ProviderOptions, ProviderNames } from './provider';
import type { RecursivePartial } from './utils';

export type Strategy<S = {}> = S & Strategies;

// @ts-ignore: endpoints dont match
export interface AuthSchemeOptions extends RefreshableSchemeOptions, Oauth2SchemeOptions, CookieSchemeOptions, OpenIDConnectSchemeOptions {}

export interface Strategies {
    provider?: ProviderNames;
    enabled?: boolean;
}

export type StrategyOptions<SOptions extends RecursivePartial<AuthSchemeOptions> = RecursivePartial<AuthSchemeOptions>> = ProviderPartialOptions<ProviderOptions & SOptions & Strategy>;
