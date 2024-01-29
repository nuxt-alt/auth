import { readBody, defineEventHandler, deleteCookie } from 'h3'
// @ts-expect-error: virtual file
import { config } from '#nuxt-auth-options'

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const token = config.stores?.cookie?.prefix + body?.token

    if (token) {
        deleteCookie(event, token, { ...config.stores.cookie.options })
    }
})