import type { RouteLocationNormalized } from '#vue-router'

export type Route = RouteLocationNormalized;
export interface RedirectRouterOptions {
    type?: 'window' | 'router'
}

