import { AuthorizationCategory } from '@tabletop/frontend-components'
import { getAppContext } from '$lib/stores/appContext.svelte.js'
import type { PageLoad } from './$types.js'

export const load: PageLoad = async ({ url }) => {
    await getAppContext().authorizationService.authorizeRoute({
        category: AuthorizationCategory.NoUser,
        intendedUrl: url
    })
}
