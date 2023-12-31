import type { ProviderOptions, ProviderPartialOptions } from '../../types';
import type { Oauth2SchemeOptions } from '..';
import type { Nuxt } from '@nuxt/schema';
import { assignDefaults, addAuthorize } from '../../utils/provider';
import { OAUTH2DEFAULTS } from '../inc';

export interface GithubProviderOptions extends ProviderOptions, Oauth2SchemeOptions {}

export function github(nuxt: Nuxt, strategy: ProviderPartialOptions<GithubProviderOptions>): void {
    const DEFAULTS = Object.assign(OAUTH2DEFAULTS, {
        scheme: 'oauth2',
        endpoints: {
            authorization: 'https://github.com/login/oauth/authorize',
            token: 'https://github.com/login/oauth/access_token',
            userInfo: 'https://api.github.com/user',
        },
        scope: ['user', 'email'],
    })

    assignDefaults(strategy, DEFAULTS as typeof strategy);

    addAuthorize(nuxt, strategy);
}
