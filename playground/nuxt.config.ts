import Module from '..'

export default defineNuxtConfig({
    modules: [
        Module,
        "@nuxt-alt/http",
        "@pinia/nuxt",
    ],
    auth: {}
});
