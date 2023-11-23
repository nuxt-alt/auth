import { routeMeta, hasOwn } from '#auth/utils'

export default defineNuxtPlugin({
    name: 'nuxt-alt:auth:watch-state',
    async setup() {
        const auth = useAuth()

        auth.$storage.watchState('loggedIn', (loggedIn: boolean) => {
            if (hasOwn(useRoute().meta, 'auth') && !routeMeta(useRoute(), 'auth', false)) {
                auth.redirect(loggedIn ? 'home' : 'logout');
            }
        })
    }
})