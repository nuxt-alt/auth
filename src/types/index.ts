import type { ModuleOptions } from './options';
import type { NuxtSSRContext } from '#app';
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

declare module '#app' {
    interface NuxtApp {
        $auth: Auth;
        ssrContext?: NuxtSSRContext;
    }
}

declare module '@nuxt/schema' {
    export interface NuxtConfig {
        auth?: Partial<ModuleOptions>;
    }
    export interface NuxtOptions {
        auth?: Partial<ModuleOptions>;
    }
    export interface RuntimeConfig {
        auth?: Partial<ModuleOptions>
    }
}

declare const NuxtAuth: NuxtSchema.NuxtModule<Partial<ModuleOptions>>

export default NuxtAuth