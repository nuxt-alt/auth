import AuthModule from '..'

export default defineNuxtConfig({
    modules: [
        AuthModule as any,
        "@nuxt-alt/http",
        "@nuxt-alt/proxy",
        '@nuxt/ui'
    ],
    auth: {
        strategies: {
            social: {
                provider: 'google',
            }
        }
    }
});
