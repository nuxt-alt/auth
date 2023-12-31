import { routeMeta, getMatchedComponents, hasOwn, normalizePath } from '../../utils';
import { useAuth, useNuxtApp, defineNuxtRouteMiddleware } from '#imports';

export default defineNuxtRouteMiddleware(async (to, from) => {
    // Disable middleware if options: { auth: false } is set on the route
    if (hasOwn(to.meta, 'auth') && routeMeta(to, 'auth', false)) {
        return;
    }

    // Disable middleware if no route was matched to allow 404/error page
    const matches: unknown[] = [];
    const Components = getMatchedComponents(to, matches);

    if (!Components.length) {
        return;
    }

    const auth = useAuth();
    const ctx = useNuxtApp()

    const { login, callback } = auth.options.redirect;

    const pageIsInGuestMode = hasOwn(to.meta, 'auth') && routeMeta(to, 'auth', 'guest');

    const insidePage = (page: string) => normalizePath(to.path, ctx) === normalizePath(page, ctx);

    if (auth.$state.loggedIn) {
        // Perform scheme checks.
        const { tokenExpired, refreshTokenExpired, isRefreshable } = auth.check(true);

        // -- Authorized --
        if (!login || insidePage(login as string) || pageIsInGuestMode) {
            return auth.redirect('home', to)
        }

        // Refresh token has expired. There is no way to refresh. Force reset.
        if (refreshTokenExpired) {
            auth.reset();
            return auth.redirect('login', to);
        } else if (tokenExpired) {
            // Token has expired. Check if refresh token is available.
            if (isRefreshable) {
                // Refresh token is available. Attempt refresh.
                try {
                    await auth.refreshTokens();
                } catch (error) {
                    // Reset when refresh was not successfull
                    auth.reset();
                    return auth.redirect('login', to);
                }
            } else {
                // Refresh token is not available. Force reset.
                auth.reset();
                return auth.redirect('login', to);
            }
        }
    }

    // -- Guest --
    // (Those passing `callback` at runtime need to mark their callback component
    // with `auth: false` to avoid an unnecessary redirect from callback to login)
    else if (!pageIsInGuestMode && (!callback || !insidePage(callback as string))) {
        return auth.redirect('login', to);
    }
});
