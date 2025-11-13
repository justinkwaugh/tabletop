import { AuthorizationCategory } from '@tabletop/frontend-components'
import { getAppContext } from '$lib/stores/appContext.svelte.js'

export async function load({ url }) {
    // await new Promise((resolve) => setTimeout(resolve, 500))
    await getAppContext().authorizationService.authorizeRoute({
        category: AuthorizationCategory.NoUser,
        intendedUrl: url
    })
}
