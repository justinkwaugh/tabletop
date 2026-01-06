import { AuthorizationCategory } from '@tabletop/frontend-components'
import { getAppContext } from '$lib/stores/appContext.svelte.js'
import type { PageLoad } from './$types.js'

export const load: PageLoad = async ({ url }) => {
    if (
        await getAppContext().authorizationService.authorizeRoute({
            category: AuthorizationCategory.ActiveUser,
            intendedUrl: url
        })
    ) {
        getAppContext()
            .gameService.loadGames()
            .catch((e) => {
                console.error('Error loading games', e)
            })
    }
}
