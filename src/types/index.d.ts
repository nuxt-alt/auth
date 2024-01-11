import type { ModuleOptions } from './options';
import type { Auth } from '../runtime';
import * as NuxtSchema from '@nuxt/schema';

export * from './openIDConnectConfigurationDocument';
export * from './provider';
export * from './request';
export * from './router';
export * from './scheme';
export * from './strategy';
export * from './utils';
export * from './options';
export * from './store'

declare module '#app' {
    interface NuxtApp {
        $auth: Auth;
    }
}

declare module 'vue-router' {
    interface RouteMeta {
        auth?: 'guest' | false
    }
}

declare module '@nuxt/schema' {
    interface NuxtConfig {
        ['auth']?: Partial<ModuleOptions>
    }
    interface NuxtOptions {
        ['auth']?: ModuleOptions
    }
}

declare const NuxtAuth: NuxtSchema.NuxtModule<ModuleOptions>

export {
    ModuleOptions,
    NuxtAuth as default
};

