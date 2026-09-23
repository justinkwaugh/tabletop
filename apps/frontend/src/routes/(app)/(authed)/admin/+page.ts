import { redirect } from '@sveltejs/kit'
import { AuthorizationCategory } from '@tabletop/frontend-components'
import { getAppContext } from '$lib/stores/appContext.svelte.js'
import type { PageLoad } from './$types.js'

export const load: PageLoad = async ({ url }) => {
    const { authorizationService } = getAppContext()
    const authorized = await authorizationService.authorizeRoute({
        category: AuthorizationCategory.ActiveUser,
        intendedUrl: url
    })
    if (authorized && !authorizationService.isAdmin) {
        redirect(302, '/library')
    }
}
