import { AuthorizationCategory } from '@tabletop/frontend-components'
import { getAppContext } from '$lib/stores/appContext.svelte.js'

export async function load({ url }) {
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
