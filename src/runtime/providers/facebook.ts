import type { ProviderPartialOptions, ProviderOptions } from '../../types';
import type { Oauth2SchemeOptions } from '..';
import type { Nuxt } from '@nuxt/schema';
import { assignDefaults } from '../../utils/provider';
import { OAUTH2DEFAULTS } from '../inc';

export interface FacebookProviderOptions extends ProviderOptions, Oauth2SchemeOptions {}

export function facebook(nuxt: Nuxt, strategy: ProviderPartialOptions<FacebookProviderOptions>): void {
    const DEFAULTS = Object.assign(OAUTH2DEFAULTS, {
        scheme: 'oauth2',
        endpoints: {
            authorization: 'https://facebook.com/v2.12/dialog/oauth',
            userInfo: 'https://graph.facebook.com/v2.12/me?fields=about,name,picture{url},email',
        },
        scope: ['public_profile', 'email'],
    })

    assignDefaults(strategy, DEFAULTS as typeof strategy);
}
