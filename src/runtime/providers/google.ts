import type { ProviderPartialOptions, ProviderOptions } from '../../types';
import type { Oauth2SchemeOptions } from '..';
import type { Nuxt } from '@nuxt/schema';
import { assignDefaults } from '../../utils/provider';
import { OAUTH2DEFAULTS } from '../inc';

export interface GoogleProviderOptions extends ProviderOptions, Oauth2SchemeOptions {}

export function google(nuxt: Nuxt, strategy: ProviderPartialOptions<GoogleProviderOptions>): void {
    const DEFAULTS = Object.assign(OAUTH2DEFAULTS, {
        scheme: 'oauth2',
        endpoints: {
            authorization: 'https://accounts.google.com/o/oauth2/v2/auth',
            userInfo: 'https://www.googleapis.com/oauth2/v3/userinfo'
        },
        scope: ['openid', 'profile', 'email'],
    })

    assignDefaults(strategy, DEFAULTS as typeof strategy);
}
