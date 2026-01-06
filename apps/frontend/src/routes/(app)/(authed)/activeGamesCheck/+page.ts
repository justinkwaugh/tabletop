import { AuthorizationCategory } from '@tabletop/frontend-components'
import { getAppContext } from '$lib/stores/appContext.svelte.js'
import { redirect } from '@sveltejs/kit'
import type { PageLoad } from './$types.js'

export const load: PageLoad = async ({ url }) => {
    if (
        await getAppContext().authorizationService.authorizeRoute({
            category: AuthorizationCategory.ActiveUser,
            intendedUrl: url
        })
    ) {
        const hasActive = await getAppContext()
            .gameService.hasActiveGames()
            .catch((e) => {
                console.error('Error checking active games', e)
            })

        redirect(302, hasActive ? '/dashboard' : '/library')
    }
}
