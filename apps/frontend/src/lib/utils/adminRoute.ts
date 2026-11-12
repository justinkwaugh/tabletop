import { redirect } from '@sveltejs/kit'
import { AuthorizationCategory } from '@tabletop/frontend-components'
import { getAppContext } from '$lib/stores/appContext.svelte.js'

export async function authorizeAdminRoute(url: URL): Promise<boolean> {
    const { authorizationService } = getAppContext()
    const authorized = await authorizationService.authorizeRoute({
        category: AuthorizationCategory.ActiveUser,
        intendedUrl: url
    })
    if (!authorized) {
        return false
    }
    await authorizationService.whenSessionVerified()
    if (!authorizationService.isAdmin) {
        redirect(302, '/library')
    }
    return true
}
