import AuthModule from '..'

export default defineNuxtConfig({
    modules: [
        AuthModule as any,
        "@nuxt-alt/http",
        "@nuxt-alt/proxy",
        "@nuxtjs/i18n",
        '@nuxt/ui'
    ],
    auth: {
        strategies: {
            discord: {
                clientId: '',
                clientSecret: '',
            }
        }
    },
});
